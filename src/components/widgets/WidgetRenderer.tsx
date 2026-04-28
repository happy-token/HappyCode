import React from 'react'
import type { WidgetConfig } from '../../../electron/shared/types'
import { getWidget } from './widget-registry'
import { validateWidget } from './widget-schema'

export function WidgetRenderer({ config }: { config: WidgetConfig }): React.JSX.Element {
  const validation = validateWidget(config)
  if (!validation.success) {
    return <WidgetError config={config} error={validation.error} />
  }

  const Component = getWidget(config.type)
  if (!Component) {
    return <WidgetError config={config} error={`Unknown widget type: ${config.type}`} />
  }

  return <Component config={validation.data} />
}

function WidgetError({ config, error }: { config: WidgetConfig; error: string }): React.JSX.Element {
  return (
    <div className="widget-error">
      <div className="widget-error-title">Widget Error</div>
      <div className="widget-error-type">{config.type} — {config.title}</div>
      <div className="widget-error-message">{error}</div>
    </div>
  )
}
