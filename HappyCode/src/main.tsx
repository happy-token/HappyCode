import React from 'react'
import ReactDOM from 'react-dom/client'
import { enableMapSet } from 'immer'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import App from './App'
import './styles.css'

enableMapSet()

// Apply saved theme before first paint to avoid flash
const savedTheme = localStorage.getItem('happycode:theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
