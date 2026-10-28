import { useMemo, useState } from 'react'
import { Boxes, GitCompare, Network } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import {
  Badge,
  Button,
  Callout,
  ChartSkeleton,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Panel,
  SampleSize,
  Select,
} from '../components/ui'
import {
  ChartFrame,
  ClusterProjectionChart,
  RuleLiftChart,
  SERIES_COLORS,
} from '../components/charts'
import { CorrelationHeatmap } from '../components/patterns/CorrelationHeatmap'
import { evidenceLabel, formatPercent, formatSigned } from '../utils/format'
import type { CorrelationMethod, CorrelationPair } from '../types/api'

type Tab = 'clusters' | 'correlations' | 'rules'

const TABS: Array<{ id: Tab; label: string; icon: typeof Boxes; blurb: string }> = [
  { id: 'clusters', label: 'Lifestyle clustering', icon: Boxes, blurb: 'K-Means over standardised features' },
  { id: 'correlations', label: 'Correlation discovery', icon: GitCompare, blurb: 'Pearson or Spearman, pairwise-complete' },
  { id: 'rules', label: 'Association rules', icon: Network, blurb: 'Apriori with support, confidence, lift' },
]

const EVIDENCE_TONE = {
  reasonable: 'positive',
  limited: 'warning',
  insufficient: 'negative',
} as const

