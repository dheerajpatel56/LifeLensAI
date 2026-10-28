import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { InsightItem } from '../../types/api'
import { Badge } from '../ui'

const CATEGORY_LABEL: Record<InsightItem['category'], string> = {
  correlation: 'Correlation',
  association: 'Association rule',
  cluster: 'Routine group',
  summary: 'Summary',
  data_quality: 'Data quality',
}

export function InsightCard({ item }: { item: InsightItem }) {
  return (
    <article className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.kind === 'suggestion' ? 'accent' : 'neutral'}>
          {item.kind === 'suggestion' ? 'Worth testing' : CATEGORY_LABEL[item.category]}
        </Badge>
        {item.strength && <Badge tone="neutral">{item.strength}</Badge>}
        {item.confidence_note && <Badge tone="warning">Caveat</Badge>}
      </div>

      <h3 className="text-base font-semibold text-ink">{item.title}</h3>
      <p className="measure text-sm text-body">{item.detail}</p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="tnum text-2xs text-faint">{item.evidence}</span>
        {item.related_page && (
          <Link
            to={item.related_page}
            className="inline-flex items-center gap-1 text-2xs font-medium text-accent-ink transition-colors hover:text-ink"
          >
            See the working
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>

      {item.confidence_note && (
        <p className="border-t border-line pt-2 text-2xs text-warning">{item.confidence_note}</p>
      )}
    </article>
  )
}
