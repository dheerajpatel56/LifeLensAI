/**
 * Chart components. Every one renders its own empty state rather than drawing a
 * flat zero line when data is missing, and every one states its sample size.
 * Colours and sizes follow the chart rules in DESIGN.md.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type {
  ClusterDistributionItem,
  ProjectionPoint,
  ScatterSeries,
  TrendPoint,
} from '../../types/api'
import { EmptyState, SampleSize } from '../ui'
import { formatShortDate } from '../../utils/format'

// Categorical series order. Functional, not decorative: each step is
// distinguishable in both hue and lightness so series stay separable.
export const SERIES_COLORS = [
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-positive)',
  'var(--color-violet)',
  'var(--color-cyan)',
  'var(--color-negative)',
  'var(--color-line-strong)',
  'var(--color-faint)',
]

const AXIS = {
  stroke: 'var(--color-line)',
  tick: { fill: 'var(--color-muted)', fontSize: 12 },
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-line-strong)',
    borderRadius: 4,
    fontSize: 12,
    color: 'var(--color-ink)',
    boxShadow: '0 2px 6px -2px rgb(0 0 0 / 0.5)',
  },
  labelStyle: { color: 'var(--color-muted)', fontSize: 11, marginBottom: 4 },
  itemStyle: { color: 'var(--color-body)' },
}

export function ChartFrame({
  title,
  caption,
  sampleSize,
  children,
  className,
}: {
  title: string
  caption?: ReactNode
  sampleSize?: number | null
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={clsx('m-0 flex min-w-0 flex-col gap-2', className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        <SampleSize n={sampleSize ?? undefined} />
      </figcaption>
      {children}
      {caption && <p className="measure text-xs text-muted">{caption}</p>}
    </figure>
  )
}

// --------------------------------------------------------------------------- //
// Trend
// --------------------------------------------------------------------------- //
const TREND_SERIES: Array<{ key: keyof TrendPoint; label: string; color: string }> = [
  { key: 'mood_score', label: 'Mood', color: 'var(--color-accent)' },
  { key: 'productivity_score', label: 'Productivity', color: 'var(--color-warning)' },
  { key: 'sleep_hours', label: 'Sleep (h)', color: 'var(--color-positive)' },
  { key: 'stress_score', label: 'Stress', color: 'var(--color-negative)' },
]

export function TrendLineChart({
  points,
  series = ['mood_score', 'productivity_score'],
  height = 280,
}: {
  points: TrendPoint[]
  series?: Array<keyof TrendPoint>
  height?: number
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        title="No trend to draw yet"
        description="A trend needs at least a couple of recorded days inside the selected range."
      />
    )
  }

  const active = TREND_SERIES.filter((entry) => series.includes(entry.key))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          stroke={AXIS.stroke}
          tick={AXIS.tick}
          minTickGap={28}
        />
        <YAxis stroke={AXIS.stroke} tick={AXIS.tick} domain={[0, 'auto']} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(value) => formatShortDate(String(value))}
          formatter={(value, name) => [value === null ? '—' : value, String(name)]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--color-muted)', paddingTop: 8 }}
          iconType="plainline"
        />
        {active.map((entry) => (
          <Line
            key={String(entry.key)}
            type="monotone"
            dataKey={entry.key as string}
            name={entry.label}
            stroke={entry.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// --------------------------------------------------------------------------- //
// Scatter
// --------------------------------------------------------------------------- //
export function RelationScatter({
  series,
  height = 260,
  color = 'var(--color-accent)',
}: {
  series: ScatterSeries | null
  height?: number
  color?: string
}) {
  if (!series || series.points.length === 0) {
    return (
      <EmptyState
        title="Nothing to plot"
        description="This chart needs days where both variables were recorded."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 16 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis
          type="number"
          dataKey="x"
          name={series.x_label}
          stroke={AXIS.stroke}
          tick={AXIS.tick}
          domain={['dataMin - 0.5', 'dataMax + 0.5']}
          label={{
            value: series.x_label,
            position: 'insideBottom',
            offset: -8,
            fill: 'var(--color-muted)',
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={series.y_label}
          stroke={AXIS.stroke}
          tick={AXIS.tick}
          domain={['dataMin - 0.5', 'dataMax + 0.5']}
        />
        <ZAxis range={[26, 26]} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [value, String(name)]}
          labelFormatter={() => ''}
        />
        <Scatter data={series.points} fill={color} fillOpacity={0.5} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// --------------------------------------------------------------------------- //
// Cluster projection
// --------------------------------------------------------------------------- //
export function ClusterProjectionChart({
  points,
  labels,
  height = 320,
}: {
  points: ProjectionPoint[]
  labels: Record<number, string>
  height?: number
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        title="No projection available"
        description="A 2D projection needs at least two varying features and a handful of records."
      />
    )
  }

  const groups = Object.entries(
    points.reduce<Record<number, ProjectionPoint[]>>((acc, point) => {
      acc[point.cluster_id] = acc[point.cluster_id] ?? []
      acc[point.cluster_id].push(point)
      return acc
    }, {}),
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-line)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Component 1"
          stroke={AXIS.stroke}
          tick={AXIS.tick}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Component 2"
          stroke={AXIS.stroke}
          tick={AXIS.tick}
        />
        <ZAxis range={[24, 24]} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: unknown, name) => [Number(value).toFixed(2), String(name)]}
          labelFormatter={() => ''}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-muted)', paddingTop: 4 }} />
        {groups.map(([clusterId, clusterPoints], index) => (
          <Scatter
            key={clusterId}
            name={labels[Number(clusterId)] ?? `Group ${clusterId}`}
            data={clusterPoints}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            fillOpacity={0.6}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// --------------------------------------------------------------------------- //
// Cluster size distribution
// --------------------------------------------------------------------------- //
export function ClusterDistributionChart({
  items,
  height = 220,
}: {
  items: ClusterDistributionItem[]
  height?: number
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No routine groups yet"
        description="Clustering needs at least 10 complete records in the selected range."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" horizontal={false} />
        <XAxis type="number" stroke={AXIS.stroke} tick={AXIS.tick} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          stroke={AXIS.stroke}
          tick={{ ...AXIS.tick, width: 130 }}
          width={140}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value) => [`${value} day(s)`, 'Size']}
        />
        <Bar dataKey="size" radius={[0, 2, 2, 0]} maxBarSize={22}>
          {items.map((item, index) => (
            <Cell key={item.cluster_id} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --------------------------------------------------------------------------- //
// Rule chart
// --------------------------------------------------------------------------- //
export function RuleLiftChart({
  rules,
  height = 300,
}: {
  rules: Array<{ label: string; lift: number; confidence: number }>
  height?: number
}) {
  if (rules.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rules} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" horizontal={false} />
        <XAxis type="number" stroke={AXIS.stroke} tick={AXIS.tick} domain={[0, 'auto']} />
        <YAxis
          type="category"
          dataKey="label"
          stroke={AXIS.stroke}
          tick={{ ...AXIS.tick, fontSize: 11 }}
          width={210}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: unknown, name) => [Number(value).toFixed(2), String(name)]}
        />
        <Bar dataKey="lift" name="Lift" fill="var(--color-accent)" radius={[0, 2, 2, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
