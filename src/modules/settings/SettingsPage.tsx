import { DiscoverySettings } from './components/DiscoverySettings'
import { PageHeader } from '@/components/ui/PageHeader'

export function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Manage your CareerOS experience."
      />

      <div className="space-y-6">
        <DiscoverySettings />
      </div>
    </div>
  )
}
