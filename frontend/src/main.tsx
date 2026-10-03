import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BrandIntro from './components/BrandIntro'
import './styles.css'
import './styles-interactive.css'
import './styles-catalog.css'
import './styles-network.css'
import './styles-backend.css'
import './styles-brand.css'

function CloudOpsExperience() {
  const [showIntro, setShowIntro] = useState(() => {
    try { return !sessionStorage.getItem('cloudops-intro-seen') } catch { return false }
  })
  const finishIntro = useCallback(() => setShowIntro(false), [])

  useEffect(() => {
    if (showIntro) {
      try { sessionStorage.setItem('cloudops-intro-seen', 'true') } catch { /* Intro still works without session storage. */ }
    }
  }, [showIntro])

  return <><App />{showIntro && <BrandIntro onFinish={finishIntro} />}</>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><CloudOpsExperience /></BrowserRouter></React.StrictMode>)
