import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import {
  Badge,
  Button,
  Callout,
  ConfirmInline,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Panel,
  Skeleton,
  Textarea,
} from '../components/ui'
import { formatDate, formatNumber, todayIso } from '../utils/format'
import type { CheckIn, CheckInPayload } from '../types/api'

/**
 * Client-side schema mirroring the backend contract exactly. The backend
 * re-validates everything; this exists so the user gets the message inline
 * instead of after a round trip.
 */
const hours = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(24, `${label} cannot exceed 24 hours`)

const scale = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} runs from 1 to 10`)
    .max(10, `${label} runs from 1 to 10`)

const schema = z
  .object({
    date: z
      .string()
      .min(1, 'Pick a date')
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), 'That is not a valid date'),
    sleep_hours: hours('Sleep duration'),
    sleep_quality: scale('Sleep quality'),
    screen_time_hours: hours('Screen time'),
    social_media_hours: hours('Social media use'),
    study_work_hours: hours('Study/work hours'),
    exercise_minutes: z.coerce
      .number({ message: 'Exercise must be a number' })
      .min(0, 'Exercise cannot be negative')
      .max(1440, 'Exercise cannot exceed 1440 minutes (24 hours)'),
    caffeine_servings: z.coerce
      .number({ message: 'Caffeine must be a number' })
      .min(0, 'Caffeine cannot be negative')
      .max(20, 'More than 20 servings is not a plausible entry'),
    stress_score: scale('Stress level'),
    mood_score: scale('Mood'),
    productivity_score: scale('Productivity'),
    notes: z.string().max(500, 'Notes are limited to 500 characters').optional(),
  })
  .refine((value) => value.social_media_hours <= value.screen_time_hours, {
    path: ['social_media_hours'],
    message: 'Social media use cannot exceed total screen time',
  })
  .refine((value) => value.sleep_hours + value.study_work_hours <= 24, {
    path: ['study_work_hours'],
    message: 'Sleep plus study/work cannot exceed 24 hours in one day',
  })

type FormValues = z.input<typeof schema>

const DEFAULTS: FormValues = {
  date: todayIso(),
  sleep_hours: 7.5,
  sleep_quality: 7,
  screen_time_hours: 5,
  social_media_hours: 1.5,
  study_work_hours: 6,
  exercise_minutes: 30,
  caffeine_servings: 1,
  stress_score: 4,
  mood_score: 6,
  productivity_score: 6,
  notes: '',
}

export function CheckInPage() {
  const { markStale, dataset, selectSource } = useDataset()
  const [editing, setEditing] = useState<CheckIn | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [conflict, setConflict] = useState<CheckIn | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
    mode: 'onBlur',
  })

  const records = useAsync(() => api.listCheckIns({ limit: 20 }), [])
  const watchedDate = watch('date')

  // Warn about a duplicate date before the user fills in the whole form.
  useEffect(() => {
    if (!watchedDate || editing) {
      setConflict(null)
      return
    }
    let cancelled = false
    api
      .checkInByDate(watchedDate)
      .then((existing) => {
        if (!cancelled) setConflict(existing)
      })
      .catch(() => {
        if (!cancelled) setConflict(null)
      })
    return () => {
      cancelled = true
    }
  }, [watchedDate, editing, records.data])

  const startEdit = useCallback(
    (record: CheckIn) => {
      setEditing(record)
      setConflict(null)
      reset({
        date: record.date,
        sleep_hours: record.sleep_hours,
        sleep_quality: record.sleep_quality,
        screen_time_hours: record.screen_time_hours,
        social_media_hours: record.social_media_hours,
        study_work_hours: record.study_work_hours,
        exercise_minutes: record.exercise_minutes,
        caffeine_servings: record.caffeine_servings,
        stress_score: record.stress_score,
        mood_score: record.mood_score,
        productivity_score: record.productivity_score,
        notes: record.notes ?? '',
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [reset],
  )

  const cancelEdit = () => {
    setEditing(null)
    reset(DEFAULTS)
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload: CheckInPayload = {
      ...(values as unknown as CheckInPayload),
      notes: values.notes?.trim() ? values.notes.trim() : null,
    }

    try {
      if (editing) {
        await api.updateCheckIn(editing.id, payload)
        toast.success(`Updated ${formatDate(payload.date)}`)
        setEditing(null)
      } else {
        await api.createCheckIn(payload)
        toast.success(`Saved ${formatDate(payload.date)}`)
      }
      reset({ ...DEFAULTS, date: todayIso() })
      records.reload()
      markStale()
      if (dataset && dataset.source !== 'user') {
        // The user just produced real data; offer it as the thing being analysed.
        toast('Switch to your own data?', {
          action: {
            label: 'Switch',
            onClick: () => void selectSource('user'),
          },
        })
      }
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : 'The check-in could not be saved.'
      toast.error(message)
    }
  })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.deleteCheckIn(pendingDelete.id)
      toast.success(`Deleted ${formatDate(pendingDelete.date)}`)
      if (editing?.id === pendingDelete.id) cancelEdit()
      setPendingDelete(null)
      records.reload()
      markStale()
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Could not delete that record.')
    } finally {
      setDeleting(false)
    }
  }

  const numberField = (
    name: keyof FormValues,
    label: string,
    options: { step?: string; min?: number; max?: number; hint?: string },
  ) => (
    <Field
      label={label}
      htmlFor={name}
      error={errors[name]?.message as string | undefined}
      hint={options.hint}
    >
      <Input
        id={name}
        type="number"
        inputMode="decimal"
        step={options.step ?? '0.1'}
        min={options.min ?? 0}
        max={options.max}
        invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : options.hint ? `${name}-hint` : undefined}
        {...register(name)}
      />
    </Field>
  )

  return (
    <div>
      <PageHeader
        title={editing ? `Editing ${formatDate(editing.date)}` : 'Daily check-in'}
        note="Record one day of lifestyle data. Mood and productivity are your own ratings — LifeLens never infers them from your screen time, your notes or anything else. Ranges are enforced here and again on the server."
        actions={
          editing && (
            <Button variant="ghost" onClick={cancelEdit}>
              Cancel edit
            </Button>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title={editing ? 'Update this day' : 'Today’s entry'}
          description="All eleven fields are required. Ranges are enforced here and again on the server."
        >
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            {conflict && !editing && (
              <Callout tone="warning" title={`${formatDate(conflict.date)} is already recorded`}>
                <p>
                  You logged mood {conflict.mood_score}/10 and productivity{' '}
                  {conflict.productivity_score}/10 on that date. Saving again would be a second
                  record for the same day.
                </p>
                <Button
                  className="mt-2"
                  variant="secondary"
                  icon={<Pencil className="size-3.5" />}
                  onClick={() => startEdit(conflict)}
                >
                  Edit the existing record instead
                </Button>
              </Callout>
            )}

            <Field label="Date" htmlFor="date" error={errors.date?.message}>
              <Input
                id="date"
                type="date"
                max={todayIso()}
                invalid={Boolean(errors.date)}
                {...register('date')}
              />
            </Field>

            <fieldset className="m-0 border-0 p-0">
              <legend className="label mb-2">Sleep</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {numberField('sleep_hours', 'Sleep duration (hours)', {
                  step: '0.1',
                  max: 24,
                  hint: '0–24 hours',
                })}
                {numberField('sleep_quality', 'Sleep quality (1–10)', {
                  step: '1',
                  min: 1,
                  max: 10,
                  hint: 'Whole number, 1 = terrible',
                })}
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="label mb-2">Time use</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {numberField('screen_time_hours', 'Screen time (hours)', { max: 24, hint: 'Total across devices' })}
                {numberField('social_media_hours', 'Social media (hours)', {
                  max: 24,
                  hint: 'Must be within your screen time',
                })}
                {numberField('study_work_hours', 'Study / work (hours)', { max: 24 })}
                {numberField('exercise_minutes', 'Exercise (minutes)', {
                  step: '1',
                  max: 1440,
                  hint: '0–1440 minutes',
                })}
                {numberField('caffeine_servings', 'Caffeine (servings)', {
                  step: '1',
                  max: 20,
                  hint: 'Cups of coffee / tea / energy drink',
                })}
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="label mb-1">Self-reported ratings</legend>
              <p className="mb-2.5 text-2xs text-faint">
                Your own judgement of the day, on a 1–10 scale.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['stress_score', 'Stress'],
                    ['mood_score', 'Mood'],
                    ['productivity_score', 'Productivity'],
                  ] as const
                ).map(([name, label]) => (
                  <Field
                    key={name}
                    label={`${label} (1–10)`}
                    htmlFor={name}
                    error={errors[name]?.message as string | undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        id={name}
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        className="w-full"
                        value={Number(watch(name)) || 1}
                        onChange={(event) =>
                          setValue(name, Number(event.target.value), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        aria-describedby={`${name}-value`}
                      />
                      <output
                        id={`${name}-value`}
                        className="tnum w-6 shrink-0 text-right text-sm font-semibold text-ink"
                      >
                        {Number(watch(name)) || 1}
                      </output>
                    </div>
                  </Field>
                ))}
              </div>
            </fieldset>

            <Field
              label="Notes (optional)"
              htmlFor="notes"
              error={errors.notes?.message}
              hint={`${(watch('notes') ?? '').length}/500 characters`}
            >
              <Textarea
                id="notes"
                placeholder="Anything that explains the day — a deadline, an illness, a late night."
                maxLength={500}
                invalid={Boolean(errors.notes)}
                {...register('notes')}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                icon={<Save className="size-3.5" />}
              >
                {editing ? 'Save changes' : 'Save check-in'}
              </Button>
              {isDirty && !editing && (
                <Button variant="ghost" onClick={() => reset({ ...DEFAULTS, date: todayIso() })}>
                  Reset form
                </Button>
              )}
            </div>
          </form>
        </Panel>

        <Panel
          title="Your recent check-ins"
          description="The 20 most recent records you have entered yourself."
          actions={
            records.data && (
              <Badge tone="neutral">{records.data.total.toLocaleString()} total</Badge>
            )
          }
        >
          {pendingDelete && (
            <div className="mb-3">
              <ConfirmInline
                question={`Delete the record for ${formatDate(pendingDelete.date)}? This cannot be undone.`}
                confirmLabel="Delete record"
                pending={deleting}
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
              />
            </div>
          )}

          {records.loading && !records.data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : records.error ? (
            <ErrorState message={records.error} onRetry={records.reload} />
          ) : records.data && records.data.items.length > 0 ? (
            <ul className="flex flex-col border-t border-line">
              {records.data.items.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 transition-colors last:border-0 hover:bg-surface"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{formatDate(record.date)}</p>
                    <p className="tnum text-2xs text-muted">
                      mood {record.mood_score} · productivity {record.productivity_score} · sleep{' '}
                      {formatNumber(record.sleep_hours)} h · stress {record.stress_score}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${record.date}`}
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => startEdit(record)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${record.date}`}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => setPendingDelete(record)}
                      className="text-negative hover:bg-negative/12 hover:text-negative"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No check-ins yet"
              description="Fill in the form to record your first day. Until then, the analyses run on the synthetic demo dataset so you can still see how everything works."
            />
          )}
        </Panel>
      </div>
    </div>
  )
}
