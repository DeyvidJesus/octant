import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { MasterResumePage } from '@/modules/master-resume/MasterResumePage'
import { JobBoardPage } from '@/modules/job-opportunities/JobBoardPage'
import { JobFormPage } from '@/modules/job-opportunities/JobFormPage'
import { JobAnalysisPage } from '@/modules/job-opportunities/JobAnalysisPage'
import { ApplicationsPage } from '@/modules/application-tracker/ApplicationsPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { PlaceholderPage } from '@/modules/PlaceholderPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/resume" element={<MasterResumePage />} />
        <Route path="/jobs" element={<JobBoardPage />} />
        <Route path="/jobs/new" element={<JobFormPage />} />
        <Route path="/jobs/:jobId/edit" element={<JobFormPage />} />
        <Route path="/jobs/:jobId/analysis" element={<JobAnalysisPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/generator"
          element={
            <PlaceholderPage
              title="Resume Generator"
              description="Tailored resumes assembled from your Master Resume, ranked by relevance to an analyzed job. Coming in a future increment."
            />
          }
        />
        <Route
          path="/interviews"
          element={
            <PlaceholderPage
              title="Interview Preparation"
              description="Question banks, STAR answer builder, and per-application prep dossiers. Coming in a future increment."
            />
          }
        />
        <Route
          path="/knowledge"
          element={
            <PlaceholderPage
              title="Knowledge Base"
              description="Your personal, searchable engineering wiki. Coming in a future increment."
            />
          }
        />
        <Route
          path="/metrics"
          element={
            <PlaceholderPage
              title="Career Metrics"
              description="Funnel metrics, response rates, and match score trends. Coming in a future increment."
            />
          }
        />
        <Route
          path="*"
          element={<PlaceholderPage title="Not found" description="This page does not exist." />}
        />
      </Route>
    </Routes>
  )
}
