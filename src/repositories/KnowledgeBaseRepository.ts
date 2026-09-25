import type { CareerFact, CareerKnowledgeBase, KnowledgeSkill, Organization, Role } from '@/types/resume'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'
import {
  assembleKnowledgeBase,
  diffById,
  residualChanged,
  splitKnowledgeBase,
  type KnowledgeBaseResidual,
  type RowDiff,
} from './knowledgeBaseGraph'

/** A `{ data }` projection of any normalized row. */
interface DataRow<T> {
  data: T
}

/** Tables holding a normalized collection as `{ id, user_id, data }`. */
type NormalizedTable = 'resume_skills' | 'resume_facts'

/** Knowledge base data access: orgs, roles, skills and facts are tables; the rest is a residual JSONB. */
// Edits are written as per-row diffs, so changing one bullet is a single-row UPDATE.
export class KnowledgeBaseRepository extends BaseRepository {
  /** Reassembles the full knowledge base from the residual document + the four tables. */
  async getKnowledgeBase(): Promise<CareerKnowledgeBase | null> {
    const userId = this.requireUserId()

    const [residualResult, orgResult, roleResult, skillResult, factResult] = await Promise.all([
      supabase.from('resumes').select('knowledge_base').eq('user_id', userId).maybeSingle(),
      supabase.from('resume_organizations').select('data').eq('user_id', userId),
      supabase.from('resume_roles').select('data').eq('user_id', userId),
      supabase.from('resume_skills').select('data').eq('user_id', userId),
      supabase.from('resume_facts').select('data').eq('user_id', userId),
    ])

    const residualRow = this.unwrap(residualResult, 'load your resume') as
      | { knowledge_base: KnowledgeBaseResidual }
      | null
    // No residual document means nothing has been persisted yet — let the store keep its seed.
    if (!residualRow) return null

    const orgRows = this.unwrap(orgResult, 'load your resume organizations') as DataRow<Organization>[] | null
    const roleRows = this.unwrap(roleResult, 'load your resume roles') as DataRow<Role>[] | null
    const skillRows = this.unwrap(skillResult, 'load your resume skills') as DataRow<KnowledgeSkill>[] | null
    const factRows = this.unwrap(factResult, 'load your resume facts') as DataRow<CareerFact>[] | null

    return assembleKnowledgeBase(residualRow.knowledge_base, {
      organizations: (orgRows ?? []).map((row) => row.data),
      roles: (roleRows ?? []).map((row) => row.data),
      skills: (skillRows ?? []).map((row) => row.data),
      facts: (factRows ?? []).map((row) => row.data),
    })
  }

  /** Persists `prev` to `next` as per-row writes (`prev` null means insert everything). */
  // Organizations are written before roles to satisfy the FK; the residual goes last.
  async applyChanges(prev: CareerKnowledgeBase | null, next: CareerKnowledgeBase): Promise<void> {
    const userId = this.requireUserId()
    const before = prev
      ? splitKnowledgeBase(prev)
      : { organizations: [], roles: [], skills: [], facts: [], residual: null }
    const after = splitKnowledgeBase(next)

    await this.writeOrganizations(userId, diffById(before.organizations, after.organizations))
    await this.writeRoles(userId, diffById(before.roles, after.roles), after.organizations)
    await this.writeCollection(userId, 'resume_skills', diffById(before.skills, after.skills))
    await this.writeCollection(userId, 'resume_facts', diffById(before.facts, after.facts))

    if (!before.residual || residualChanged(before.residual, after.residual)) {
      await this.saveResidual(userId, after.residual)
    }
  }

  private async writeOrganizations(userId: string, diff: RowDiff<Organization>): Promise<void> {
    if (diff.upserts.length > 0) {
      const rows = diff.upserts.map((org) => ({ id: org.id, user_id: userId, data: org }))
      this.unwrap(await supabase.from('resume_organizations').upsert(rows), 'save your resume organizations')
    }
    await this.deleteRows(userId, 'resume_organizations', diff.deleteIds, 'remove resume organizations')
  }

  private async writeRoles(userId: string, diff: RowDiff<Role>, organizations: Organization[]): Promise<void> {
    if (diff.upserts.length > 0) {
      const orgIds = new Set(organizations.map((org) => org.id))
      const rows = diff.upserts.map((role) => ({
        id: role.id,
        user_id: userId,
        // A dangling organizationId is stored as null instead of violating the FK.
        organization_id: orgIds.has(role.organizationId) ? role.organizationId : null,
        data: role,
      }))
      this.unwrap(await supabase.from('resume_roles').upsert(rows), 'save your resume roles')
    }
    await this.deleteRows(userId, 'resume_roles', diff.deleteIds, 'remove resume roles')
  }

  private async writeCollection<T extends { id: string }>(
    userId: string,
    table: NormalizedTable,
    diff: RowDiff<T>,
  ): Promise<void> {
    if (diff.upserts.length > 0) {
      const rows = diff.upserts.map((entity) => ({ id: entity.id, user_id: userId, data: entity }))
      this.unwrap(await supabase.from(table).upsert(rows), `save your ${table.replace('resume_', 'resume ')}`)
    }
    await this.deleteRows(userId, table, diff.deleteIds, `remove ${table.replace('resume_', 'resume ')}`)
  }

  private async deleteRows(
    userId: string,
    table: 'resume_organizations' | 'resume_roles' | NormalizedTable,
    ids: string[],
    action: string,
  ): Promise<void> {
    if (ids.length === 0) return
    this.unwrap(await supabase.from(table).delete().eq('user_id', userId).in('id', ids), action)
  }

  private async saveResidual(userId: string, residual: KnowledgeBaseResidual): Promise<void> {
    // `resumes.user_id` is UNIQUE, but this upsert does not yet use it as the conflict target.
    this.unwrap(
      await supabase.from('resumes').upsert({ user_id: userId, knowledge_base: residual }),
      'save your resume',
    )
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const knowledgeBaseRepository = new KnowledgeBaseRepository()
