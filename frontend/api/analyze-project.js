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
    const [languages, readmeResponse] = await Promise.all([
      githubJson(details.languages_url).catch(() => ({})),
      fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/readme`, { headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'CloudOps-Project-Analyzer' }, signal: AbortSignal.timeout(12000) }).catch(() => null),
    ])
    const readme = readmeResponse?.ok ? await readmeResponse.text() : ''
    const languageList = Object.keys(languages)
    const text = `${details.description || ''} ${readme}`.toLowerCase()
    const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch']
    if (/react|vue|angular|next|web|frontend/.test(text) || languageList.some(name => ['JavaScript', 'TypeScript', 'HTML', 'CSS'].includes(name))) recommendations.push('Amazon CloudFront', 'Amazon S3')
    if (/api|express|django|fastapi|spring|backend|node/.test(text) || languageList.some(name => ['Python', 'Java', 'Go', 'Ruby'].includes(name))) recommendations.push('Amazon EC2', 'Amazon RDS')
    if (/data|analytics|machine learning|dataset/.test(text)) recommendations.push('Amazon S3')
    return { type: 'github', name: details.full_name, description: details.description || 'Sin descripción pública.', url: details.html_url, visibility: details.private ? 'Privado' : 'Público', stars: details.stargazers_count, updatedAt: details.updated_at, languages: languageList, recommendations: [...new Set(recommendations)], findings: [details.archived ? 'El repositorio está archivado; confirma si sigue en mantenimiento.' : 'Repositorio accesible y activo para una evaluación inicial.', languageList.length ? `Tecnologías detectadas: ${languageList.slice(0, 6).join(', ')}.` : 'No se detectaron lenguajes en los archivos del repositorio.'] }
  }

  let response
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    url = await validatePublicUrl(url.href)
    response = await fetch(url, { headers: { 'User-Agent': 'CloudOps-Project-Analyzer' }, signal: AbortSignal.timeout(12000), redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (!location || redirects === 4) throw new Error('El sitio redirigió demasiadas veces para analizarlo de forma segura.')
    url = new URL(location, url)
  }
  if (!response?.ok) throw new Error(`El sitio respondió con HTTP ${response?.status || 502}.`)
  const contentType = response.headers.get('content-type') || ''
  const html = contentType.includes('text/html') ? (await response.text()).slice(0, 500000) : ''
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || url.hostname
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || ''
  const technologies = [...new Set([...(html.match(/(?:react|vue|angular|next|nuxt|wordpress|shopify|laravel|django|next\.js)/gi) || []).map(name => name.toLowerCase())])]
  const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch', 'Amazon CloudFront']
  if (/api|graphql/.test(html.toLowerCase())) recommendations.push('Amazon EC2', 'Amazon RDS')
  return { type: 'website', name: title, description: description || 'No se encontró una descripción pública en la página.', url: url.href, status: response.status, contentType: contentType || 'No informado', technologies, recommendations, findings: [response.headers.get('strict-transport-security') ? 'Se detectó una política HSTS.' : 'No se detectó la cabecera HSTS en la respuesta.', response.headers.get('content-security-policy') ? 'Se detectó una política CSP.' : 'No se detectó la cabecera CSP en la respuesta.', technologies.length ? `Indicadores tecnológicos en HTML: ${technologies.join(', ')}.` : 'La tecnología no se pudo identificar solo desde el HTML público.'] }
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
