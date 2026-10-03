import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(new URL('./frontend/package.json', import.meta.url))
const viteCli = resolve(dirname(require.resolve('vite')), '../../bin/vite.js')
const common = { stdio: 'inherit' }
const children = [
  spawn(process.execPath, [viteCli, '--host', '0.0.0.0'], {
    ...common,
    cwd: new URL('./frontend', import.meta.url),
    env: { ...process.env, VITE_CLOUD_API_URL: 'http://localhost:3001' },
  }),
  spawn(process.execPath, ['src/server.mjs'], {
    ...common,
    cwd: new URL('./backend', import.meta.url),
  }),
]

let stopping = false
function stopAll(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = exitCode
}

for (const child of children) {
  child.on('error', error => {
    console.error('Could not start a CloudOps service:', error.message)
    stopAll(1)
  })
  child.on('exit', code => {
    if (!stopping && code !== 0) stopAll(code ?? 1)
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
console.log('Starting frontend and demo API. Press Ctrl+C to stop both.')
