import { createServer } from 'node:http'

const port = Number(process.env.PORT || 3001)
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const demoOverview = {
  source: 'simulated',
  account: 'Cuenta educativa de ejemplo',
  region: 'us-east-1',
  monthlyCostUsd: 242,
  deployedRegions: 2,
  services: 7,
  updatedAt: new Date().toISOString(),
}

const demoResources = {
  source: 'simulated',
  region: 'us-east-1',
  resources: [
    { id: 'demo-ec2-1', type: 'Amazon EC2', state: 'running' },
    { id: 'demo-rds-1', type: 'Amazon RDS', state: 'available' },
    { id: 'demo-s3-1', type: 'Amazon S3', state: 'available' },
  ],
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
    sendJson(response, 200, { status: 'ok', source: 'simulated' })
  } else if (url.pathname === '/overview') {
    sendJson(response, 200, demoOverview)
  } else if (url.pathname === '/resources') {
    sendJson(response, 200, { ...demoResources, region: url.searchParams.get('region') || demoResources.region })
  } else if (url.pathname === '/costs') {
    sendJson(response, 200, { source: 'simulated', currency: 'USD', monthlyTotal: 242, items: [] })
  } else if (url.pathname === '/security/findings') {
    sendJson(response, 200, { source: 'simulated', findings: [{ id: 'demo-key-rotation', severity: 'medium', status: 'review' }] })
  } else {
    sendJson(response, 404, { error: 'Not found' })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`CloudOps API listening on port ${port} (simulated data)`)
})
