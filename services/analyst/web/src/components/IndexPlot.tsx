import { useId } from 'react'
import { formatIndexLabel, formatNumber, formatReportingWindow } from '../format'
import type { IndicesResponse } from '../types'

type Series = IndicesResponse['series'][number]

export function IndexPlot({ series }: { series: Series }) {
  const id = useId()
  const points = series.points.filter((point): point is typeof point & { value: number } => typeof point.value === 'number' && Number.isFinite(point.value))
  const category = formatIndexLabel(series.category)
  const unit = series.unit ?? 'unit not recorded'
  const note = 'Only supplied finite values are plotted; missing windows are not estimated.'
  if (!points.length) return <p>No numeric values are available to plot. Missing values are not zero.</p>

  const minimum = Math.min(0, ...points.map(point => point.value))
  const maximum = Math.max(0, ...points.map(point => point.value))
  const span = maximum - minimum || 1
  const labelWidth = Math.max(160, ...points.map(point => formatReportingWindow(point.window).length * 8 + 24))
  const plotWidth = 360
  const width = labelWidth + plotWidth + 140
  const height = 62 + points.length * 46
  const position = (value: number) => labelWidth + ((value - minimum) / span) * plotWidth
  const description = `${points.map(point => `${formatReportingWindow(point.window)}: ${formatNumber(point.value)} ${unit}.`).join(' ')} ${note}`
  return <figure className="index-chart">
    <figcaption>Reporting window · {unit}</figcaption>
    <div className="index-chart-scroll" role="region" aria-label={`${category} plot, scroll horizontally for all values`} tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <title id={`${id}-title`}>{category} by reporting window</title>
        <desc id={`${id}-description`}>{description}</desc>
        <line className="index-chart-axis" x1={position(0)} y1={24} x2={position(0)} y2={height - 20} />
        {points.map((point, index) => {
          const y = 42 + index * 46
          return <g key={`${point.observation_id}-${index}`} data-window={point.window}>
            <text x={labelWidth - 16} y={y + 5} textAnchor="end">{formatReportingWindow(point.window)}</text>
            <rect x={Math.min(position(0), position(point.value))} y={y - 12} width={Math.abs(position(point.value) - position(0))} height={24} />
            {point.value === 0 && <circle cx={position(0)} cy={y} r={3} />}
            <text x={labelWidth + plotWidth + 16} y={y + 5}>{formatNumber(point.value)}</text>
          </g>
        })}
      </svg>
    </div>
    <p className="cell-meta">{note} Detailed values and their published sources follow.</p>
  </figure>
}
