import React from 'react'
import DOMPurify from 'dompurify'
import type { ValidWidgetConfig } from '../widget-schema'

export function SvgWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const widgetCode = (config.data as { widget_code: string }).widget_code

  const sanitized = DOMPurify.sanitize(widgetCode, {
    ALLOWED_TAGS: ['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'defs', 'style', 'marker', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'filter', 'pattern', 'use', 'image', 'foreignObject', 'a', 'title', 'desc'],
    ALLOWED_ATTR: ['id', 'class', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'viewBox', 'd', 'points', 'href', 'xlink:href', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'filter', 'style'],
  })

  return (
    <div className="widget widget-svg">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">SVG</span>
      </div>
      <div
        className="widget-svg-container"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  )
}