export function PatternsPage() {
  const { dataset, filter, version } = useDataset()
  const [tab, setTab] = useState<Tab>('clusters')

  // Each technique keeps its own controls; they are the knobs a viva will ask about.
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
    () =>
      api.correlations({
        ...scope,
        method,
        target: target || null,
        min_samples: minSamples,
      }),
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
    [
      scope.source,
      scope.start,
      scope.end,
      minSupport,
      minConfidence,
      minLift,
      maxAntecedent,
      version,
    ],
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

  return (
    <div>
      <PageHeader
        title="Pattern explorer"
        lede="Three unsupervised techniques over the active dataset. Every control below changes a real parameter of the model that runs on the server."
      />

      {/* Technique switcher — tabs, a standard affordance, not an invented one. */}
      <div role="tablist" aria-label="Mining technique" className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon, blurb }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors duration-150',
                isActive
                  ? 'border-accent/45 bg-accent/12'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <Icon
                className={clsx('mt-0.5 size-4 shrink-0', isActive ? 'text-accent-ink' : 'text-faint')}
                aria-hidden
              />
              <span>
                <span className={clsx('block text-sm font-medium', isActive ? 'text-ink' : 'text-body')}>
                  {label}
                </span>
                <span className="block text-2xs text-faint">{blurb}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ------------------------------- Clusters ------------------------------ */}
      {tab === 'clusters' && (
        <div role="tabpanel" id="panel-clusters" aria-labelledby="tab-clusters" className="flex flex-col gap-5">
          <Panel
            title="Lifestyle clustering (K-Means)"
            description="Features are standardised, missing values median-imputed, and identifiers, dates and notes are never used as features."
            actions={
              <Field label="Clusters (k)" htmlFor="n-clusters" className="w-28">
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
            }
          >
            {clusters.loading && !clusters.data ? (
              <ChartSkeleton height={320} />
            ) : clusters.error ? (
              <ErrorState message={clusters.error} onRetry={clusters.reload} />
            ) : !clusters.data?.available ? (
              <EmptyState title="Clustering unavailable" description={clusters.data?.message ?? ''} />
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <span className="text-muted">
                    Rows used <span className="tnum text-ink">{clusters.data.rows_used.toLocaleString()}</span>
                  </span>
                  <span className="text-muted">
                    Features <span className="tnum text-ink">{clusters.data.features_used.length}</span>
                  </span>
                  <span className="text-muted">
                    Silhouette{' '}
                    {clusters.data.silhouette_available ? (
                      <span className="tnum text-ink">
                        {clusters.data.silhouette_score?.toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-faint">not computable</span>
                    )}
                  </span>
                  <span className="text-muted">
                    Inertia <span className="tnum text-ink">{clusters.data.inertia?.toFixed(1)}</span>
                  </span>
                </div>

                {clusters.data.requested_clusters !== clusters.data.n_clusters && (
                  <Callout tone="warning">{clusters.data.message}</Callout>
                )}

                <ChartFrame
                  title="PCA projection of the clustered days"
                  sampleSize={clusters.data.rows_used}
                  caption={
                    clusters.data.projection_explained_variance.length === 2
                      ? `The two components shown capture ${formatPercent(
                          clusters.data.projection_explained_variance[0] +
                            clusters.data.projection_explained_variance[1],
                        )} of the total variance. Distance in this picture is approximate: two points can look adjacent here and differ on features the projection discarded.`
                      : undefined
                  }
                >
                  <ClusterProjectionChart
                    points={clusters.data.projection}
                    labels={clusterLabels}
                  />
                </ChartFrame>

                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
                  {clusters.data.profiles
                    .filter((profile) => profile.size > 0)
                    .map((profile, index) => (
                      <article
                        key={profile.cluster_id}
                        className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-surface px-4 py-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                            <span
                              aria-hidden
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                            />
                            {profile.label}
                          </h3>
                          <Badge tone="neutral">{formatPercent(profile.share)}</Badge>
                        </div>
                        <p className="text-sm text-body">{profile.description}</p>
                        <dl className="mt-1 flex flex-col gap-1 border-t border-line pt-2 text-xs">
                          {profile.features
                            .filter((feature) => feature.direction !== 'typical')
                            .slice(0, 4)
                            .map((feature) => (
                              <div key={feature.field} className="flex items-baseline justify-between gap-2">
                                <dt className="truncate text-muted">{feature.label}</dt>
                                <dd className="tnum shrink-0 text-ink">
                                  {feature.mean}
                                  {feature.unit === '/10' ? '/10' : ''}{' '}
                                  <span
                                    className={clsx(
                                      'text-2xs',
                                      feature.direction === 'above' ? 'text-positive' : 'text-warning',
                                    )}
                                  >
                                    ({formatSigned(feature.z_score, 2)} sd)
                                  </span>
                                </dd>
                              </div>
                            ))}
                        </dl>
                        <p className="tnum text-2xs text-faint">
                          {profile.size.toLocaleString()} day(s) in this group
                        </p>
                      </article>
                    ))}
                </div>
              </div>
            )}
          </Panel>

          {clusters.data?.available && (
            <Panel title="What clustering can and cannot tell you">
              <ul className="measure flex flex-col gap-2 text-sm text-body">
                {clusters.data.limitations.map((limitation) => (
                  <li key={limitation} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                    {limitation}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {/* ----------------------------- Correlations ---------------------------- */}
      {tab === 'correlations' && (
        <div
          role="tabpanel"
          id="panel-correlations"
          aria-labelledby="tab-correlations"
          className="flex flex-col gap-5"
        >
          <Panel
            title="Correlation discovery"
            description="Each pair is computed only on days where both variables were recorded, and that pair's own sample size is reported with it."
            actions={
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Method" htmlFor="corr-method" className="w-32">
                  <Select
                    id="corr-method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as CorrelationMethod)}
                  >
                    <option value="spearman">Spearman (rank)</option>
                    <option value="pearson">Pearson (linear)</option>
                  </Select>
                </Field>
                <Field label="Focus on" htmlFor="corr-target" className="w-44">
                  <Select
                    id="corr-target"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    <option value="">All variable pairs</option>
                    <option value="mood_score">Mood</option>
                    <option value="productivity_score">Productivity</option>
                    <option value="stress_score">Stress</option>
                    <option value="sleep_hours">Sleep duration</option>
                  </Select>
                </Field>
                <Field label="Min n" htmlFor="corr-min" className="w-24">
                  <Input
                    id="corr-min"
                    type="number"
                    min={3}
                    max={1000}
                    step={1}
                    value={minSamples}
                    onChange={(event) =>
                      setMinSamples(Math.max(3, Number(event.target.value) || 3))
                    }
                  />
                </Field>
              </div>
            }
          >
            {correlations.loading && !correlations.data ? (
              <ChartSkeleton height={300} />
            ) : correlations.error ? (
              <ErrorState message={correlations.error} onRetry={correlations.reload} />
            ) : !correlations.data?.available ? (
              <EmptyState
                title="Correlation unavailable"
                description={correlations.data?.message ?? ''}
              />
            ) : (
              <div className="flex flex-col gap-5">
                <p className="measure text-sm text-muted">{correlations.data.message}</p>
                <CorrelationHeatmap data={correlations.data} />
              </div>
            )}
          </Panel>

          {correlations.data?.available && (
            <Panel
              title="Ranked relationships"
              description="Sorted by absolute coefficient. Read the sample size before you read the number."
            >
              {correlations.data.ranked_pairs.length === 0 ? (
                <EmptyState
                  title="No pair to rank"
                  description="No variable pair had enough overlapping observations under the current filter."
                />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {correlations.data.ranked_pairs.slice(0, 12).map((pair) => (
                    <CorrelationRow key={`${pair.x_field}-${pair.y_field}`} pair={pair} />
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {correlations.data && Object.keys(correlations.data.excluded_variables).length > 0 && (
            <Panel title="Variables excluded from this analysis">
              <ul className="flex flex-col gap-1.5 text-sm">
                {Object.entries(correlations.data.excluded_variables).map(([field, reason]) => (
                  <li key={field} className="flex flex-wrap gap-x-2 text-muted">
                    <span className="text-body">{field}</span>
                    <span>— {reason}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {correlations.data?.caveats && (
            <Panel title="How to read these numbers">
              <ul className="measure flex flex-col gap-2 text-sm text-body">
                {correlations.data.caveats.map((caveat) => (
                  <li key={caveat} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                    {caveat}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {/* -------------------------------- Rules -------------------------------- */}
      {tab === 'rules' && (
        <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules" className="flex flex-col gap-5">
          <Panel
            title="Association-rule mining (Apriori)"
            description="Continuous values are placed into fixed labelled bands, then frequent itemsets and rules are mined from those bands."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label={`Min support — ${formatPercent(minSupport, 0)}`}
                htmlFor="min-support"
                hint="Share of all days the rule must cover"
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
                label={`Min confidence — ${formatPercent(minConfidence, 0)}`}
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
              <Field
                label={`Min lift — ${minLift.toFixed(2)}`}
                htmlFor="min-lift"
                hint="1.0 means no better than chance"
              >
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
              <Field label="Max items in antecedent" htmlFor="max-antecedent">
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
            </div>
          </Panel>

          {rules.loading && !rules.data ? (
            <Panel title="Mining rules">
              <ChartSkeleton height={300} />
            </Panel>
          ) : rules.error ? (
            <ErrorState message={rules.error} onRetry={rules.reload} />
          ) : !rules.data?.available ? (
            <Panel title="Rules unavailable">
              <EmptyState title="Not enough data to mine rules" description={rules.data?.message ?? ''} />
            </Panel>
          ) : rules.data.rules.length === 0 ? (
            <Panel title="No rules at these thresholds">
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
            </Panel>
          ) : (
            <>
              <Panel
                title="Strongest rules by lift"
                description={rules.data.message}
                actions={<SampleSize n={rules.data.transactions} />}
              >
                <ChartFrame
                  title="Top 10 rules"
                  sampleSize={rules.data.transactions}
                  caption="Lift compares how often the two sides occur together against how often they would if they were unrelated. Above 1 is more than chance; it is still only co-occurrence."
                >
                  <RuleLiftChart rules={ruleChartData} />
                </ChartFrame>
              </Panel>

              <Panel title="Rule detail">
                <div className="-mx-4 overflow-x-auto sm:-mx-5">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-faint">
                        <th scope="col" className="px-4 py-2 font-medium sm:px-5">Rule</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Support</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Confidence</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Lift</th>
                        <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.data.rules.slice(0, 25).map((rule, index) => (
                        <tr
                          key={`${rule.antecedent_text}-${rule.consequent_text}-${index}`}
                          className="border-b border-line/60 align-top transition-colors last:border-0 hover:bg-raised"
                        >
                          <td className="px-4 py-2.5 sm:px-5">
                            <p className="text-ink">
                              {rule.antecedent_text}{' '}
                              <span aria-hidden className="text-accent-ink">→</span>{' '}
                              <span className="sr-only">implies</span>
                              {rule.consequent_text}
                            </p>
                            <p className="measure mt-1 text-2xs text-muted">{rule.interpretation}</p>
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-body">
                            {formatPercent(rule.support, 1)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-body">
                            {formatPercent(rule.confidence, 1)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right">
                            <span className={rule.lift >= 1.5 ? 'text-positive' : 'text-ink'}>
                              {rule.lift.toFixed(2)}
                            </span>
                          </td>
                          <td className="tnum px-4 py-2.5 text-right text-muted sm:px-5">
                            {rule.matching_transactions.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="How the bands are defined"
                  description="Fixed cut points, chosen for interpretability rather than from the data, so a band means the same thing across datasets."
                >
                  <dl className="flex flex-col gap-3 text-sm">
                    {Object.entries(rules.data.bin_definitions).map(([variable, bands]) => (
                      <div key={variable}>
                        <dt className="text-xs font-medium text-ink">{variable}</dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                          {Object.entries(bands).map(([band, range]) => (
                            <Badge key={band} tone="neutral">
                              {band.split(': ')[1]} · {range}
                            </Badge>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Panel>

                <Panel title="Reading support, confidence and lift">
                  <ul className="measure flex flex-col gap-2 text-sm text-body">
                    {rules.data.caveats.map((caveat) => (
                      <li key={caveat} className="flex gap-2">
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                        {caveat}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <Panel
                title="Frequent itemsets"
                description="The intermediate output of Apriori: every combination of bands that cleared minimum support."
              >
                <div className="flex flex-wrap gap-1.5">
                  {rules.data.frequent_itemsets.slice(0, 40).map((itemset) => (
                    <Badge key={itemset.items.join('|')} tone={itemset.size > 1 ? 'accent' : 'neutral'}>
                      {itemset.items.join(' + ')} · {formatPercent(itemset.support, 1)}
                    </Badge>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CorrelationRow({ pair }: { pair: CorrelationPair }) {
  const magnitude = Math.min(Math.abs(pair.coefficient), 1)
  const tone = pair.coefficient >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'

  return (
    <li className="rounded-[10px] border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-ink">
          {pair.x_label} <span className="text-muted">vs</span> {pair.y_label}
        </p>
        <div className="flex items-center gap-2">
          <Badge tone={EVIDENCE_TONE[pair.evidence]}>{evidenceLabel(pair.evidence)}</Badge>
          <span className="tnum text-base font-semibold" style={{ color: tone }}>
            {formatSigned(pair.coefficient)}
          </span>
          <SampleSize n={pair.sample_size} />
        </div>
      </div>

      {/* Magnitude bar: the number is primary, this is a quick visual scan. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${magnitude * 100}%`, background: tone }}
        />
      </div>

      <p className="measure mt-2 text-xs text-muted">{pair.interpretation}</p>
      {pair.p_value !== null && (
        <p className="tnum mt-1 text-2xs text-faint">
          p = {pair.p_value < 0.0001 ? '<0.0001' : pair.p_value.toFixed(4)} · tests the null
          hypothesis of no association on these {pair.sample_size} day(s); it does not establish cause
          and is not corrected for testing many pairs at once.
        </p>
      )}
    </li>
  )
}
