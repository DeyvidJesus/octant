import { SearchProfileSettings } from './components/SearchProfileSettings'
import { PlanCard } from './components/PlanCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { APP_NAME } from '@/constants/brand'

export function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle={`Manage your ${APP_NAME} experience.`}
      />

      <div className="space-y-6">
        <PlanCard />
        <SearchProfileSettings />
      </div>
    </div>
  )
}
