import type { Service } from '../types/cloud'
export const awsServices: Service[] = [
  { name: 'Amazon EC2', category: 'Compute', description: 'Capacidad de cómputo redimensionable en la nube.', function: 'Aloja el backend y los procesos de la aplicación.', status: 'Activo', monthly: 86, icon: 'server', color: 'blue' },
  { name: 'Amazon S3', category: 'Storage', description: 'Almacenamiento de objetos con alta durabilidad.', function: 'Guarda archivos, documentos y respaldos.', status: 'Activo', monthly: 24, icon: 'database', color: 'green' },
  { name: 'Amazon RDS', category: 'Database', description: 'Bases de datos relacionales administradas.', function: 'Almacena datos transaccionales de la aplicación.', status: 'Activo', monthly: 112, icon: 'database', color: 'violet' },
  { name: 'AWS IAM', category: 'Security', description: 'Administra identidades y permisos de AWS.', function: 'Aplica acceso con mínimo privilegio y roles.', status: 'Activo', monthly: 0, icon: 'shield', color: 'amber' },
  { name: 'Amazon VPC', category: 'Networking', description: 'Red virtual aislada y configurable.', function: 'Segmenta subredes públicas y privadas.', status: 'Activo', monthly: 0, icon: 'network', color: 'cyan' },
  { name: 'Amazon Route 53', category: 'Networking', description: 'Servicio escalable de DNS y registro de dominios.', function: 'Enruta a las aplicaciones mediante DNS.', status: 'Activo', monthly: 2, icon: 'globe', color: 'orange' },
  { name: 'Amazon CloudFront', category: 'Networking', description: 'Red global de entrega de contenido (CDN).', function: 'Entrega contenido con menor latencia.', status: 'Planificado', monthly: 18, icon: 'cloud', color: 'pink' },
  { name: 'Amazon CloudWatch', category: 'Management', description: 'Observabilidad, métricas, registros y alarmas.', function: 'Monitorea recursos y detecta anomalías.', status: 'Planificado', monthly: 14, icon: 'activity', color: 'blue' },
]
export const regions = [
  { name: 'US East (N. Virginia)', code: 'us-east-1', city: 'N. Virginia, Estados Unidos', status: 'Principal', services: 7, latency: '32 ms', color: 'blue' },
  { name: 'South America (São Paulo)', code: 'sa-east-1', city: 'São Paulo, Brasil', status: 'DR / respaldo', services: 3, latency: '48 ms', color: 'green' },
  { name: 'Europe (Frankfurt)', code: 'eu-central-1', city: 'Frankfurt, Alemania', status: 'Disponible', services: 0, latency: '—', color: 'violet' },
  { name: 'Asia Pacific (Singapore)', code: 'ap-southeast-1', city: 'Singapur', status: 'Disponible', services: 0, latency: '—', color: 'orange' },
  { name: 'Asia Pacific (Tokyo)', code: 'ap-northeast-1', city: 'Tokio, Japón', status: 'Disponible', services: 0, latency: '—', color: 'pink' },
  { name: 'US West (Oregon)', code: 'us-west-2', city: 'Oregón, Estados Unidos', status: 'Disponible', services: 0, latency: '—', color: 'cyan' },
]

export const initialDeployments: Record<string, string[]> = {
  'us-east-1': ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'AWS IAM', 'Amazon VPC', 'Amazon Route 53', 'Amazon CloudFront'],
  'sa-east-1': ['Amazon S3', 'Amazon RDS', 'Amazon VPC'],
  'eu-central-1': [],
  'ap-southeast-1': [],
  'ap-northeast-1': [],
  'us-west-2': [],
}
