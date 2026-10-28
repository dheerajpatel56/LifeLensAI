import { PageHeader } from '../components/layout/PageHeader'
import { Callout, Panel } from '../components/ui'

const PIPELINE = [
  { stage: 'Data collection', detail: 'Daily check-in form, CSV import, or the synthetic demo dataset.' },
  { stage: 'Cleaning', detail: 'Type coercion, range checks, impossible values blanked, invalid dates dropped.' },
  { stage: 'Transformation', detail: 'Standardisation for clustering; fixed-band discretisation for rules.' },
  { stage: 'Data mining', detail: 'K-Means, Pearson/Spearman correlation, Apriori association rules.' },
  { stage: 'Evaluation', detail: 'Silhouette score, pairwise sample sizes, support / confidence / lift.' },
  { stage: 'Insights', detail: 'Deterministic templates filled with the computed numbers.' },
  { stage: 'Visualisation', detail: 'Trends, scatter plots, PCA projection, correlation heatmap, rule charts.' },
]

const TECHNIQUES = [
  {
    name: 'Classification',
    used: false,
    what: 'Learns a mapping from features to a known label, then predicts that label for new records.',
    why: 'There is no ground-truth label to predict here. Mood and productivity are the user’s own ratings, recorded on the same day as the features, so "predicting" them would be circular — and treating a self-report as an objective target would overstate what the data can support.',
  },
  {
    name: 'Clustering',
    used: true,
    what: 'Groups records by similarity without any labels. LifeLens uses K-Means on standardised lifestyle features.',
    why: 'The real question is "what kinds of days do I have?", which is a grouping question, not a prediction question. Clusters surface routine archetypes that no one had to define in advance.',
  },
  {
    name: 'Correlation analysis',
    used: true,
    what: 'Measures the strength and direction of the relationship between two numeric variables.',
    why: 'It answers the other real question — "which habits move with mood and productivity?" — and it does so with a number whose uncertainty can be stated honestly through sample size.',
  },
  {
    name: 'Association-rule mining',
    used: true,
    what: 'Finds combinations of discrete items that co-occur more often than chance, scored by support, confidence and lift.',
    why: 'Correlation handles pairs of numbers; rules handle combinations. "Short sleep plus high stress" is a joint condition that a pairwise coefficient cannot express.',
  },
]

const FAQ = [
  {
    question: 'How does K-Means work?',
    answer:
      'Pick k centroids, assign every record to its nearest centroid, move each centroid to the mean of the records assigned to it, and repeat until assignments stop changing. It minimises within-cluster squared distance. LifeLens fixes random_state = 42 and uses n_init = 10, so the same data always produces the same grouping.',
  },
  {
    question: 'Why standardise the features first?',
    answer:
      'K-Means measures straight-line distance, so a feature with a large numeric range dominates one with a small range. Exercise runs 0–1440 minutes while sleep quality runs 1–10; without scaling, exercise alone would decide the clusters. StandardScaler puts every feature at mean 0 and standard deviation 1 so each one contributes comparably.',
  },
  {
    question: 'How do I read the silhouette score?',
    answer:
      'It runs from −1 to +1 and compares how close each record sits to its own cluster against the nearest other cluster. Near +1 means tight, well-separated groups; near 0 means the groups overlap and the boundary is arbitrary; negative means records would fit a different cluster better. Real lifestyle data overlaps heavily, so a modest positive score is the honest expected result — LifeLens shows the number rather than hiding it.',
  },
  {
    question: 'What are support, confidence and lift?',
    answer:
      'For a rule X → Y over N days: support is the share of all N days containing both X and Y; confidence is the share of X-days that also contain Y; lift is confidence divided by Y’s own overall frequency. Lift above 1 means X and Y appear together more often than they would if independent. Lift of exactly 1 means the rule tells you nothing beyond base rates.',
  },
  {
    question: 'Why is correlation not causation?',
    answer:
      'A coefficient only measures co-movement. Three other explanations always remain: the arrow could run the other way (a good day makes you exercise, rather than exercise making the day good), a third factor could drive both (exam week compresses sleep and raises stress at once), or the pattern could be coincidence in a small sample. Nothing in this dataset can rule those out, so LifeLens never claims it has.',
  },
  {
    question: 'How was the demo dataset generated?',
    answer:
      'A seeded script samples one of five routine profiles per day, draws habit values from that profile’s distributions, derives social media use as a fraction of screen time, and then computes mood and productivity as a weighted sum of habits plus Gaussian noise with standard deviation ≈ 2.05. The noise is deliberately large so observed correlations land in the moderate 0.4–0.6 band rather than looking artificially perfect.',
  },
  {
    question: 'What does this application measure, and what can it not claim?',
    answer:
      'It measures what the user typed, and it describes statistical structure inside that data. It cannot claim clinical validity, cannot diagnose anything, cannot establish that any habit causes any outcome, and cannot generalise beyond the person whose data it holds.',
  },
]

