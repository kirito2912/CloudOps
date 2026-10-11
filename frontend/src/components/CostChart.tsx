import { useEffect, useState } from 'react'
import { cloudApiGet } from '../services/cloudApi'

type CostChartProps = { period: string }

export default function CostChart({ period }: CostChartProps) {
  const [costData, setCostData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_CLOUD_API_URL
    if (!apiUrl) {
      setLoading(false)
      return
    }

    cloudApiGet<any>('/costs')
      .then(data => {
        setCostData(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  // Fallback a datos estáticos si no hay API
  const defaultData = {
    monthlyHistory: [
      { month: '2024-05', total: 242 },
      { month: '2024-06', total: 230 },
      { month: '2024-07', total: 235 },
      { month: '2024-08', total: 271 },
      { month: '2024-09', total: 252 },
      { month: '2024-10', total: 265 },
    ]
  }

  const data = costData || defaultData
  const history = data.monthlyHistory || []
  
  // Tomar últimos 6 o 12 meses según período
  const monthsToShow = period === 'Last 12 months' ? 12 : 6
  const recentHistory = history.slice(-monthsToShow)
  
  // Calcular total
  const total = recentHistory.reduce((sum: number, item: any) => sum + item.total, 0)
  
  // Generar puntos para el gráfico (normalizar a escala 0-150)
  const maxValue = Math.max(...recentHistory.map((item: any) => item.total), 400)
  const points = recentHistory.map((item: any, index: number) => {
    const x = (index / (recentHistory.length - 1)) * 550
    const y = 150 - (item.total / maxValue) * 150
    return `${x},${y}`
  }).join(' ')
  
  // Área del gráfico
  const area = `0,150 ${points} 550,150`
  
  // Labels de meses
  const labels = recentHistory.map((item: any) => {
    const date = new Date(item.month + '-01')
    return date.toLocaleDateString('es', { month: 'short' }).replace('.', '')
  })
  
  // Último punto para el círculo
  const lastPoint = recentHistory.length > 0 
    ? 150 - (recentHistory[recentHistory.length - 1].total / maxValue) * 150 
    : 20

  const title = period === 'Last 12 months' ? 'Gasto de los últimos 12 meses' : 'Gasto de los últimos 6 meses'

  if (loading) {
    return <div className="chart-wrap compact-chart"><div className="chart-summary"><div><span>{title}</span><b>Cargando...</b></div></div></div>
  }

  return <div className="chart-wrap compact-chart"><div className="chart-summary"><div><span>{title}{costData?.source === 'simulated' && ' (demo)'}</span><b>$ {total.toFixed(2)} <small>USD</small></b></div><div className="chart-legend"><span><i/> Actual</span><span><i/> Proyección</span></div></div><div className="chart-canvas"><div className="chart-y"><span>$400</span><span>$300</span><span>$200</span><span>$100</span><span>$0</span></div><svg viewBox="0 0 550 160" preserveAspectRatio="none" role="img" aria-label={title}><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".17"/><stop offset="1" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>{[25,55,85,115,145].map(y=><line key={y} x1="0" x2="550" y1={y} y2={y} stroke="currentColor" strokeOpacity=".09" strokeDasharray="4 5"/>)}<polygon points={area} fill="url(#areaFill)"/><polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/><circle cx={550} cy={lastPoint} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="3"/></svg></div><div className="chart-x">{labels.map((label, i)=><span key={i}>{label}</span>)}</div></div>
}
