import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import type { InsightItem } from '../../types/api'

/**
 * Findings render as a ruled list, not a grid of cards.
 *
 * Cards force every finding into the same rectangle regardless of how much it has
 * to say, and a page of them is the template look. A list separated by hairlines
 * lets each entry take the room it needs and keeps the evidence line aligned down
 * the right, so sample sizes can be scanned in a column.
 */

const CATEGORY_LABEL: Record<InsightItem['category'], string> = {
  correlation: 'Correlation',
  association: 'Rule',
  cluster: 'Cluster',
  summary: 'Summary',
  data_quality: 'Data quality',
}

const STRENGTH_COLOR: Record<string, string> = {
  strong: 'text-positive',
  moderate: 'text-body',
  weak: 'text-muted',
  negligible: 'text-faint',
}

export function InsightRow({ item }: { item: InsightItem }) {
  return (
    <article
      data-stagger
      className="group grid gap-x-5 gap-y-1.5 border-b border-line py-3 last:border-0 sm:grid-cols-[1fr_13rem]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={clsx(
              'label',
              item.kind === 'suggestion' ? 'text-accent-ink' : undefined,
            )}
          >
            {item.kind === 'suggestion' ? 'Worth testing' : CATEGORY_LABEL[item.category]}
          </span>
          <h3 className="text-sm font-medium text-ink">{item.title}</h3>
        </div>
        <p className="measure mt-1 text-sm text-muted">{item.detail}</p>
        {item.confidence_note && (
          <p className="mt-1 text-2xs text-warning">{item.confidence_note}</p>
        )}
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
        <span className="tnum text-2xs text-faint">{item.evidence}</span>
        {item.strength && (
          <span className={clsx('text-2xs', STRENGTH_COLOR[item.strength] ?? 'text-muted')}>
            {item.strength}
          </span>
        )}
        {item.related_page && (
          <Link
            to={item.related_page}
            className="inline-flex items-center gap-1 text-2xs text-accent-ink no-underline transition-colors hover:text-ink"
          >
            See the working
            <ArrowRight className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
    </article>
  )
}

/** Kept as the former name so call sites that mean "one finding" still read well. */
export const InsightCard = InsightRow
