import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, CheckCircle2, CircleStop, Cloud, Database, Globe2, Layers3, LockKeyhole, Network, Play, RefreshCw, Server, ShieldCheck, Workflow } from 'lucide-react'
import { useAppData } from '../context/AppDataContext'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import { regions } from '../data/awsServices'

type Subnet = { id: string; name: string; cidr: string; kind: string; zone: string }
type Topology = { cidr: string; zones: string[]; subnets: Subnet[] }
type Simulation = { kind: 'failover' | 'transfer'; source: string; target: string; progress: number; status: 'running' | 'complete' }

export default function InteractiveNetwork() {
  const { proposal, selectedServices } = useAppData()
  const services = proposal?.services?.length ? proposal.services : selectedServices
  const regionCode = proposal?.region?.match(/[a-z]{2}-[a-z]+-\d/)?.[0] || 'us-east-1'
  const regionName = regions.find(region => region.code === regionCode)?.name || proposal?.region || regionCode
  const [topologies] = useLocalStorageState<Record<string, Topology>>('cloudops-region-topologies-v1', {})
  const zones = topologies[regionCode]?.zones ?? [`${regionCode}a`, `${regionCode}b`]
  const topology = topologies[regionCode] ?? { cidr: '10.0.0.0/16', zones, subnets: zones.flatMap((zone, index) => [
    { id: `${zone}-public`, name: `Pública · Aplicación ${index + 1}`, cidr: `10.0.${index * 10 + 1}.0/24`, kind: 'Publica', zone },
    { id: `${zone}-private`, name: `Privada · Datos ${index + 1}`, cidr: `10.0.${index * 10 + 2}.0/24`, kind: 'Privada', zone },
  ]) }
  const [sourceZone, setSourceZone] = useState(zones[0])
  const [targetZone, setTargetZone] = useState(zones[1] ?? zones[0])
  const [sourceServer, setSourceServer] = useState('app-01')
  const [targetServer, setTargetServer] = useState('app-02')
  const [transferSubnet, setTransferSubnet] = useState('')
  const [sourceSubnet, setSourceSubnet] = useState('')
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const activeServers = useMemo(() => topology.zones.map((zone, index) => ({ zone, name: `Servidor de aplicación ${String.fromCharCode(65 + index)}`, healthy: !(simulation?.kind === 'failover' && simulation.source === zone && simulation.status === 'complete') })), [topology.zones, simulation?.kind, simulation?.source, simulation?.status])
  const architecture = useMemo(() => {
    const nodes: Array<{ name: string; detail: string; icon: typeof Server; layer: string }> = [{ name: 'Usuarios', detail: 'Entrada HTTPS', icon: Globe2, layer: 'edge' }]
    if (services.some(item => /route 53|cloudfront/i.test(item))) nodes.push({ name: services.find(item => /route 53/i.test(item)) || services.find(item => /cloudfront/i.test(item)) || 'Amazon CloudFront', detail: 'DNS y distribución global', icon: Cloud, layer: 'edge' })
    if (services.some(item => /load balancer|alb|elb/i.test(item))) nodes.push({ name: services.find(item => /load balancer|alb|elb/i.test(item)) || 'Balanceador de carga', detail: 'Distribución entre zonas', icon: Network, layer: 'network' })
    const compute = services.filter(item => /ec2|lambda|ecs|eks|beanstalk/i.test(item))
    if (compute.length) nodes.push({ name: compute[0], detail: `Capa de aplicación · ${topology.zones.length} zonas`, icon: Server, layer: 'compute' })
    const databases = services.filter(item => /rds|dynamo|database|aurora|elasticache/i.test(item))
    if (databases.length) nodes.push({ name: databases[0], detail: 'Datos en subred privada', icon: Database, layer: 'data' })
    const storage = services.filter(item => /amazon s3|storage/i.test(item))
    if (storage.length) nodes.push({ name: storage[0], detail: 'Almacenamiento administrado', icon: Layers3, layer: 'data' })
    return nodes
  }, [services, topology.zones.length])
  useEffect(() => {
    if (!simulation || simulation.status === 'complete') return
    const timer = window.setInterval(() => setSimulation(current => {
      if (!current || current.status === 'complete') return current
      const progress = Math.min(current.progress + 5, 100)
      if (progress === 25 || progress === 55 || progress === 85 || progress === 100) setEvents(items => [`${new Date().toLocaleTimeString()} · ${progress === 100 ? 'Tráfico estable en destino.' : progress < 50 ? 'Health check detecta la ruta de origen.' : progress < 80 ? 'Enrutamiento actualizado; tráfico en tránsito.' : 'Destino saludable; validación de servicio.'}`, ...items].slice(0, 6))
      return { ...current, progress, status: progress === 100 ? 'complete' : 'running' }
    }), 220)
    return () => window.clearInterval(timer)
  }, [simulation?.status, simulation?.kind])
  useEffect(() => {
    if (!topology.subnets.some(subnet => subnet.id === transferSubnet && subnet.zone === targetZone)) setTransferSubnet('')
  }, [targetZone, topology.subnets, transferSubnet])
  useEffect(() => {
    if (!topology.subnets.some(subnet => subnet.id === sourceSubnet && subnet.zone === sourceZone)) setSourceSubnet('')
  }, [sourceZone, topology.subnets, sourceSubnet])

  const startFailover = () => {
    const target = topology.zones.find(zone => zone !== sourceZone) || sourceZone
    setEvents([`${new Date().toLocaleTimeString()} · Incidente simulado en ${sourceZone}.`, `${new Date().toLocaleTimeString()} · Se seleccionó ${target} por capacidad y salud.`])
    setTargetZone(target)
    setSimulation({ kind: 'failover', source: `${sourceZone} · ${sourceServer}`, target: `${target} · ${targetServer}`, progress: 0, status: 'running' })
  }
  const startTransfer = () => {
    if (sourceZone === targetZone) { setEvents(['Selecciona una zona de destino distinta a la zona de origen.']); return }
    const originSubnet = topology.subnets.find(subnet => subnet.id === sourceSubnet && subnet.zone === sourceZone) || topology.subnets.find(subnet => subnet.zone === sourceZone)
    const targetSubnet = topology.subnets.find(subnet => subnet.id === transferSubnet && subnet.zone === targetZone) || topology.subnets.find(subnet => subnet.zone === targetZone)
    const target = `${targetZone} · ${targetServer}${targetSubnet ? ` · ${targetSubnet.name}` : ''}`
    setEvents([`${new Date().toLocaleTimeString()} · Traslado manual iniciado desde ${sourceZone}.`, `${new Date().toLocaleTimeString()} · Red de destino ${targetSubnet?.cidr ?? topology.cidr} validada.`])
    setSimulation({ kind: 'transfer', source: `${sourceZone} · ${sourceServer}${originSubnet ? ` · ${originSubnet.name}` : ''}`, target, progress: 0, status: 'running' })
    setShowTransfer(false)
  }
  const resetSimulation = () => { setSimulation(null); setEvents([]) }

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> DISEÑO EMPRESARIAL <span className="eyebrow-sep">/</span> ARQUITECTURA</div><h1>Arquitectura de red</h1><p>Topología generada desde la propuesta y simulaciones de continuidad para {regionName}.</p></div><div className="heading-right"><span className="status-tag status-good"><span/>{simulation?.status === 'running' ? 'Simulación en curso' : 'Entorno de simulación'}</span></div></div>
    {!proposal && <div className="network-empty-proposal panel"><Workflow size={20}/><div><b>Aún no hay una propuesta guardada</b><p>Esta vista muestra una topología de demostración. Crea una propuesta para generar la arquitectura según los servicios, región y disponibilidad elegidos.</p></div></div>}
    <section className="panel topology-workspace"><div className="topology-head"><div><span className="section-overline">{proposal ? `PROPUESTA · ${proposal.name}` : 'VISTA PREVIA'} · {regionCode.toUpperCase()}</span><h2>{proposal?.appType || 'Arquitectura de ejemplo'} · {topology.zones.length} zonas</h2><p>VPC {topology.cidr} · {topology.subnets.length} subredes · {architecture.length} componentes · {proposal?.availability || 'Alta disponibilidad'}</p></div><div className="topology-tools"><button type="button" className="btn-outline" onClick={resetSimulation}><RefreshCw size={14}/> Restablecer simulación</button></div></div>
      <div className={`dynamic-topology ${simulation?.status === 'running' ? 'topology-simulating' : ''}`}>
        <div className="dynamic-flow"><article className="dynamic-node"><span className="dynamic-node-icon"><Globe2 size={18}/></span><b>Usuarios</b><small>Entrada HTTPS</small></article>{architecture.map((node, index) => { const Icon = node.icon; return <div className="dynamic-step" key={`${node.name}-${index}`}><div className={`dynamic-connector ${simulation?.status === 'running' ? 'connector-active' : ''}`}><i/><ArrowRight size={15}/></div><button type="button" className={`dynamic-node ${selectedNode === node.name ? 'selected' : ''}`} onClick={() => setSelectedNode(selectedNode === node.name ? '' : node.name)}><span className={`dynamic-node-icon layer-${node.layer}`}><Icon size={18}/></span><b>{node.name}</b><small>{node.detail}</small></button></div> })}</div>
        {selectedNode && <div className="dynamic-node-detail"><CheckCircle2 size={15}/><span><b>{selectedNode}</b><small>{architecture.find(node => node.name === selectedNode)?.detail}</small></span></div>}
        <div className="dynamic-vpc"><div className="dynamic-vpc-head"><span><Network size={15}/> VPC · {topology.cidr}</span><span><ShieldCheck size={14}/> {regionCode} · subredes privadas aisladas</span></div><div className="dynamic-zones">{topology.zones.map((zone, index) => { const server = activeServers[index]; const failedState = simulation?.kind === 'failover' && (simulation.status === 'running' || simulation.status === 'complete'); const isDown = failedState && simulation?.source.startsWith(zone); const isTarget = failedState && simulation?.target.startsWith(zone); const isTransferSource = simulation?.kind === 'transfer' && simulation.source.startsWith(zone); const isTransferTarget = simulation?.kind === 'transfer' && simulation.target.startsWith(zone); const subnets = topology.subnets.filter(subnet => subnet.zone === zone); const selectedServer = simulation?.kind === 'failover' && simulation.source.startsWith(zone) ? simulation.source.split('·')[1]?.trim() : isTransferSource ? simulation?.source.split('·')[1]?.trim() : isTransferTarget ? simulation?.target.split('·')[1]?.trim() : null; return <article className={`dynamic-zone ${isDown ? 'zone-failed' : ''} ${isTarget || isTransferTarget ? 'zone-target' : ''} ${isTransferSource ? 'zone-transfer-source' : ''}`} key={zone}><div className="dynamic-zone-head"><b>Zona de disponibilidad {zone.slice(-1).toUpperCase()}</b><span className={isDown ? 'health-failed' : 'health-okay'}>{isDown ? 'Falla simulada' : isTarget && simulation?.status === 'complete' ? 'Recibe tráfico' : isTransferTarget ? 'Destino del traslado' : 'Operativa'}</span></div>{subnets.map(subnet => <div className="dynamic-subnet" key={subnet.id}><span className="subnet-type-icon">{subnet.kind === 'Publica' ? <Globe2 size={13}/> : <LockKeyhole size={13}/>}</span><span><b>{subnet.name}</b><small>{subnet.cidr} · {subnet.kind === 'Publica' ? 'pública' : 'privada'}</small></span><i className="subnet-live-dot"/></div>)}<div className={`dynamic-server ${isDown ? 'server-failed' : ''} ${isTarget || isTransferTarget ? 'server-target' : ''}`}><Server size={16}/><span><b>{selectedServer ? `Servidor ${selectedServer}` : server?.name || `Servidor ${index + 1}`}</b><small>{isDown ? 'Sin respuesta · failover simulado' : isTarget && simulation?.status === 'complete' ? 'Activo · tráfico transferido' : isTransferSource ? 'Origen de la transferencia' : isTransferTarget ? 'Recibiendo datos simulados' : 'Listo para recibir tráfico'}</small></span><span className="server-status-dot"/></div></article> })}</div></div>
      </div>
      <div className="network-simulation-grid"><article className="simulation-card"><div className="simulation-card-heading"><span className="simulation-icon danger"><CircleStop size={17}/></span><div><b>Simular caída de servidor</b><p>Simula una falla y enruta solicitudes a otra zona saludable.</p></div></div><div className="simulation-controls"><label>Zona de origen<select value={sourceZone} onChange={event => setSourceZone(event.target.value)}>{topology.zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label><label>Servidor afectado<select value={sourceServer} onChange={event => setSourceServer(event.target.value)}><option value="app-01">Servidor de aplicación 01</option><option value="app-02">Servidor de aplicación 02</option></select></label><button type="button" className="btn-primary" disabled={simulation?.status === 'running' || topology.zones.length < 2} onClick={startFailover}><Play size={14}/> Simular caída</button></div><small className="simulation-note">No se modifica AWS ni se apaga un servidor real; es una simulación visual.</small></article>
        <article className="simulation-card"><div className="simulation-card-heading"><span className="simulation-icon transfer"><Workflow size={17}/></span><div><b>Simular traslado de información</b><p>Elige servidor, zona y subred de destino sin provocar una caída.</p></div></div>{showTransfer ? <div className="transfer-controls"><label>Zona de origen<select value={sourceZone} onChange={event => setSourceZone(event.target.value)}>{topology.zones.map(zone => <option key={zone}>{zone}</option>)}</select></label><label>Servidor de origen<select value={sourceServer} onChange={event => setSourceServer(event.target.value)}><option value="app-01">Servidor de aplicación 01</option><option value="app-02">Servidor de aplicación 02</option></select></label><label>Zona de destino<select value={targetZone} onChange={event => setTargetZone(event.target.value)}>{topology.zones.map(zone => <option key={zone}>{zone}</option>)}</select></label><label>Servidor de destino<select value={targetServer} onChange={event => setTargetServer(event.target.value)}><option value="app-01">Servidor de aplicación 01</option><option value="app-02">Servidor de aplicación 02</option></select></label><label className="transfer-subnet-select">Red de origen<select value={sourceSubnet} onChange={event => setSourceSubnet(event.target.value)}><option value="">Automatica por zona</option>{topology.subnets.filter(subnet => subnet.zone === sourceZone).map(subnet => <option key={subnet.id} value={subnet.id}>{subnet.name} - {subnet.cidr}</option>)}</select></label><label className="transfer-subnet-select">Subred de destino<select value={transferSubnet} onChange={event => setTransferSubnet(event.target.value)}><option value="">Automática por zona</option>{topology.subnets.filter(subnet => subnet.zone === targetZone).map(subnet => <option key={subnet.id} value={subnet.id}>{subnet.name} · {subnet.cidr}</option>)}</select></label><button type="button" className="btn-primary" disabled={simulation?.status === 'running'} onClick={startTransfer}><Play size={14}/> Iniciar traslado</button></div> : <button type="button" className="btn-outline transfer-open" onClick={() => setShowTransfer(true)}><ArrowRight size={14}/> Elegir zona y red</button>}<small className="simulation-note">La transferencia es una simulación local y no mueve datos reales.</small></article></div>
      {simulation && <section className="simulation-progress panel"><div className="simulation-progress-head"><span><Activity size={15}/>{simulation.kind === 'failover' ? 'Failover automático' : 'Traslado manual'} · {simulation.source} → {simulation.target}</span><b>{simulation.status === 'complete' ? 'Completado' : 'En tránsito'} · {simulation.progress}%</b></div><div className="simulation-progress-track"><i style={{ width: `${simulation.progress}%` }}/></div><div className="simulation-events">{events.map((event, index) => <span key={`${event}-${index}`}><CheckCircle2 size={12}/>{event}</span>)}</div></section>}
      <div className="network-subnet-summary"><div><Layers3 size={16}/><b>Subredes configuradas para esta propuesta</b><span>{topology.subnets.length}</span></div><div className="network-subnet-chips">{topology.subnets.map(subnet => <span key={subnet.id} className={subnet.kind === 'Publica' ? 'subnet-chip-public' : 'subnet-chip-private'}>{subnet.kind === 'Publica' ? <Globe2 size={12}/> : <LockKeyhole size={12}/>} {subnet.name} · {subnet.zone}</span>)}{!topology.subnets.length && <small>Configura subredes en Infraestructura global.</small>}</div></div>
    </section>
    <div className="network-info-grid"><article className="info-card"><span className="network-info-icon blue-soft"><ShieldCheck size={18}/></span><div><b>La topología sigue la propuesta</b><p>Los componentes, la región, la disponibilidad y las subredes se actualizan desde la solución seleccionada.</p></div></article><article className="info-card"><span className="network-info-icon green-soft"><Activity size={18}/></span><div><b>Simulaciones sin impacto en producción</b><p>Los controles demuestran failover y transferencia con una secuencia de eventos, sin cambiar recursos AWS.</p></div></article></div>
  </>
}
