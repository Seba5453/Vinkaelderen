import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App.tsx'
import { watchForUpdates } from './pwa/updates'

registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    reg.update().catch(() => {})
    watchForUpdates(reg, document)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
