import type { AiProviderId } from '@/types/ai'

/**
 * API-key vault.
 *
 * Keys are stored under a deliberately DIFFERENT prefix than the rest of the
 * app (`careeros.secret.*`, not `careeros:*`). Backup export/import and
 * "reset to seed" all filter on the `careeros:` prefix, so secrets are
 * structurally excluded from exported JSON files — a credential can never leak
 * out of the device inside a backup a user might email or drop in cloud
 * storage. They still live in this browser's localStorage and nowhere else.
 */
const VAULT_KEY = 'careeros.secret.aiKeys'

type ApiKeyMap = Partial<Record<AiProviderId, string>>

export async function loadApiKeys(): Promise<ApiKeyMap> {
  const stored = localStorage.getItem(VAULT_KEY)
  if (!stored) return {}
  try {
    return JSON.parse(stored) as ApiKeyMap
  } catch (e) {
    return {}
  }
}

export async function saveApiKey(id: AiProviderId, key: string): Promise<void> {
  const keys = await loadApiKeys()
  keys[id] = key
  localStorage.setItem(VAULT_KEY, JSON.stringify(keys))
}

export async function removeApiKey(id: AiProviderId): Promise<void> {
  const keys = await loadApiKeys()
  delete keys[id]
  localStorage.setItem(VAULT_KEY, JSON.stringify(keys))
}

/** Wipe every stored key — used by the Settings "reset" flow. */
export async function clearAllApiKeys(): Promise<void> {
  localStorage.removeItem(VAULT_KEY)
}
