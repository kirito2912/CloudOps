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
    const response = await fetch(url, { headers: { 'User-Agent': 'CloudOps-Project-Analyzer' }, signal: AbortSignal.timeout(12000), redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    if (!location || redirects === 4) throw new Error('El sitio redirigió demasiadas veces para analizarlo de forma segura.')
    url = new URL(location, url)
  }
  throw new Error('No se pudo seguir la redirección del sitio.')
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
    const [languages, readme] = await Promise.all([
      getJson(details.languages_url, headers).catch(() => ({})),
      fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' }, signal: AbortSignal.timeout(12000), redirect: 'error' }).then(r => r.ok ? r.text() : '').catch(() => ''),
    ])
    const languageList = Object.keys(languages)
    const text = `${details.description || ''} ${readme}`.toLowerCase()
    const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch']
    if (/react|vue|angular|next|web|frontend/.test(text) || languageList.some(x => ['JavaScript', 'TypeScript', 'HTML', 'CSS'].includes(x))) recommendations.push('Amazon CloudFront', 'Amazon S3')
    if (/api|express|django|fastapi|spring|backend|node/.test(text) || languageList.some(x => ['Python', 'Java', 'Go', 'Ruby'].includes(x))) recommendations.push('Amazon EC2', 'Amazon RDS')
    if (/data|analytics|machine learning|dataset/.test(text)) recommendations.push('Amazon S3')
    return { type: 'github', name: details.full_name, description: details.description || 'Sin descripción pública.', url: details.html_url, visibility: details.private ? 'Privado' : 'Público', stars: details.stargazers_count, updatedAt: details.updated_at, languages: languageList, recommendations: [...new Set(recommendations)], findings: [details.archived ? 'El repositorio está archivado; confirma si sigue en mantenimiento.' : 'Repositorio accesible y activo para una evaluación inicial.', languageList.length ? `Tecnologías detectadas: ${languageList.slice(0, 6).join(', ')}.` : 'No se detectaron lenguajes en los archivos del repositorio.'] }
  }

  const response = await fetchPublicPage(url)
  if (!response.ok) throw new Error(`El sitio respondió con HTTP ${response.status}.`)
  const contentType = response.headers.get('content-type') || ''
  const html = contentType.includes('text/html') ? (await response.text()).slice(0, 500000) : ''
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || url.hostname
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || ''
  const technologies = [...new Set([...(html.match(/(?:react|vue|angular|next|nuxt|wordpress|shopify|laravel|django|next\.js)/gi) || []).map(x => x.toLowerCase())])]
  const recommendations = ['AWS IAM', 'Amazon VPC', 'Amazon CloudWatch', 'Amazon CloudFront']
  if (/api|graphql/.test(html.toLowerCase())) recommendations.push('Amazon EC2', 'Amazon RDS')
  return { type: 'website', name: title, description: description || 'No se encontró una descripción pública en la página.', url: url.href, status: response.status, contentType: contentType || 'No informado', technologies, recommendations, findings: [response.headers.get('strict-transport-security') ? 'Se detectó una política HSTS.' : 'No se detectó la cabecera HSTS en la respuesta.', response.headers.get('content-security-policy') ? 'Se detectó una política CSP.' : 'No se detectó la cabecera CSP en la respuesta.', technologies.length ? `Indicadores tecnológicos en HTML: ${technologies.join(', ')}.` : 'La tecnología no se pudo identificar solo desde el HTML público.'] }
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
  if (request.method === 'POST' && url.pathname === '/analyze-project') {
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
  if (url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok', source: 'simulated', timestamp: new Date().toISOString() })
  } else if (url.pathname === '/overview') {
    sendJson(response, 200, generateDemoOverview())
  } else if (url.pathname === '/resources') {
    const region = url.searchParams.get('region') || 'us-east-1'
    sendJson(response, 200, generateDemoResources(region))
  } else if (url.pathname === '/costs') {
    sendJson(response, 200, generateDemoCosts())
  } else if (url.pathname === '/security/findings') {
    sendJson(response, 200, generateDemoSecurityFindings())
  } else {
    sendJson(response, 404, { error: 'Not found' })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`CloudOps API listening on port ${port} (simulated data)`)
})
