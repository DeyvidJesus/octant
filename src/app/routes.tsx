import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { MasterResumePage } from '@/modules/master-resume/MasterResumePage'
import { JobBoardPage } from '@/modules/job-opportunities/JobBoardPage'
import { JobFormPage } from '@/modules/job-opportunities/JobFormPage'
import { JobAnalysisPage } from '@/modules/job-opportunities/JobAnalysisPage'
import { JobDiscoveryPage } from '@/modules/job-discovery/JobDiscoveryPage'
import { GeneratorPage } from '@/modules/resume-generator/GeneratorPage'
import { GeneratorEditorPage } from '@/modules/resume-generator/GeneratorEditorPage'
import { ApplicationsPage } from '@/modules/application-tracker/ApplicationsPage'
import { ApplicationFormPage } from '@/modules/application-tracker/ApplicationFormPage'
import { InterviewPrepPage } from '@/modules/interview-prep/InterviewPrepPage'
import { MetricsPage } from '@/modules/metrics/MetricsPage'
import { KnowledgeBasePage } from '@/modules/knowledge-base/KnowledgeBasePage'
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
        <Route path="/jobs/discovery" element={<JobDiscoveryPage />} />
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
    </Routes>
  )
}
