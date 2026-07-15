import { CheckCircle2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { INTERVIEW_STAGES } from '@/constants/applicationStages'
import { StatCard } from './components/StatCard'

export function DashboardPage() {
  const applications = useApplicationsStore((state) => state.applications)

  const appliedCount = applications.filter((app) => app.stage === 'applied').length
  const interviewingCount = applications.filter((app) => INTERVIEW_STAGES.includes(app.stage)).length

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader title="Command Center" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Total Opportunities Tracked" value={applications.length} />
        <StatCard label="Active Applications" value={appliedCount} />
        <StatCard label="Interview Pipeline" value={interviewingCount} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-white mb-4">Strategic Directives</h3>
          <ul className="space-y-4">
            <li className="flex gap-3 text-sm text-ink-3">
              <CheckCircle2 size={16} className="text-ghost mt-0.5 shrink-0" aria-hidden />
              <span>Keep focusing on React/Node/Java roles to maximize existing architecture experience.</span>
            </li>
            <li className="flex gap-3 text-sm text-ink-3">
              <CheckCircle2 size={16} className="text-ghost mt-0.5 shrink-0" aria-hidden />
              <span>Update GoMech portfolio to highlight the specific AI models integrated.</span>
            </li>
            <li className="flex gap-3 text-sm text-ink-3">
              <Sparkles size={16} className="text-indigo-400 mt-0.5 shrink-0" aria-hidden />
              <span className="text-ink-2">Run the Analyzer on high-match opportunities in the board.</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
