import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { api } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import {
  Block,
  Canvas,
  Rail,
  RailGroup,
  Readout,
  Split,
} from '../components/layout/Workspace'
import {
  Badge,
  Button,
  Callout,
  ChartSkeleton,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  SampleSize,
  Select,
} from '../components/ui'
import { ClusterProjectionChart, RuleLiftChart, SERIES_COLORS } from '../components/charts'
import { CorrelationHeatmap } from '../components/patterns/CorrelationHeatmap'
import { evidenceLabel, formatPercent, formatSigned } from '../utils/format'
import { canAnimate, enterPanel, exitPanel, moveIndicator, settle } from '../utils/motion'
import type { CorrelationMethod, CorrelationPair } from '../types/api'

type Tab = 'clusters' | 'correlations' | 'rules'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'clusters', label: 'Clustering' },
  { id: 'correlations', label: 'Correlation' },
  { id: 'rules', label: 'Association rules' },
]

const EVIDENCE_TONE = {
  reasonable: 'positive',
  limited: 'warning',
  insufficient: 'negative',
} as const

export function PatternsPage() {
  const { dataset, filter, version } = useDataset()
  const [tab, setTab] = useState<Tab>('clusters')

  // Tab motion: an underline that travels to the selected tab, and a panel that
  // enters from the direction of travel. Both no-op under prefers-reduced-motion.
  const tabStripRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const panelRef = useRef<HTMLDivElement>(null)
  const previousIndex = useRef(0)

  const activeIndex = TABS.findIndex((entry) => entry.id === tab)

  /** The rail stacks above the canvas below 1024px, where the strip is horizontal. */
  const indicatorAxis = (): 'x' | 'y' =>
    window.matchMedia('(min-width: 1024px)').matches ? 'y' : 'x'

  useLayoutEffect(() => {
    moveIndicator(indicatorRef.current, tabRefs.current[tab], tabStripRef.current, indicatorAxis())
  }, [tab])

  useEffect(() => {
    const onResize = () =>
      moveIndicator(indicatorRef.current, tabRefs.current[tab], tabStripRef.current, indicatorAxis())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tab])

  useEffect(() => {
    const direction = Math.sign(activeIndex - previousIndex.current)
    previousIndex.current = activeIndex
    enterPanel(panelRef.current, direction, { stagger: true })
  }, [tab, activeIndex])

  /**
   * Safety net: if the panel is ever left mid-transition — the document was
   * hidden when the animation started, so rAF never advanced it — put it back in
   * its resting state as soon as the page is visible again. Without this a tab
   * switched while the window was in the background stays blank on return.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && panelRef.current) {
        const faded = Number(getComputedStyle(panelRef.current).opacity) < 1
        if (faded) {
          settle(panelRef.current)
          panelRef.current
            .querySelectorAll<HTMLElement>('[data-stagger]')
            .forEach((child) => settle(child))
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  /**
   * Tab selection runs the outgoing panel out first, then swaps. `exitPanel`
   * guarantees the callback fires even when it cannot animate, so the tab can
   * never get stuck.
   */
  const selectTab = (next: Tab) => {
    if (next === tab) return
    if (!canAnimate()) {
      setTab(next)
      return
    }
    const direction = Math.sign(TABS.findIndex((e) => e.id === next) - activeIndex)
    exitPanel(panelRef.current, direction, () => setTab(next))
  }

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = TABS[(activeIndex + delta + TABS.length) % TABS.length]
    selectTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const [nClusters, setNClusters] = useState(4)
  const [method, setMethod] = useState<CorrelationMethod>('spearman')
  const [target, setTarget] = useState<string>('productivity_score')
  const [minSamples, setMinSamples] = useState(10)
  const [minSupport, setMinSupport] = useState(0.08)
  const [minConfidence, setMinConfidence] = useState(0.5)
  const [minLift, setMinLift] = useState(1.1)
  const [maxAntecedent, setMaxAntecedent] = useState(2)

  const scope = {
    source: dataset?.source,
    start: filter.start ?? undefined,
    end: filter.end ?? undefined,
  }

  const clusters = useAsync(
    () => api.clusters({ ...scope, n_clusters: nClusters }),
    [scope.source, scope.start, scope.end, nClusters, version],
  )

  const correlations = useAsync(
    () => api.correlations({ ...scope, method, target: target || null, min_samples: minSamples }),
    [scope.source, scope.start, scope.end, method, target, minSamples, version],
  )

  const rules = useAsync(
    () =>
      api.associationRules({
        ...scope,
        min_support: minSupport,
        min_confidence: minConfidence,
        min_lift: minLift,
        max_antecedent_size: maxAntecedent,
      }),
    [scope.source, scope.start, scope.end, minSupport, minConfidence, minLift, maxAntecedent, version],
  )

  const clusterLabels = useMemo(
    () =>
      Object.fromEntries(
        (clusters.data?.profiles ?? []).map((profile) => [profile.cluster_id, profile.label]),
      ),
    [clusters.data],
  )

  const ruleChartData = useMemo(
    () =>
      (rules.data?.rules ?? []).slice(0, 10).map((rule) => ({
        label: `${rule.antecedent_text} → ${rule.consequent_text}`,
        lift: rule.lift,
        confidence: rule.confidence,
      })),
    [rules.data],
  )

  /** The rail contents change with the technique; the rail itself does not move. */
  const rail = (
    <Rail>
      <div
        ref={tabStripRef}
        role="tablist"
        aria-label="Mining technique"
        onKeyDown={onTabKeyDown}
        className="relative flex gap-4 border-b border-line lg:flex-col lg:gap-0 lg:border-b-0"
      >
        {TABS.map(({ id, label }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(id)}
              className={clsx(
                'whitespace-nowrap pb-2 text-left text-xs transition-colors duration-200 lg:py-1.5 lg:pl-2.5',
                isActive ? 'font-medium text-ink' : 'text-muted hover:text-body',
              )}
            >
              {label}
            </button>
          )
        })}
        <span
          ref={indicatorRef}
          aria-hidden
          className="indicator pointer-events-none absolute bottom-0 left-0 bg-accent lg:bottom-auto lg:top-0"
          style={{ opacity: 0 }}
        />
      </div>

      {tab === 'clusters' && (
        <RailGroup label="Parameters">
          <Field label="Clusters (k)" htmlFor="n-clusters">
            <Select
              id="n-clusters"
              value={nClusters}
              onChange={(event) => setNClusters(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        </RailGroup>
      )}

      {tab === 'correlations' && (
        <RailGroup label="Parameters">
          <Field label="Method" htmlFor="corr-method">
            <Select
              id="corr-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as CorrelationMethod)}
            >
              <option value="spearman">Spearman (rank)</option>
              <option value="pearson">Pearson (linear)</option>
            </Select>
          </Field>
          <Field label="Focus on" htmlFor="corr-target">
            <Select id="corr-target" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">All pairs</option>
              <option value="mood_score">Mood</option>
              <option value="productivity_score">Productivity</option>
              <option value="stress_score">Stress</option>
              <option value="sleep_hours">Sleep duration</option>
            </Select>
          </Field>
          <Field label="Minimum n" htmlFor="corr-min">
            <Input
              id="corr-min"
              type="number"
              min={3}
              max={1000}
              step={1}
              value={minSamples}
              onChange={(event) => setMinSamples(Math.max(3, Number(event.target.value) || 3))}
            />
          </Field>
        </RailGroup>
      )}

      {tab === 'rules' && (
        <RailGroup label="Thresholds">
          <Field
            label={`Support — ${formatPercent(minSupport, 0)}`}
            htmlFor="min-support"
            hint="Share of days covered"
          >
            <input
              id="min-support"
              type="range"
              min={0.02}
              max={0.5}
              step={0.01}
              value={minSupport}
              onChange={(event) => setMinSupport(Number(event.target.value))}
              className="w-full"
            />
          </Field>
          <Field
            label={`Confidence — ${formatPercent(minConfidence, 0)}`}
            htmlFor="min-confidence"
            hint="How often the consequent follows"
          >
            <input
              id="min-confidence"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(event) => setMinConfidence(Number(event.target.value))}
              className="w-full"
            />
          </Field>
          <Field label={`Lift — ${minLift.toFixed(2)}`} htmlFor="min-lift" hint="1.0 = chance">
            <input
              id="min-lift"
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={minLift}
              onChange={(event) => setMinLift(Number(event.target.value))}
              className="w-full"
            />
          </Field>
          <Field label="Max antecedent size" htmlFor="max-antecedent">
            <Select
              id="max-antecedent"
              value={maxAntecedent}
              onChange={(event) => setMaxAntecedent(Number(event.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </Select>
          </Field>
        </RailGroup>
      )}

      {/* Model read-outs sit with the controls that produced them. */}
      {tab === 'clusters' && clusters.data?.available && (
        <RailGroup label="Model">
          <div className="grid grid-cols-2 gap-3">
            <Readout label="Rows" value={clusters.data.rows_used.toLocaleString()} />
            <Readout label="Features" value={clusters.data.features_used.length} />
            <Readout
              label="Silhouette"
              value={
                clusters.data.silhouette_available
                  ? clusters.data.silhouette_score?.toFixed(3)
                  : 'n/a'
              }
              tone={clusters.data.silhouette_available ? 'default' : 'muted'}
            />
            <Readout label="Inertia" value={clusters.data.inertia?.toFixed(0) ?? '—'} />
          </div>
        </RailGroup>
      )}

      {tab === 'rules' && rules.data?.available && (
        <RailGroup label="Result">
          <div className="grid grid-cols-2 gap-3">
            <Readout label="Rules" value={rules.data.rules.length} />
            <Readout label="Itemsets" value={rules.data.frequent_itemsets.length} />
            <Readout label="Transactions" value={rules.data.transactions.toLocaleString()} />
          </div>
        </RailGroup>
      )}

      {tab === 'correlations' && correlations.data?.available && (
        <RailGroup label="Result">
          <div className="grid grid-cols-2 gap-3">
            <Readout label="Variables" value={correlations.data.variables.length} />
            <Readout label="Pairs" value={correlations.data.ranked_pairs.length} />
            <Readout label="Rows" value={correlations.data.rows_considered.toLocaleString()} />
          </div>
        </RailGroup>
      )}
    </Rail>
  )

  return (
    <div>
      <PageHeader
        title="Pattern explorer"
        meta={dataset ? `${dataset.record_count.toLocaleString()} records` : undefined}
        note="Three unsupervised techniques run server-side on the active dataset. Every control in the rail is a real model parameter: changing it re-runs the analysis rather than filtering a cached result."
      />

      <Split rail={rail}>
        <Canvas>
          <div ref={panelRef}>
            {/* ----------------------------- Clusters ---------------------------- */}
            {tab === 'clusters' && (
              <div
                role="tabpanel"
                id="panel-clusters"
                aria-labelledby="tab-clusters"
                className="flex flex-col gap-6"
              >
                {clusters.loading && !clusters.data ? (
                  <ChartSkeleton height={340} />
                ) : clusters.error ? (
                  <ErrorState message={clusters.error} onRetry={clusters.reload} />
                ) : !clusters.data?.available ? (
                  <EmptyState title="Clustering unavailable" description={clusters.data?.message ?? ''} />
                ) : (
                  <>
                    {clusters.data.requested_clusters !== clusters.data.n_clusters && (
                      <Callout tone="warning">{clusters.data.message}</Callout>
                    )}

                    <Block
                      label="PCA projection"
                      meta={`n = ${clusters.data.rows_used.toLocaleString()}`}
                      note={
                        clusters.data.projection_explained_variance.length === 2
                          ? `The two components shown capture ${formatPercent(
                              clusters.data.projection_explained_variance[0] +
                                clusters.data.projection_explained_variance[1],
                            )} of total variance. Distance here is approximate: two points can look adjacent and differ on features the projection discarded. ${clusters.data.limitations.join(' ')}`
                          : clusters.data.limitations.join(' ')
                      }
                    >
                      <div data-stagger>
                        <ClusterProjectionChart
                          points={clusters.data.projection}
                          labels={clusterLabels}
                        />
                      </div>
                    </Block>

                    <Block label="Group profiles" meta={`${clusters.data.n_clusters} groups`}>
                      <div data-stagger>
                        {clusters.data.profiles
                          .filter((profile) => profile.size > 0)
                          .map((profile, index) => (
                            <article
                              key={profile.cluster_id}
                              className="grid gap-x-6 gap-y-1.5 border-b border-line py-2.5 last:border-0 lg:grid-cols-[13rem_1fr]"
                            >
                              <div>
                                <h3 className="flex items-center gap-2 text-sm text-ink">
                                  <span
                                    aria-hidden
                                    className="size-2 shrink-0"
                                    style={{
                                      background: SERIES_COLORS[index % SERIES_COLORS.length],
                                    }}
                                  />
                                  {profile.label}
                                </h3>
                                <p className="tnum mt-0.5 text-2xs text-faint">
                                  {profile.size.toLocaleString()} days · {formatPercent(profile.share)}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="measure text-xs text-muted">{profile.description}</p>
                                <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                                  {profile.features
                                    .filter((feature) => feature.direction !== 'typical')
                                    .slice(0, 4)
                                    .map((feature) => (
                                      <div
                                        key={feature.field}
                                        className="flex items-baseline gap-1.5"
                                      >
                                        <dt className="text-2xs text-faint">{feature.label}</dt>
                                        <dd className="tnum text-xs text-ink">
                                          {feature.mean}
                                          {feature.unit === '/10' ? '/10' : ''}
                                          <span
                                            className={clsx(
                                              'ml-1 text-2xs',
                                              feature.direction === 'above'
                                                ? 'text-positive'
                                                : 'text-warning',
                                            )}
                                          >
                                            {formatSigned(feature.z_score, 2)}σ
                                          </span>
                                        </dd>
                                      </div>
                                    ))}
                                </dl>
                              </div>
                            </article>
                          ))}
                      </div>
                    </Block>
                  </>
                )}
              </div>
            )}

            {/* --------------------------- Correlations -------------------------- */}
            {tab === 'correlations' && (
              <div
                role="tabpanel"
                id="panel-correlations"
                aria-labelledby="tab-correlations"
                className="flex flex-col gap-6"
              >
                {correlations.loading && !correlations.data ? (
                  <ChartSkeleton height={320} />
                ) : correlations.error ? (
                  <ErrorState message={correlations.error} onRetry={correlations.reload} />
                ) : !correlations.data?.available ? (
                  <EmptyState
                    title="Correlation unavailable"
                    description={correlations.data?.message ?? ''}
                  />
                ) : (
                  <>
                    <Block
                      label="Correlation matrix"
                      meta={`${correlations.data.method} · ${correlations.data.rows_considered.toLocaleString()} rows`}
                      note={correlations.data.caveats.join(' ')}
                    >
                      <div data-stagger>
                        <CorrelationHeatmap data={correlations.data} />
                      </div>
                    </Block>

                    <Block
                      label="Ranked pairs"
                      meta={`${correlations.data.ranked_pairs.length} pairs`}
                      note={
                        Object.keys(correlations.data.excluded_variables).length > 0
                          ? `Excluded: ${Object.entries(correlations.data.excluded_variables)
                              .map(([field, reason]) => `${field} (${reason})`)
                              .join('; ')}`
                          : undefined
                      }
                    >
                      {correlations.data.ranked_pairs.length === 0 ? (
                        <EmptyState
                          title="No pair to rank"
                          description="No variable pair had enough overlapping observations under the current filter."
                        />
                      ) : (
                        <ul data-stagger>
                          {correlations.data.ranked_pairs.slice(0, 12).map((pair) => (
                            <CorrelationRow key={`${pair.x_field}-${pair.y_field}`} pair={pair} />
                          ))}
                        </ul>
                      )}
                    </Block>
                  </>
                )}
              </div>
            )}

            {/* ------------------------------ Rules ------------------------------ */}
            {tab === 'rules' && (
              <div
                role="tabpanel"
                id="panel-rules"
                aria-labelledby="tab-rules"
                className="flex flex-col gap-6"
              >
                {rules.loading && !rules.data ? (
                  <ChartSkeleton height={320} />
                ) : rules.error ? (
                  <ErrorState message={rules.error} onRetry={rules.reload} />
                ) : !rules.data?.available ? (
                  <EmptyState
                    title="Not enough data to mine rules"
                    description={rules.data?.message ?? ''}
                  />
                ) : rules.data.rules.length === 0 ? (
                  <EmptyState
                    title="Nothing cleared the thresholds"
                    description={rules.data.message}
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setMinSupport(0.05)
                          setMinConfidence(0.4)
                          setMinLift(1)
                        }}
                      >
                        Loosen the thresholds
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <Block
                      label="Top rules by lift"
                      meta={<SampleSize n={rules.data.transactions} />}
                      note={rules.data.caveats.join(' ')}
                    >
                      <div data-stagger>
                        <RuleLiftChart rules={ruleChartData} />
                      </div>
                    </Block>

                    <Block label="Rule detail" meta={`${rules.data.rules.length} rules`}>
                      <DataTable minWidth="44rem">
                        <thead>
                          <tr className="border-b border-line bg-surface text-left">
                            <th scope="col" className="label px-3 py-1.5">Rule</th>
                            <th scope="col" className="label px-3 py-1.5 text-right">Supp.</th>
                            <th scope="col" className="label px-3 py-1.5 text-right">Conf.</th>
                            <th scope="col" className="label px-3 py-1.5 text-right">Lift</th>
                            <th scope="col" className="label px-3 py-1.5 text-right">Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.data.rules.slice(0, 25).map((rule, index) => (
                            <tr
                              key={`${rule.antecedent_text}-${rule.consequent_text}-${index}`}
                              className="border-b border-line/70 align-top transition-colors last:border-0 hover:bg-surface"
                            >
                              <td className="px-3 py-1.5">
                                <p className="text-xs text-ink">
                                  {rule.antecedent_text}{' '}
                                  <span aria-hidden className="text-accent-ink">→</span>{' '}
                                  <span className="sr-only">implies</span>
                                  {rule.consequent_text}
                                </p>
                              </td>
                              <td className="tnum px-3 py-1.5 text-right text-body">
                                {formatPercent(rule.support, 1)}
                              </td>
                              <td className="tnum px-3 py-1.5 text-right text-body">
                                {formatPercent(rule.confidence, 1)}
                              </td>
                              <td className="tnum px-3 py-1.5 text-right">
                                <span className={rule.lift >= 1.5 ? 'text-positive' : 'text-ink'}>
                                  {rule.lift.toFixed(2)}
                                </span>
                              </td>
                              <td className="tnum px-3 py-1.5 text-right text-muted">
                                {rule.matching_transactions.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </DataTable>
                    </Block>

                    <Block
                      label="Frequent itemsets"
                      meta={`${rules.data.frequent_itemsets.length} shown`}
                      note={Object.entries(rules.data.bin_definitions)
                        .map(
                          ([variable, bands]) =>
                            `${variable}: ${Object.entries(bands)
                              .map(([band, range]) => `${band.split(': ')[1]} ${range}`)
                              .join(', ')}`,
                        )
                        .join(' · ')}
                    >
                      <div className="flex flex-wrap gap-1">
                        {rules.data.frequent_itemsets.slice(0, 40).map((itemset) => (
                          <Badge
                            key={itemset.items.join('|')}
                            tone={itemset.size > 1 ? 'accent' : 'neutral'}
                          >
                            {itemset.items.join(' + ')} · {formatPercent(itemset.support, 1)}
                          </Badge>
                        ))}
                      </div>
                    </Block>
                  </>
                )}
              </div>
            )}
          </div>
        </Canvas>
      </Split>
    </div>
  )
}

function CorrelationRow({ pair }: { pair: CorrelationPair }) {
  const magnitude = Math.min(Math.abs(pair.coefficient), 1)
  const tone = pair.coefficient >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'

  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-xs text-ink">
          {pair.x_label} <span className="text-faint">vs</span> {pair.y_label}
        </p>
        <div className="mt-1 h-0.5 w-full bg-raised" aria-hidden>
          <div className="h-full" style={{ width: `${magnitude * 100}%`, background: tone }} />
        </div>
        <p className="measure mt-1 text-2xs text-muted">{pair.interpretation}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Badge tone={EVIDENCE_TONE[pair.evidence]}>{evidenceLabel(pair.evidence)}</Badge>
        <span className="tnum text-sm" style={{ color: tone }}>
          {formatSigned(pair.coefficient)}
        </span>
        <SampleSize n={pair.sample_size} />
      </div>
    </li>
  )
}
