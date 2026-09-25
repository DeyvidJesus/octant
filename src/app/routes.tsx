import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { LoginPage } from '@/modules/auth/LoginPage'
import { AuthCallbackPage } from '@/modules/auth/AuthCallbackPage'
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/modules/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { JobBoardPage } from '@/modules/job-opportunities/JobBoardPage'
import { JobFormPage } from '@/modules/job-opportunities/JobFormPage'
import { ApplicationsPage } from '@/modules/application-tracker/ApplicationsPage'
import { ApplicationFormPage } from '@/modules/application-tracker/ApplicationFormPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { GeneratorPage } from '@/modules/resume-generator/GeneratorPage'
import { PlaceholderPage } from '@/modules/PlaceholderPage'

// Heavy secondary routes are lazy-loaded; the landing Dashboard stays eager.
const JobAnalysisPage = lazy(() =>
  import('@/modules/job-opportunities/JobAnalysisPage').then((m) => ({ default: m.JobAnalysisPage })),
)
const GeneratorEditorPage = lazy(() =>
  import('@/modules/resume-generator/GeneratorEditorPage').then((m) => ({ default: m.GeneratorEditorPage })),
)
const InterviewPrepPage = lazy(() =>
  import('@/modules/interview-prep/InterviewPrepPage').then((m) => ({ default: m.InterviewPrepPage })),
)
const MetricsPage = lazy(() =>
  import('@/modules/metrics/MetricsPage').then((m) => ({ default: m.MetricsPage })),
)
const KnowledgeBasePage = lazy(() =>
  import('@/modules/knowledge-base/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage })),
)

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink-strong" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Email links land on these public routes. `/reset-password` must stay outside ProtectedRoute,
          or the recovery session would drop the user on the dashboard with the reset unfinished. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            element={
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobBoardPage />} />
            <Route path="/jobs/new" element={<JobFormPage />} />
            <Route path="/jobs/:jobId/edit" element={<JobFormPage />} />
            <Route path="/jobs/:jobId/analysis" element={<JobAnalysisPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/new" element={<ApplicationFormPage />} />
            <Route path="/applications/:applicationId/edit" element={<ApplicationFormPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/generator" element={<GeneratorPage />} />
            <Route path="/generator/:jobId" element={<GeneratorEditorPage />} />
            <Route path="/interviews" element={<InterviewPrepPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route
              path="*"
              element={<PlaceholderPage title="Not found" description="This page does not exist." />}
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
