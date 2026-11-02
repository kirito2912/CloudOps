import { createServer } from 'node:http'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const port = Number(process.env.PORT || 3001)
const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://cloud-ops-omega.vercel.app',
  ...(process.env.FRONTEND_ORIGINS || '').split(','),
].map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean))

// Estado inicial VACÍO - sin servicios desplegados
function generateDemoOverview() {
  return {
    source: 'simulated',
    account: 'Tu cuenta AWS',
    region: 'us-east-1',
    monthlyCostUsd: 0,
    deployedRegions: 0,
    services: 0,
    activeResources: 0,
    availability: 0,
    updatedAt: new Date().toISOString(),
  }
}

function generateDemoResources(region = 'us-east-1') {
  return {
    source: 'simulated',
    region,
    resources: [],
    totalCount: 0,
    updatedAt: new Date().toISOString(),
  }
}

function generateDemoCosts() {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // Generar historial VACÍO de los últimos 6 meses
  const monthlyHistory = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1)
    monthlyHistory.push({
      month: date.toISOString().slice(0, 7),
      total: 0,
    })
  }
  
  return {
    source: 'simulated',
    currency: 'USD',
    monthlyTotal: 0,
    monthlyHistory,
    breakdown: [],
    updatedAt: new Date().toISOString(),
  }
}

function generateDemoSecurityFindings() {
  return {
    source: 'simulated',
    score: 0,
    totalFindings: 0,
    findings: [],
    complianceChecks: {
      mfaEnabled: false,
      encryptionAtRest: false,
      securityGroupsReviewed: false,
      iamPasswordPolicy: false,
      cloudTrailEnabled: false,
    },
    updatedAt: new Date().toISOString(),
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function isPublicAddress(address) {
  if (address.includes(':')) return !(/^(::1|fe[89ab]|fc|fd|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/i.test(address) || address === '::')
  const parts = address.split('.').map(Number)
  if (parts.length !== 4) return false
  const [a, b] = parts
  return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224)
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

async function fetchPublicPage(initialUrl) {
  let url = initialUrl
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    await validatePublicUrl(url.href)
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloudOps-Project-Analyzer/1.0)', Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5' }, signal: AbortSignal.timeout(18000), redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    if (!location || redirects === 4) throw new Error('El sitio redirigió demasiadas veces para analizarlo de forma segura.')
    url = new URL(location, url)
  }
  throw new Error('No se pudo seguir la redirección del sitio.')
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

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000), redirect: 'error' })
  if (!response.ok) throw new Error(`No se pudo consultar el recurso (HTTP ${response.status}).`)
  return response.json()
}

