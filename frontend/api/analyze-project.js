import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function isPublicAddress(address) {
  if (address.includes(':')) {
    const value = address.toLowerCase()
    return (/^[23]/.test(value) && !value.startsWith('2001:db8:') && !value.startsWith('::ffff:'))
  }
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => part < 0 || part > 255)) return false
  const [a, b, c] = parts
  return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224)
}

async function validatePublicUrl(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Ingresa una URL válida.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Solo se permiten enlaces HTTP o HTTPS públicos.')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('El enlace debe apuntar a un sitio público.')
  const records = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new Error('El enlace debe apuntar a un sitio público.')
  return url
}

async function githubJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CloudOps-Project-Analyzer' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(response.status === 404 ? 'No se encontró el repositorio público de GitHub.' : `GitHub respondió con HTTP ${response.status}.`)
  return response.json()
}

async function readLimitedText(response, maxBytes = 500000) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  while (bytes < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = value.subarray(0, maxBytes - bytes)
    bytes += chunk.byteLength
    text += decoder.decode(chunk, { stream: bytes < maxBytes })
    if (chunk.byteLength < value.byteLength) break
  }
  reader.cancel().catch(() => {})
  return text + decoder.decode()
}

async function analyzeProject(value) {
  let url = await validatePublicUrl(value)
  if (url.hostname.toLowerCase() === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) throw new Error('Pega el enlace de un repositorio de GitHub, por ejemplo github.com/organizacion/proyecto.')
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/i, '')
    const encodedOwner = encodeURIComponent(owner)
    const encodedRepo = encodeURIComponent(repo)
    const details = await githubJson(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}`)
    const [languages, readmeResponse, contents] = await Promise.all([
      githubJson(details.languages_url).catch(() => ({})),
      fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/readme`, { headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'CloudOps-Project-Analyzer' }, signal: AbortSignal.timeout(12000) }).catch(() => null),
      githubJson(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/git/trees/${encodeURIComponent(details.default_branch)}?recursive=1`).catch(() => ({ tree: [] })),
    ])
    const readme = readmeResponse?.ok ? await readmeResponse.text() : ''
    const languageList = Object.keys(languages)
    const paths = (contents.tree || []).filter(item => item.type === 'blob').map(item => item.path.toLowerCase())
    const text = `${details.description || ''} ${readme} ${paths.join(' ')}`.toLowerCase()
    const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch']
    if (/react|vue|angular|next|web|frontend/.test(text) || languageList.some(name => ['JavaScript', 'TypeScript', 'HTML', 'CSS'].includes(name))) recommendations.push('Amazon CloudFront', 'Amazon S3')
    if (/api|express|django|fastapi|spring|backend|node/.test(text) || languageList.some(name => ['Python', 'Java', 'Go', 'Ruby'].includes(name))) recommendations.push('Amazon EC2', 'Amazon RDS')
    if (/data|analytics|machine learning|dataset/.test(text)) recommendations.push('Amazon S3')
    const findings = [details.archived ? 'CRÍTICO · El repositorio está archivado; los cambios y avisos de seguridad pueden no recibir mantenimiento.' : 'INFO · Repositorio público accesible; el análisis cubrió metadatos, lenguajes, README y árbol de archivos.']
    if (contents.truncated) findings.push('ALCANCE · GitHub truncó el árbol de archivos; los hallazgos basados en rutas pueden estar incompletos.')
    if (languageList.length) findings.push(`INFO · Lenguajes detectados por GitHub: ${languageList.slice(0, 8).join(', ')}.`)
    if (!paths.some(path => /(^|\/)(test|tests|spec|specs)\//.test(path) || /\.(test|spec)\./.test(path))) findings.push('MEDIO · No se identificaron pruebas automatizadas por nombres de archivo; confirma si existen en otro flujo.')
    if (!paths.some(path => path.startsWith('.github/workflows/'))) findings.push('MEDIO · No se detectaron workflows de CI en .github/workflows; automatiza validaciones y despliegues reproducibles.')
    if (!paths.some(path => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|pipfile\.lock|cargo\.lock|go\.sum)$/.test(path))) findings.push('MEDIO · No se detectó un archivo de bloqueo de dependencias; fija versiones para mejorar reproducibilidad.')
    if (!paths.some(path => /(^|\/)(dockerfile|docker-compose\.ya?ml)$/.test(path))) findings.push('INFO · No se identificó configuración Docker en el árbol del repositorio.')
    if ((contents.tree || []).some(item => item.path?.toLowerCase().includes('.env') && !item.path.toLowerCase().includes('.env.example'))) findings.push('ALTO · Se encontraron archivos con nombre .env en el árbol público; revisa que no contengan credenciales y rota cualquier secreto expuesto.')
    const actions = [
      ...(details.archived ? ['Definir un responsable y un plan de actualización o migrar a un repositorio mantenido.'] : []),
      ...(!paths.some(path => path.startsWith('.github/workflows/')) ? ['Añadir CI con lint, pruebas y escaneo de dependencias en cada pull request.'] : []),
      ...(!paths.some(path => /(^|\/)(test|tests|spec|specs)\//.test(path) || /\.(test|spec)\./.test(path)) ? ['Incorporar pruebas unitarias y de integración para los flujos críticos antes de desplegar.'] : []),
      ...(!paths.some(path => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|pipfile\.lock|cargo\.lock|go\.sum)$/.test(path)) ? ['Generar y versionar el lockfile de dependencias y automatizar alertas de vulnerabilidades.'] : []),
      ...((contents.tree || []).some(item => item.path?.toLowerCase().includes('.env') && !item.path.toLowerCase().includes('.env.example')) ? ['Auditar los archivos .env publicados, revocar secretos expuestos y mover credenciales a un gestor de secretos.'] : []),
      'Configurar mínimo privilegio para identidades, registros centralizados, alarmas y copias de seguridad verificadas en la arquitectura AWS.',
      'Antes de producción, documentar RPO/RTO, estrategia de recuperación y objetivos de disponibilidad para seleccionar servicios y regiones.'
    ]
    return { type: 'github', name: details.full_name, description: details.description || 'Sin descripción pública.', summary: `${details.full_name} usa ${languageList.slice(0, 5).join(', ') || 'tecnologías no identificadas'}; ${paths.length} archivos visibles en la rama ${details.default_branch}. Se evaluaron señales públicas de automatización, pruebas, dependencias y configuración.`, url: details.html_url, visibility: details.private ? 'Privado' : 'Público', stars: details.stargazers_count, updatedAt: details.updated_at, defaultBranch: details.default_branch, fileCount: paths.length, languages: languageList, technologies: languageList, recommendations: actions, suggestedServices: [...new Set(recommendations)], findings }
  }

  let response
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    url = await validatePublicUrl(url.href)
    response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloudOps-Project-Analyzer/1.0)', Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5' }, signal: AbortSignal.timeout(18000), redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (!location || redirects === 4) throw new Error('El sitio redirigió demasiadas veces para analizarlo de forma segura.')
    url = new URL(location, url)
  }
  if (!response?.ok) throw new Error(response?.status === 403 || response?.status === 429 ? `El sitio bloqueó el análisis automático (HTTP ${response.status}).` : `El sitio respondió con HTTP ${response?.status || 502}.`)
  const contentType = response.headers.get('content-type') || ''
  const html = /text\/(html|xhtml)/i.test(contentType) || !contentType ? await readLimitedText(response) : ''
  const decode = (value = '') => value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim()
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '')) || url.hostname
  const descriptionTag = html.match(/<meta\b[^>]*>/gi)?.find(tag => /\bname\s*=\s*["']description["']/i.test(tag))
  const description = decode(descriptionTag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2] || '')
  const technologies = [...new Set([...(html.match(/(?:react|vue|angular|next|nuxt|wordpress|shopify|laravel|django|next\.js)/gi) || []).map(name => name.toLowerCase())])]
  const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch', 'Amazon CloudFront']
  if (/api|graphql/.test(html.toLowerCase())) recommendations.push('Amazon EC2', 'Amazon RDS')
  if (/wordpress|shopify|woocommerce|magento/.test(html.toLowerCase())) recommendations.push('Amazon S3', 'Amazon CloudFront')
  const findings = [response.headers.get('strict-transport-security') ? 'INFO · Se detectó la cabecera HSTS.' : 'MEDIO · No se detectó HSTS; si el sitio funciona íntegramente por HTTPS, habilítala tras confirmar todos los subdominios.', response.headers.get('content-security-policy') ? 'INFO · Se detectó una política CSP.' : 'MEDIO · No se detectó CSP; define una política gradual para reducir el riesgo de XSS.', response.headers.get('x-content-type-options') ? 'INFO · Se detectó X-Content-Type-Options.' : 'BAJO · No se detectó X-Content-Type-Options: nosniff.', response.headers.get('referrer-policy') ? 'INFO · Se detectó Referrer-Policy.' : 'BAJO · No se detectó Referrer-Policy; limita la exposición de URLs de referencia.', technologies.length ? `INFO · Indicadores tecnológicos en HTML: ${technologies.join(', ')}.` : 'INFO · La tecnología no se pudo identificar solo desde el HTML público.', `INFO · Respuesta HTTP ${response.status}; tipo de contenido ${contentType || 'no informado'}.`]
  const actions = [
    ...(!response.headers.get('strict-transport-security') ? ['Verificar HTTPS y habilitar HSTS con max-age gradual; incluir subdominios solo cuando todos sean HTTPS.'] : []),
    ...(!response.headers.get('content-security-policy') ? ['Definir una Content-Security-Policy compatible con los recursos reales y probarla primero en modo Report-Only.'] : []),
    ...(!response.headers.get('x-content-type-options') ? ['Añadir X-Content-Type-Options: nosniff y validar los tipos MIME servidos.'] : []),
    ...(!response.headers.get('referrer-policy') ? ['Configurar Referrer-Policy: strict-origin-when-cross-origin o una política más restrictiva según la aplicación.'] : []),
    'Revisar controles no visibles desde una petición pública: autenticación, autorización, dependencias, configuración TLS, exposición de datos y protección de APIs.',
    'Ejecutar pruebas autorizadas de seguridad y rendimiento en un entorno controlado; esta inspección no sustituye una auditoría dinámica.'
  ]
  return { type: 'website', name: title, description: description || 'No se encontró una descripción pública en la página.', summary: `La URL respondió con HTTP ${response.status} y se revisaron cabeceras de seguridad, metadatos HTML e indicadores tecnológicos visibles.`, url: url.href, status: response.status, contentType: contentType || 'No informado', technologies, recommendations: actions, suggestedServices: recommendations, findings }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (typeof body?.url !== 'string') throw new Error('Pega el enlace del proyecto que quieres analizar.')
    return response.status(200).json(await analyzeProject(body.url.trim()))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo analizar el proyecto.'
    return response.status(400).json({ error: message })
  }
}
