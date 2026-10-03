type CostChartProps = { period: string }

const periods = {
  'Last 6 months': { title: 'Gasto de los últimos 6 meses', total: '1,452.00', points: '0,122 50,106 100,111 150,71 200,82 250,55 300,64 350,39 400,49 450,20 500,33 550,12', labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'] },
  'Last 12 months': { title: 'Gasto de los últimos 12 meses', total: '2,890.00', points: '0,138 50,129 100,117 150,126 200,98 250,105 300,76 350,87 400,58 450,63 500,32 550,17', labels: ['Nov', 'Jan', 'Mar', 'May', 'Jul', 'Oct'] },
}

export default function CostChart({ period }: CostChartProps) {
  const selected = period === 'Last 12 months' ? periods['Last 12 months'] : periods['Last 6 months']
  const area = `0,150 ${selected.points} 550,150`
  return <div className="chart-wrap compact-chart"><div className="chart-summary"><div><span>{selected.title}</span><b>$ {selected.total} <small>USD</small></b></div><div className="chart-legend"><span><i/> Actual</span><span><i/> Proyección</span></div></div><div className="chart-canvas"><div className="chart-y"><span>$400</span><span>$300</span><span>$200</span><span>$100</span><span>$0</span></div><svg viewBox="0 0 550 160" preserveAspectRatio="none" role="img" aria-label={selected.title}><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".17"/><stop offset="1" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>{[25,55,85,115,145].map(y=><line key={y} x1="0" x2="550" y1={y} y2={y} stroke="currentColor" strokeOpacity=".09" strokeDasharray="4 5"/>)}<polygon points={area} fill="url(#areaFill)"/><polyline points={selected.points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/><polyline points={selected.points.split(' ').slice(-5).join(' ')} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5"/><circle cx="450" cy={period === 'Last 12 months' ? '63' : '20'} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="3"/></svg></div><div className="chart-x">{selected.labels.map(label=><span key={label}>{label}</span>)}</div></div>
}
