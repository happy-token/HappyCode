import React from 'react'
import ReactDOM from 'react-dom/client'
import { enableMapSet } from 'immer'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import App from './App'
import './styles.css'

enableMapSet()

// Apply theme before first paint — URL param (preview window) takes priority over localStorage
const urlTheme = new URLSearchParams(window.location.search).get('theme')
const savedTheme = urlTheme ?? localStorage.getItem('happycode:theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)
document.documentElement.classList.toggle('dark', savedTheme === 'dark')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
