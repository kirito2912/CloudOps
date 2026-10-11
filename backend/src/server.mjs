import { createServer } from 'node:http'

const port = Number(process.env.PORT || 3001)
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

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

const server = createServer((request, response) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
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
