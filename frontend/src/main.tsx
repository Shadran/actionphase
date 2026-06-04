import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/datepicker.css'
import App from './App.tsx'
import { initFaro } from './lib/faro'

// Initialize Grafana Faro RUM before mounting React so all errors are captured.
initFaro()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
