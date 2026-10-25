import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readAuthFromHash } from './auth.ts'
import { desktop } from './desktop.ts'

// save a fresh Spotify login before anything renders (the desktop login window closes right after)
readAuthFromHash()
if (desktop) document.documentElement.classList.add('is-desktop')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
