import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AI_PROVIDERS, getProviderDescriptor } from '@/services/ai/registry'
import { useSettingsStore, resolveAiRunConfig } from '@/stores/settingsStore'
import type { AiProviderId } from '@/types/ai'

const SELECT_CLASSES =
  'w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555]'

export function AiProviderSettings() {
  const ai = useSettingsStore((state) => state.ai)
  const apiKeys = useSettingsStore((state) => state.apiKeys)
  const setProvider = useSettingsStore((state) => state.setProvider)
  const setModel = useSettingsStore((state) => state.setModel)
  const setBaseUrl = useSettingsStore((state) => state.setBaseUrl)
  const setApiKey = useSettingsStore((state) => state.setApiKey)
  const clearApiKey = useSettingsStore((state) => state.clearApiKey)

  // Pull saved keys from the vault into memory on first mount.
  useEffect(() => {
    void useSettingsStore.getState().hydrateKeys()
  }, [])

  const descriptor = ai.providerId ? getProviderDescriptor(ai.providerId) : undefined
  const ready = useMemo(() => resolveAiRunConfig(ai, apiKeys) !== null, [ai, apiKeys])
  const savedKey = ai.providerId ? apiKeys[ai.providerId] : undefined

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-lg font-medium text-white">AI Provider</h3>
        {ai.providerId && (
          <Badge tone={ready ? 'emerald' : 'red'}>{ready ? 'Ready' : 'Needs setup'}</Badge>
        )}
      </div>
      <p className="text-sm text-muted mb-6">
        CareerOS is provider-agnostic. Deterministic analysis (scoring, matching, keywords) always
        runs locally; the AI adds recruiter-grade judgment on top. Keys are stored only in this
        browser and are <strong className="text-ink-3">never included in backups</strong>.
      </p>

      <div className="space-y-5">
        <Field label="Provider" htmlFor="ai-provider">
          <select
            id="ai-provider"
            className={SELECT_CLASSES}
            value={ai.providerId ?? ''}
            onChange={(event) => setProvider((event.target.value || null) as AiProviderId | null)}
          >
            <option value="">None (deterministic only)</option>
            {AI_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          {descriptor?.hint && <p className="text-xs text-faint mt-1.5">{descriptor.hint}</p>}
        </Field>

        {descriptor && (
          <>
            <Field label="Model" htmlFor="ai-model">
              <Input
                id="ai-model"
                list="ai-model-options"
                value={ai.model}
                placeholder="Model id"
                onChange={(event) => setModel(event.target.value)}
              />
              <datalist id="ai-model-options">
                {descriptor.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </datalist>
            </Field>

            {descriptor.allowsCustomBaseUrl && (
              <Field label="Endpoint URL" htmlFor="ai-base-url">
                <Input
                  id="ai-base-url"
                  value={ai.baseUrl ?? ''}
                  placeholder={descriptor.defaultBaseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </Field>
            )}

            {descriptor.requiresApiKey && (
              <ApiKeyField
                providerId={descriptor.id}
                savedKey={savedKey}
                docsUrl={descriptor.docsUrl}
                onSave={(key) => setApiKey(descriptor.id, key)}
                onClear={() => clearApiKey(descriptor.id)}
              />
            )}
          </>
        )}
      </div>
    </Card>
  )
}

interface ApiKeyFieldProps {
  providerId: AiProviderId
  savedKey?: string
  docsUrl?: string
  onSave: (key: string) => void
  onClear: () => void
}

function ApiKeyField({ providerId, savedKey, docsUrl, onSave, onClear }: ApiKeyFieldProps) {
  const [draft, setDraft] = useState('')

  // Reset the input when the saved key changes (e.g. switching providers).
  useEffect(() => {
    setDraft('')
  }, [providerId, savedKey])

  return (
    <Field label="API Key" htmlFor="ai-api-key">
      {savedKey ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 text-sm text-emerald-400">
            <Check size={15} aria-hidden />
            Key saved ({mask(savedKey)})
          </div>
          <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={onClear}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            value={draft}
            placeholder="Paste your API key"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && draft.trim()) onSave(draft.trim())
            }}
          />
          <Button variant="subtle" disabled={!draft.trim()} onClick={() => onSave(draft.trim())}>
            <KeyRound size={14} aria-hidden /> Save
          </Button>
        </div>
      )}
      {docsUrl && !savedKey && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink-3 mt-2"
        >
          Get an API key <ExternalLink size={11} aria-hidden />
        </a>
      )}
    </Field>
  )
}

function mask(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}
