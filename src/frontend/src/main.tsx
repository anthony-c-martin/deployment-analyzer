import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeInterop } from './interop.ts'

const interop = await initializeInterop(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App interop={interop} />
  </StrictMode>,
)
