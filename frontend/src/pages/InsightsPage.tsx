import { FlaskConical, ShieldAlert } from 'lucide-react'
import { api } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge, Callout, EmptyState, ErrorState, Panel, Skeleton } from '../components/ui'
import { InsightCard } from '../components/dashboard/InsightCard'
import { formatDate } from '../utils/format'

export function InsightsPage() {
  const { dataset, filter, version } = useDataset()

  const { data, error, loading, reload } = useAsync(
    () =>
      api.insights({
        source: dataset?.source,
        start: filter.start ?? undefined,
        end: filter.end ?? undefined,
      }),
    [dataset?.source, filter.start, filter.end, version],
  )

  return (
    <div>
      <PageHeader
        title="Insights"
        lede="Plain-English readings of the mining results. Every sentence is assembled from numbers the backend computed — there is no language model and no external service inventing explanations here."
        actions={
          data && (
            <Badge tone={data.is_synthetic ? 'warning' : 'accent'}>
              {data.is_synthetic && <FlaskConical className="size-3" aria-hidden />}
              {data.source_label}
            </Badge>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {loading && !data && (
        <div className="flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Panel key={index} title=" ">
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-36" />
                <Skeleton className="h-36" />
              </div>
            </Panel>
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-5">
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

          {data.groups.length === 0 ? (
            <Panel title="Nothing to report yet">
              <EmptyState
                title="No finding cleared the evidence bar"
                description={
                  data.record_count === 0
                    ? 'There are no records in this view. Load the demo dataset, import a CSV, or add check-ins.'
                    : 'The analyses ran but nothing met the minimum sample size and strength needed to state a finding. That is a real result, not a failure.'
                }
              />
            </Panel>
          ) : (
            data.groups.map((group) => (
              <Panel key={group.key} title={group.title} description={group.description}>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))]">
                  {group.items.map((item) => (
                    <InsightCard key={item.id} item={item} />
                  ))}
                </div>
              </Panel>
            ))
          )}

          <Panel
            title="Limits of everything on this page"
            description="Read before quoting any of it."
          >
            <ul className="measure flex flex-col gap-2 text-sm text-body">
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
