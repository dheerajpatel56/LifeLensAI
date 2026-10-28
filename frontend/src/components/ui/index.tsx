/**
 * Shared UI vocabulary. One shape for buttons, one shape for panels, one field
 * pattern — consistency across screens is the point (see DESIGN.md).
 */

import clsx from 'clsx'
import { AlertTriangle, Check, Info, Loader2, TriangleAlert } from 'lucide-react'
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

// --------------------------------------------------------------------------- //
// Panel
// --------------------------------------------------------------------------- //
interface PanelProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function Panel({
  title,
  description,
  actions,
  footer,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={clsx(
        // Border only — never border plus wide shadow on the same element.
        'rounded-[10px] border border-line bg-surface',
        className,
      )}
    >
      {(title || actions || description) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-md font-semibold text-ink">{title}</h2>}
            {description && (
              <p className="measure mt-1 text-sm text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
      {footer && (
        <footer className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
          {footer}
        </footer>
      )}
    </section>
  )
}

// --------------------------------------------------------------------------- //
// Button
// --------------------------------------------------------------------------- //
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 active:bg-accent/80 disabled:bg-accent/40 disabled:text-white/70',
  secondary:
    'border border-line bg-raised text-body hover:border-line-strong hover:text-ink active:bg-line disabled:text-faint',
  ghost:
    'text-muted hover:bg-raised hover:text-ink active:bg-line disabled:text-faint',
  danger:
    'border border-negative/40 bg-negative/12 text-negative hover:bg-negative/20 active:bg-negative/25 disabled:opacity-50',
}

export function Button({
  variant = 'secondary',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[6px] px-3 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

/**
 * Same visual vocabulary as Button, but renders an anchor-shaped element.
 * Never nest a Link inside a Button: that produces an <a> inside a <button>,
 * which is invalid and breaks keyboard activation.
 */
export const buttonClasses = (variant: Variant = 'secondary', className?: string) =>
  clsx(
    'inline-flex items-center justify-center gap-2 rounded-[6px] px-3 py-1.5 text-sm font-medium',
    'transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] no-underline',
    VARIANTS[variant],
    className,
  )

// --------------------------------------------------------------------------- //
// Badge
// --------------------------------------------------------------------------- //
type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'negative'

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-muted',
  accent: 'border-accent/35 bg-accent/12 text-accent-ink',
  positive: 'border-positive/35 bg-positive/12 text-positive',
  warning: 'border-warning/35 bg-warning/12 text-warning',
  negative: 'border-negative/35 bg-negative/12 text-negative',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// --------------------------------------------------------------------------- //
// Form controls
// --------------------------------------------------------------------------- //
interface FieldProps {
  label: string
  htmlFor: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-body">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-1 text-xs text-negative">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const CONTROL =
  'w-full rounded-[6px] border bg-raised px-2.5 py-1.5 text-sm text-ink transition-colors duration-150 ' +
  'hover:border-line-strong focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:text-faint'

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={clsx(CONTROL, invalid ? 'border-negative' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={clsx(CONTROL, invalid ? 'border-negative' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={clsx(CONTROL, 'min-h-20 resize-y', invalid ? 'border-negative' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

// --------------------------------------------------------------------------- //
// Feedback states
// --------------------------------------------------------------------------- //
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx('skeleton rounded-[6px]', className)} style={style} aria-hidden />
}

/** Skeletons are shaped like the content they replace — never a centred spinner. */
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-3" style={{ height }} aria-hidden>
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-1 items-end gap-2">
        {[58, 74, 42, 86, 64, 92, 50, 70, 38, 80].map((pct, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${pct}%` }} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-line px-6 py-10 text-center">
      <div className="text-muted" aria-hidden>
        {icon ?? <Info className="size-5" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="measure text-sm text-muted">{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[10px] border border-negative/35 bg-negative/8 px-4 py-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink">That request did not go through</p>
          <p className="measure mt-1 text-sm text-body">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Callout({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Tone
  title?: ReactNode
  children: ReactNode
}) {
  const palette: Record<Tone, string> = {
    neutral: 'border-line bg-raised',
    accent: 'border-accent/30 bg-accent/8',
    positive: 'border-positive/30 bg-positive/8',
    warning: 'border-warning/30 bg-warning/8',
    negative: 'border-negative/30 bg-negative/8',
  }
  const icons: Record<Tone, ReactNode> = {
    neutral: <Info className="size-4 text-muted" aria-hidden />,
    accent: <Info className="size-4 text-accent-ink" aria-hidden />,
    positive: <Check className="size-4 text-positive" aria-hidden />,
    warning: <TriangleAlert className="size-4 text-warning" aria-hidden />,
    negative: <AlertTriangle className="size-4 text-negative" aria-hidden />,
  }
  return (
    <div className={clsx('flex gap-3 rounded-[10px] border px-4 py-3', palette[tone])}>
      <div className="mt-0.5 shrink-0">{icons[tone]}</div>
      <div className="min-w-0 text-sm text-body">
        {title && <p className="font-medium text-ink">{title}</p>}
        <div className={clsx('measure', title && 'mt-1')}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Inline confirmation for destructive actions — it appears in the surface that
 * owns the action rather than stealing the screen with a modal.
 */
export function ConfirmInline({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
  pending,
}: {
  question: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
}) {
  return (
    <div
      role="alertdialog"
      aria-label={question}
      className="enter flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-negative/35 bg-negative/8 px-4 py-3"
    >
      <p className="text-sm text-body">{question}</p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function SampleSize({ n, className }: { n: number | null | undefined; className?: string }) {
  if (n === null || n === undefined) return null
  return (
    <span className={clsx('tnum text-2xs text-faint', className)}>
      n&nbsp;=&nbsp;{n.toLocaleString()}
    </span>
  )
}
