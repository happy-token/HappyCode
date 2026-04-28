import React from 'react'
import { AppShell } from './AppShell'
import { PreviewWindow } from './components/file-browser/PreviewWindow'

export default function App(): React.JSX.Element {
  const isPreview = new URLSearchParams(window.location.search).get('window') === 'preview'
  return isPreview ? <PreviewWindow /> : <AppShell />
}
