/**
 * Browser-side API client. AWS credentials must remain on a trusted backend;
 * this client only calls the app's API (for example API Gateway + Lambda).
 */
const apiBaseUrl = import.meta.env.VITE_CLOUD_API_URL?.replace(/\/$/, '')

export type CloudApiStatus = 'not-configured' | 'available' | 'unavailable'

export function getCloudApiStatus(): CloudApiStatus {
  return apiBaseUrl ? 'available' : 'not-configured'
}

export async function cloudApiGet<T>(path: string, accessToken?: string): Promise<T> {
  if (!apiBaseUrl) throw new Error('VITE_CLOUD_API_URL no está configurada.')
  const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`La API respondió con estado ${response.status}.`)
  return response.json() as Promise<T>
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_CLOUD_API_URL?: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