async function analyzeProject(value) {
  const url = await validatePublicUrl(value)
  if (url.hostname.toLowerCase() === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) throw new Error('Pega el enlace de un repositorio de GitHub, por ejemplo github.com/organizacion/proyecto.')
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/i, '')
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'CloudOps-Project-Analyzer' }
    const details = await getJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, headers)
    const [languages, readme, tree] = await Promise.all([
      getJson(details.languages_url, headers).catch(() => ({})),
      fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' }, signal: AbortSignal.timeout(12000), redirect: 'error' }).then(r => r.ok ? r.text() : '').catch(() => ''),
      getJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(details.default_branch)}?recursive=1`, headers).catch(() => ({ tree: [] })),
    ])
    const languageList = Object.keys(languages)
    const paths = (tree.tree || []).filter(item => item.type === 'blob').map(item => item.path.toLowerCase())
    const text = `${details.description || ''} ${readme} ${paths.join(' ')}`.toLowerCase()
    const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch']
    if (/react|vue|angular|next|web|frontend/.test(text) || languageList.some(x => ['JavaScript', 'TypeScript', 'HTML', 'CSS'].includes(x))) recommendations.push('Amazon CloudFront', 'Amazon S3')
    if (/api|express|django|fastapi|spring|backend|node/.test(text) || languageList.some(x => ['Python', 'Java', 'Go', 'Ruby'].includes(x))) recommendations.push('Amazon EC2', 'Amazon RDS')
    if (/data|analytics|machine learning|dataset/.test(text)) recommendations.push('Amazon S3')
    const findings = [details.archived ? 'ALTO · El repositorio está archivado; los cambios pueden no recibir mantenimiento.' : 'INFO · Se revisaron metadatos, lenguajes, README y árbol de archivos públicos.']
    if (tree.truncated) findings.push('ALCANCE · GitHub truncó el árbol de archivos; los hallazgos basados en rutas pueden estar incompletos.')
    if (languageList.length) findings.push(`INFO · Lenguajes detectados: ${languageList.slice(0, 8).join(', ')}.`)
    if (!paths.some(path => /(^|\/)(test|tests|spec|specs)\//.test(path) || /\.(test|spec)\./.test(path))) findings.push('MEDIO · No se identificaron pruebas automatizadas por nombres de archivo.')
    if (!paths.some(path => path.startsWith('.github/workflows/'))) findings.push('MEDIO · No se detectaron workflows CI en .github/workflows.')
    if (!paths.some(path => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|pipfile\.lock|cargo\.lock|go\.sum)$/.test(path))) findings.push('MEDIO · No se detectó lockfile de dependencias.')
    if ((tree.tree || []).some(item => item.path?.toLowerCase().includes('.env') && !item.path.toLowerCase().includes('.env.example'))) findings.push('ALTO · Hay archivos con nombre .env en el árbol público; confirma que no expongan credenciales.')
    const actions = [
      ...(!paths.some(path => path.startsWith('.github/workflows/')) ? ['Añadir CI con pruebas, lint y análisis de dependencias en cada pull request.'] : []),
      ...(!paths.some(path => /(^|\/)(test|tests|spec|specs)\//.test(path) || /\.(test|spec)\./.test(path)) ? ['Añadir pruebas unitarias y de integración para los flujos críticos.'] : []),
      ...(!paths.some(path => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|pipfile\.lock|cargo\.lock|go\.sum)$/.test(path)) ? ['Versionar el lockfile y automatizar alertas de dependencias vulnerables.'] : []),
      ...((tree.tree || []).some(item => item.path?.toLowerCase().includes('.env') && !item.path.toLowerCase().includes('.env.example')) ? ['Auditar los .env públicos, revocar secretos expuestos y usar un gestor de secretos.'] : []),
      'Aplicar mínimo privilegio, registros centralizados, alarmas y copias de seguridad con restauraciones verificadas.',
      'Definir RPO/RTO y objetivos de disponibilidad antes de seleccionar arquitectura y regiones AWS.'
    ]
    return { type: 'github', name: details.full_name, description: details.description || 'Sin descripción pública.', summary: `${details.full_name}: ${languageList.slice(0, 5).join(', ') || 'tecnologías no identificadas'}, ${paths.length} archivos en ${details.default_branch}.`, url: details.html_url, visibility: details.private ? 'Privado' : 'Público', stars: details.stargazers_count, updatedAt: details.updated_at, defaultBranch: details.default_branch, fileCount: paths.length, languages: languageList, technologies: languageList, recommendations: actions, suggestedServices: [...new Set(recommendations)], findings }
  }

  const response = await fetchPublicPage(url)
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? `El sitio bloqueó el análisis automático (HTTP ${response.status}).` : `El sitio respondió con HTTP ${response.status}.`)
  const contentType = response.headers.get('content-type') || ''
  const html = /text\/(html|xhtml)/i.test(contentType) || !contentType ? await readLimitedText(response) : ''
  const decode = (value = '') => value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim()
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '')) || url.hostname
  const descriptionTag = html.match(/<meta\b[^>]*>/gi)?.find(tag => /\bname\s*=\s*["']description["']/i.test(tag))
  const description = decode(descriptionTag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2] || '')
  const technologies = [...new Set([...(html.match(/(?:react|vue|angular|next|nuxt|wordpress|shopify|laravel|django|next\.js)/gi) || []).map(x => x.toLowerCase())])]
  const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch', 'Amazon CloudFront']
  if (/api|graphql/.test(html.toLowerCase())) recommendations.push('Amazon EC2', 'Amazon RDS')
  if (/wordpress|shopify|woocommerce|magento/.test(html.toLowerCase())) recommendations.push('Amazon S3', 'Amazon CloudFront')
  const findings = [response.headers.get('strict-transport-security') ? 'INFO · HSTS detectada.' : 'MEDIO · No se detectó HSTS; habilitar tras confirmar HTTPS en subdominios.', response.headers.get('content-security-policy') ? 'INFO · CSP detectada.' : 'MEDIO · No se detectó CSP; definirla primero en modo Report-Only.', response.headers.get('x-content-type-options') ? 'INFO · X-Content-Type-Options detectada.' : 'BAJO · No se detectó X-Content-Type-Options: nosniff.', response.headers.get('referrer-policy') ? 'INFO · Referrer-Policy detectada.' : 'BAJO · No se detectó Referrer-Policy.', technologies.length ? `INFO · Tecnologías visibles: ${technologies.join(', ')}.` : 'INFO · No fue posible identificar tecnología desde el HTML público.', `INFO · Respuesta HTTP ${response.status}; Content-Type ${contentType || 'no informado'}.`]
  const actions = [...(!response.headers.get('strict-transport-security') ? ['Verificar HTTPS y activar HSTS con max-age gradual.'] : []), ...(!response.headers.get('content-security-policy') ? ['Definir CSP compatible y probar primero con Report-Only.'] : []), ...(!response.headers.get('x-content-type-options') ? ['Añadir X-Content-Type-Options: nosniff.'] : []), ...(!response.headers.get('referrer-policy') ? ['Configurar Referrer-Policy restrictiva según las necesidades de la aplicación.'] : []), 'Revisar autenticación, autorización, dependencias, TLS, exposición de datos y APIs; no son observables solo desde una página pública.', 'Ejecutar pruebas autorizadas de seguridad y rendimiento en un entorno controlado.']
  return { type: 'website', name: title, description: description || 'No se encontró una descripción pública en la página.', summary: `Se revisó la respuesta HTTP ${response.status}, cabeceras de seguridad, metadatos HTML e indicadores tecnológicos públicos.`, url: url.href, status: response.status, contentType: contentType || 'No informado', technologies, recommendations: actions, suggestedServices: recommendations, findings }
}

const server = createServer((request, response) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin.replace(/\/$/, ''))) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const pathname = url.pathname.replace(/\/$/, '') || '/'
  if (request.method === 'POST' && pathname === '/analyze-project') {
    let body = ''
    request.on('data', chunk => { body += chunk; if (body.length > 10000) request.destroy() })
    request.on('end', async () => {
      try {
        const { url: projectUrl } = JSON.parse(body || '{}')
        if (typeof projectUrl !== 'string') throw new Error('Pega el enlace del proyecto que quieres analizar.')
        sendJson(response, 200, await analyzeProject(projectUrl.trim()))
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'No se pudo analizar el proyecto.' })
      }
    })
    return
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }
  if (pathname === '/health') {
    sendJson(response, 200, { status: 'ok', source: 'simulated', timestamp: new Date().toISOString() })
  } else if (pathname === '/overview') {
    sendJson(response, 200, generateDemoOverview())
  } else if (pathname === '/resources') {
    const region = url.searchParams.get('region') || 'us-east-1'
    sendJson(response, 200, generateDemoResources(region))
  } else if (pathname === '/costs') {
    sendJson(response, 200, generateDemoCosts())
  } else if (pathname === '/security/findings') {
    sendJson(response, 200, generateDemoSecurityFindings())
  } else {
    sendJson(response, 404, { error: 'Not found' })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`CloudOps API listening on port ${port} (simulated data)`)
})