export function AboutPage() {
  return (
    <div>
      <PageHeader
        title="About & methodology"
        lede="What this project claims, how it computes it, and where it stops. Written to be defended out loud."
      />

      <div className="flex flex-col gap-5">
        <Callout tone="warning" title="Scope limits, stated up front">
          LifeLens AI is a student data-mining project. It is not a medical device, not a diagnostic
          tool, and not clinically validated. Mood and productivity are self-reported ratings, never
          inferred from sensors, notes or screen time. Every relationship it reports is an
          association inside one dataset.
        </Callout>

        <Panel title="Problem statement">
          <div className="measure flex flex-col gap-3 text-sm text-body">
            <p>
              People generate a dense trail of daily lifestyle data — how long they slept, how long
              they stared at a screen, whether they moved, how much caffeine they drank — and almost
              none of it is ever examined. The patterns connecting those habits to how a day actually
              felt stay hidden, because nobody sits down and mines their own records.
            </p>
            <p>
              Consumer wellness apps mostly do not help: they either display raw logs with no
              analysis, or they assert conclusions with no visible evidence and no sample size. The
              gap is not data collection. It is honest, inspectable pattern discovery on data a
              person already has.
            </p>
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Motivation">
            <ul className="measure flex flex-col gap-2 text-sm text-body">
              {[
                'Demonstrate a complete data-mining pipeline end to end, not a single algorithm in isolation.',
                'Apply unsupervised techniques to a problem where they are genuinely the right choice.',
                'Show that analytical honesty — sample sizes, caveats, visible limitations — makes a tool more useful, not less.',
                'Keep every byte on the user’s own machine: no accounts, no API keys, no uploads.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Objectives">
            <ol className="measure flex list-decimal flex-col gap-2 pl-5 text-sm text-body">
              {[
                'Capture daily lifestyle data with validation strict enough that bad records never reach the models.',
                'Discover routine archetypes with K-Means over standardised features.',
                'Quantify habit–outcome relationships with correlation analysis, reporting each pair’s own sample size.',
                'Mine multi-condition patterns with Apriori, reporting support, confidence and lift.',
                'Explain every result in plain language generated deterministically from the computed numbers.',
                'Handle empty, sparse and malformed data without inventing results.',
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </Panel>
        </div>

        <Panel
          title="The pipeline"
          description="Each stage is a real module in the codebase, not a diagram drawn after the fact."
        >
          <ol className="flex flex-col gap-0">
            {PIPELINE.map((step, index) => (
              <li key={step.stage} className="flex gap-3.5">
                {/* Connector line drawn with a border, so the sequence reads vertically. */}
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/12 text-2xs font-semibold text-accent-ink"
                  >
                    {index + 1}
                  </span>
                  {index < PIPELINE.length - 1 && (
                    <span aria-hidden className="w-px flex-1 bg-line" />
                  )}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-medium text-ink">{step.stage}</p>
                  <p className="measure text-sm text-muted">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="System architecture"
          description="Two processes on one machine. The browser never touches the database."
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                {
                  layer: 'Frontend',
                  stack: 'React 19 · Vite · TypeScript · Tailwind · Recharts',
                  role: 'Renders pages, validates input for fast feedback, calls the API. Holds no business logic.',
                },
                {
                  layer: 'API',
                  stack: 'FastAPI · Pydantic · Uvicorn',
                  role: 'Typed request/response schemas, server-side validation, consistent error shapes.',
                },
                {
                  layer: 'Analytics engine',
                  stack: 'pandas · NumPy · scikit-learn · SciPy',
                  role: 'Preprocessing, K-Means, PCA, correlation, Apriori, insight templating.',
                },
                {
                  layer: 'Storage',
                  stack: 'SQLAlchemy · SQLite',
                  role: 'One table, three logically separated sources, date uniqueness per source.',
                },
              ].map((entry) => (
                <div key={entry.layer} className="rounded-[10px] border border-line bg-surface px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{entry.layer}</p>
                  <p className="mt-0.5 text-2xs text-accent-ink">{entry.stack}</p>
                  <p className="mt-1.5 text-xs text-muted">{entry.role}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[10px] border border-line bg-base-deep px-4 py-4">
              <pre className="m-0 text-2xs leading-relaxed text-muted">
{`  Browser (localhost:5173)
        │  fetch /api/*  (JSON over HTTP)
        ▼
  FastAPI (localhost:8000)
        │
        ├─ api/routes/        request validation, HTTP status, error shaping
        │
        ├─ services/          preprocessing → clustering / correlation / rules
        │                     → insight_service (deterministic templates)
        │
        └─ db/                SQLAlchemy ORM → SQLite file (lifelens.db)
                              sources: demo | user | import  (never merged)`}
              </pre>
            </div>
          </div>
        </Panel>

        <Panel
          title="Why these techniques, and why not classification"
          description="The honest answer to the most likely question about this project."
        >
          <div className="flex flex-col gap-3">
            {TECHNIQUES.map((technique) => (
              <div
                key={technique.name}
                className="rounded-[10px] border border-line bg-surface px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{technique.name}</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${
                      technique.used
                        ? 'border-positive/35 bg-positive/12 text-positive'
                        : 'border-line bg-raised text-muted'
                    }`}
                  >
                    {technique.used ? 'Used in LifeLens' : 'Deliberately not used'}
                  </span>
                </div>
                <p className="measure mt-1.5 text-sm text-body">{technique.what}</p>
                <p className="measure mt-1.5 text-sm text-muted">{technique.why}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Dataset and preprocessing"
          description="What goes into the models, and what is excluded on principle."
        >
          <div className="measure flex flex-col gap-3 text-sm text-body">
            <p>
              The built-in dataset holds 1,200 synthetic daily records generated from five routine
              profiles with a fixed seed. It is labelled synthetic everywhere it appears, and it is
              never presented as a real-world finding. Users can also type their own check-ins or
              import a CSV; the three sources are stored separately and only one is analysed at a time.
            </p>
            <p>
              Preprocessing coerces every numeric column, blanks values outside the documented valid
              range rather than discarding whole rows, and drops records with an unparseable date.
              Record identifiers, dates and free-text notes are excluded from every feature matrix.
            </p>
            <p>
              Clustering needs a single consistent, NaN-free row subset, so rows missing more than
              half of the selected features are dropped and the remaining gaps are median-imputed —
              with the count of every imputation reported. Correlation takes the opposite approach:
              each pair is computed on its own pairwise-complete observations, and that pair’s sample
              size is carried through to the interface.
            </p>
            <p>
              Constant columns are excluded from both, with the reason shown, because zero variance
              carries no information for either technique.
            </p>
          </div>
        </Panel>

        <Panel title="Evaluation" description="How each technique is judged, and the limits of each measure.">
          <dl className="flex flex-col gap-3 text-sm">
            {[
              [
                'Clustering',
                'Silhouette score (reported only when mathematically defined), inertia, cluster sizes and per-feature profiles. Silhouette is computed only when there are at least two labels, fewer labels than samples, and more distinct observations than clusters.',
              ],
              [
                'Correlation',
                'Coefficient plus that pair’s sample size, plus an evidence band (insufficient / limited / reasonable) against a configurable minimum. A p-value is shown where SciPy can compute one, described as a test of the no-association null and explicitly not corrected for multiple comparisons.',
              ],
              [
                'Association rules',
                'Support, confidence and lift computed directly from itemset counts, with the number of matching days shown so a rule resting on five days cannot masquerade as a finding.',
              ],
              [
                'Backend correctness',
                '74 pytest tests, including association-rule arithmetic checked against a hand-computed 10-row table and correlation output checked against NumPy on the same slice.',
              ],
            ].map(([term, detail]) => (
              <div key={term} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="measure mt-1 text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Questions this project should be able to answer">
          <div className="flex flex-col gap-3">
            {FAQ.map((entry) => (
              <details
                key={entry.question}
                className="group rounded-[10px] border border-line bg-surface px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-ink marker:text-faint">
                  {entry.question}
                </summary>
                <p className="measure mt-2 text-sm text-body">{entry.answer}</p>
              </details>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Known limitations">
            <ul className="measure flex flex-col gap-2 text-sm text-body">
              {[
                'Self-reported mood and productivity carry recall bias, mood-congruent reporting and inconsistent personal scales.',
                'Features and outcomes are recorded for the same day, so no temporal ordering is established and no lag effects are modelled.',
                'The demo dataset is simulated; its relationships are artefacts of the generator.',
                'K-Means assumes roughly spherical, comparably sized clusters, which real routine data does not guarantee.',
                'Association-rule bands are fixed cut points; a day at 5.9 hours of sleep and one at 3 hours both read as “Short”.',
                'No multiple-comparison correction is applied, so some correlations in a wide matrix will look notable by chance.',
                'Single-user, single-machine, no authentication — it is a local prototype, not a multi-tenant product.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Future enhancements">
            <ul className="measure flex flex-col gap-2 text-sm text-body">
              {[
                'Lagged correlation, to test whether last night’s sleep tracks today’s productivity rather than the same day’s.',
                'Comparison of two date ranges side by side, to see whether a routine change moved anything.',
                'Quantile-based binning as an alternative to fixed bands, with both shown for comparison.',
                'Hierarchical or DBSCAN clustering as a cross-check on the K-Means grouping.',
                'A downloadable analytics report containing the computed figures and their caveats.',
                'Multiple-comparison correction on the correlation matrix.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-cyan" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
