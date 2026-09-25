import { supabase } from '@/services/supabase/client'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { BaseRepository } from './BaseRepository'

/** The user preferences blob stored in `settings.preferences`. */
export interface StoredSettings {
  discovery: DiscoveryPrefs
  onboardingCompleted: boolean
}

/** Data access for user settings; a new account with no row reads as null instead of throwing. */
export class SettingsRepository extends BaseRepository {
  async getSettings(): Promise<StoredSettings | null> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase.from('settings').select('preferences').eq('user_id', userId).maybeSingle(),
      'load your settings',
    ) as { preferences?: Partial<StoredSettings> } | null

    if (!row?.preferences) return null
    return {
      discovery: row.preferences.discovery ?? DEFAULT_DISCOVERY_PREFS,
      onboardingCompleted: row.preferences.onboardingCompleted ?? false,
    }
  }

  async saveSettings(settings: StoredSettings): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase
        .from('settings')
        .upsert({ user_id: userId, preferences: settings }, { onConflict: 'user_id' }),
      'save your settings',
    )
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const settingsRepository = new SettingsRepository()
