import { useEffect, useRef } from 'react'
import { FlaskConical, ShieldAlert } from 'lucide-react'
import { api } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge, Callout, EmptyState, ErrorState, Panel, Skeleton } from '../components/ui'
import { InsightRow } from '../components/dashboard/InsightCard'
import { formatDate } from '../utils/format'
import { enterPanel } from '../utils/motion'

export function InsightsPage() {
  const { dataset, filter, version } = useDataset()
  const listRef = useRef<HTMLDivElement>(null)

  const { data, error, loading, reload } = useAsync(
    () =>
      api.insights({
        source: dataset?.source,
        start: filter.start ?? undefined,
        end: filter.end ?? undefined,
      }),
    [dataset?.source, filter.start, filter.end, version],
  )

  // Findings stagger in once they arrive — the list changing is the state change.
  useEffect(() => {
    if (data) enterPanel(listRef.current, 0, { stagger: true })
  }, [data])

  return (
    <div>
      <PageHeader
        title="Insights"
        note="Plain-English readings of the mining results. Every sentence is assembled from numbers the backend computed by filling deterministic templates — no language model and no external service is involved, so no insight can describe a finding the data does not contain."
        actions={
          data && (
            <Badge tone={data.is_synthetic ? 'warning' : 'neutral'}>
              {data.is_synthetic && <FlaskConical className="size-3" aria-hidden />}
              {data.source_label}
            </Badge>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {loading && !data && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          <Callout
            tone={data.is_synthetic ? 'warning' : 'neutral'}
            title={data.is_synthetic ? 'Observations from synthetic data' : 'Observations from your data'}
          >
            {data.disclaimers[0]}
          </Callout>

          {!data.data_sufficiency.sufficient && (
            <Callout tone="neutral" title="Treat these as provisional">
              {data.data_sufficiency.guidance}
            </Callout>
          )}

          <div ref={listRef} className="flex flex-col gap-6">
            {data.groups.length === 0 ? (
              <EmptyState
                title="No finding cleared the evidence bar"
                description={
                  data.record_count === 0
                    ? 'There are no records in this view. Load the demo dataset, import a CSV, or add check-ins.'
                    : 'The analyses ran but nothing met the minimum sample size and strength needed to state a finding. That is a real result, not a failure.'
                }
              />
            ) : (
              data.groups.map((group) => (
                <Panel key={group.key} title={group.title} description={group.description}>
                  <div className="border-t border-line">
                    {group.items.map((item) => (
                      <InsightRow key={item.id} item={item} />
                    ))}
                  </div>
                </Panel>
              ))
            )}
          </div>

          <Panel title="Limits of everything on this page" description="Read before quoting any of it.">
            <ul className="measure flex flex-col gap-1.5 text-sm text-muted">
              {data.disclaimers.map((text) => (
                <li key={text} className="flex gap-2">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </Panel>

          <p className="tnum text-2xs text-faint">
            Generated {new Date(data.generated_at).toLocaleString()} from{' '}
            {data.record_count.toLocaleString()} record(s)
            {filter.start || filter.end
              ? ` between ${formatDate(filter.start)} and ${formatDate(filter.end)}`
              : ''}
            .
          </p>
        </div>
      )}
    </div>
  )
}
