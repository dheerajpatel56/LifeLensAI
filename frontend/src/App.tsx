import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { DatasetProvider } from './hooks/useDataset'
import { OverviewPage } from './pages/OverviewPage'
import { CheckInPage } from './pages/CheckInPage'
import { PatternsPage } from './pages/PatternsPage'
import { InsightsPage } from './pages/InsightsPage'
import { DatasetsPage } from './pages/DatasetsPage'
import { AboutPage } from './pages/AboutPage'

export default function App() {
  return (
    <DatasetProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/check-in" element={<CheckInPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-line-strong)',
            color: 'var(--color-ink)',
            borderRadius: '4px',
            fontSize: '0.8125rem',
          },
        }}
      />
    </DatasetProvider>
  )
}
