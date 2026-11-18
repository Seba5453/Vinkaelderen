import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App.tsx'
import { createUpdateGate, onCellarScreen, watchForUpdates } from './pwa/updates'

// registerType "prompt": a new version waits until the gate says it is safe to
// reload (on Min Vinkælder), so an unsaved scan or chat is never wiped.
const gate = createUpdateGate({
  isSafe: () => onCellarScreen(location.hash),
  apply: () => { void updateSW(true) },
  doc: document,
  win: window,
})
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => gate.markPending(),
  onRegisteredSW(_url, reg) {
    if (reg) watchForUpdates(reg, document)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
