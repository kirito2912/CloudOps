export type Service = { name: string; category: string; description: string; function: string; status: 'Activo' | 'Planificado'; monthly: number; icon: string; color: string }
export type Proposal = { name: string; appType: string; description: string; region: string; users: number; availability: string; services: string[]; migration: string }
