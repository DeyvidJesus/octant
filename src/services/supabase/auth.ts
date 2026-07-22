import { supabase } from './client'

/**
 * Signs the user out. The resulting `onAuthStateChange(null)` drives AuthContext to wipe every store
 * (see `resetAllStores`), so no in-memory data is left behind for the next session on this browser.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
