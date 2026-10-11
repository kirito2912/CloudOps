import { createContext, useContext, ReactNode } from 'react'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import type { Proposal } from '../types/cloud'

// Tipos de datos compartidos
export interface AppData {
  // Propuesta guardada
  proposal: Proposal | null
  setProposal: (proposal: Proposal) => void
  
  // Servicios seleccionados en planificación
  selectedServices: string[]
  setSelectedServices: (services: string[]) => void
  
  // Infraestructura desplegada por región
  deployedInfrastructure: Record<string, string[]>
  setDeployedInfrastructure: (infrastructure: Record<string, string[]>) => void
  
  // Cantidades de servicios para costos
  serviceCosts: Record<string, number>
  setServiceCosts: (costs: Record<string, number>) => void
  
  // Horas de operación mensual
  monthlyHours: number
  setMonthlyHours: (hours: number) => void
  
  // Controles de seguridad
  securityControls: any[]
  setSecurityControls: (controls: any[]) => void
  
  // Usuarios IAM
  iamUsers: any[]
  setIamUsers: (users: any[]) => void
}

const AppDataContext = createContext<AppData | undefined>(undefined)

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Estado centralizado - TODO se guarda en localStorage
  const [proposal, setProposal] = useLocalStorageState<Proposal | null>('cloudops-proposal', null)
  const [selectedServices, setSelectedServices] = useLocalStorageState<string[]>('cloudops-selected-services', [])
  const [deployedInfrastructure, setDeployedInfrastructure] = useLocalStorageState<Record<string, string[]>>('cloudops-infrastructure', {})
  const [serviceCosts, setServiceCosts] = useLocalStorageState<Record<string, number>>('cloudops-cost-quantities', {})
  const [monthlyHours, setMonthlyHours] = useLocalStorageState<number>('cloudops-cost-hours', 730)
  const [securityControls, setSecurityControls] = useLocalStorageState<any[]>('cloudops-security-controls', [])
  const [iamUsers, setIamUsers] = useLocalStorageState<any[]>('cloudops-iam-users', [])

  const value: AppData = {
    proposal,
    setProposal,
    selectedServices,
    setSelectedServices,
    deployedInfrastructure,
    setDeployedInfrastructure,
    serviceCosts,
    setServiceCosts,
    monthlyHours,
    setMonthlyHours,
    securityControls,
    setSecurityControls,
    iamUsers,
    setIamUsers,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (context === undefined) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return context
}
