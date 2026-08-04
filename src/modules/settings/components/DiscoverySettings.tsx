import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { useSettingsStore } from '@/stores/settingsStore'

/** Preferences that shape every discovery prompt (sweep and Deep Research). */
export function DiscoverySettings() {
  const discovery = useSettingsStore((state) => state.discovery)
  const setDiscoveryPrefs = useSettingsStore((state) => state.setDiscoveryPrefs)

  return (
    <Card>
      <h3 className="text-lg font-medium text-white mb-2">Job Discovery</h3>
      <p className="text-sm text-muted mb-6">
        These preferences steer the AI job search (Web Sweep and Deep Research on the Import &
        Discover page). Leave blank to derive everything from your Master Resume.
      </p>

      <div className="space-y-5">
        <Field label="Target Roles" htmlFor="disc-roles">
          <Input
            id="disc-roles"
            value={discovery.targetRoles}
            placeholder="e.g. Software Engineer, Full Stack Engineer, Product Engineer"
            onChange={(event) => setDiscoveryPrefs({ targetRoles: event.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Regions / Work Mode" htmlFor="disc-regions">
            <Input
              id="disc-regions"
              value={discovery.regions}
              placeholder="e.g. Remote — US, Canada, Europe (LATAM-friendly)"
              onChange={(event) => setDiscoveryPrefs({ regions: event.target.value })}
            />
          </Field>
          <Field label="Seniority" htmlFor="disc-seniority">
            <Input
              id="disc-seniority"
              value={discovery.seniority}
              placeholder="e.g. junior / mid-level"
              onChange={(event) => setDiscoveryPrefs({ seniority: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Additional Instructions" htmlFor="disc-extra">
          <Textarea
            id="disc-extra"
            rows={3}
            value={discovery.extraInstructions}
            placeholder="e.g. Prefer product companies over agencies. Avoid crypto."
            onChange={(event) => setDiscoveryPrefs({ extraInstructions: event.target.value })}
          />
        </Field>
      </div>
    </Card>
  )
}
