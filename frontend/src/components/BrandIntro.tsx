import { useEffect } from 'react'
import CloudOpsMark from './CloudOpsMark'

type BrandIntroProps = { onFinish: () => void }

export default function BrandIntro({ onFinish }: BrandIntroProps) {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(onFinish, reducedMotion ? 150 : 1850)
    return () => window.clearTimeout(timer)
  }, [onFinish])

  return (
    <div className="brand-intro" role="dialog" aria-modal="true" aria-label="Bienvenido a CloudOps">
      <div className="intro-glow intro-glow-one" />
      <div className="intro-glow intro-glow-two" />
      <div className="intro-grid" />
      <div className="intro-content">
        <div className="intro-orbit orbit-one"><i /><i /><i /></div>
        <div className="intro-orbit orbit-two"><i /><i /></div>
        <CloudOpsMark className="intro-logo" size={86} />
        <div className="intro-wordmark"><span>cloud</span><b>ops</b></div>
        <p className="intro-tagline">Diseña. Conecta. Observa.</p>
        <div className="intro-loading"><i /><i /><i /></div>
      </div>
      <span className="intro-caption">CLOUD ARCHITECTURE WORKSPACE</span>
      <button className="intro-skip" onClick={onFinish}>Omitir intro <span aria-hidden="true">→</span></button>
    </div>
  )
}
