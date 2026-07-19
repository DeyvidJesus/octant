import type {
  CareerFact,
  CareerKnowledgeBase,
  KnowledgeSkill,
  Organization,
  Role,
} from '@/types/resume'

/**
 * Pure (I/O-free) helpers for the knowledge-base normalization: splitting the graph into the four
 * relational collections + a residual document, reassembling it, and computing per-row diffs so a
 * single edit persists as a single-row write. Kept separate from `KnowledgeBaseRepository` so this
 * data-loss-sensitive logic can be unit-tested without Supabase.
 */

/** The knowledge base minus the four normalized collections — persisted as the residual JSONB. */
export type KnowledgeBaseResidual = Omit<
  CareerKnowledgeBase,
  'organizations' | 'roles' | 'skills' | 'facts'
>

/** The four collections extracted into their own tables. */
export interface NormalizedCollections {
  organizations: Organization[]
  roles: Role[]
  skills: KnowledgeSkill[]
  facts: CareerFact[]
}

/** Splits a knowledge base into the normalized collections and the residual document. */
export function splitKnowledgeBase(
  knowledgeBase: CareerKnowledgeBase,
): NormalizedCollections & { residual: KnowledgeBaseResidual } {
  const { organizations, roles, skills, facts, ...residual } = knowledgeBase
  return { organizations, roles, skills, facts, residual }
}

/** Reassembles a full knowledge base from the residual document and the four collections. */
export function assembleKnowledgeBase(
  residual: KnowledgeBaseResidual,
  collections: NormalizedCollections,
): CareerKnowledgeBase {
  return { ...residual, ...collections }
}

export interface RowDiff<T> {
  /** Rows to insert or update (new ids, or existing ids whose payload changed). */
  upserts: T[]
  /** Ids present before but absent now — rows to delete. */
  deleteIds: string[]
}

/**
 * Computes the row-level diff between two versions of a collection, keyed by id. A row is upserted
 * only when it is new or its serialized payload changed, so editing one entity in a large
 * collection yields exactly one upsert.
 *
 * Change detection uses JSON serialization. Both sides originate from the same persisted baseline
 * (or in-memory seed) and edits are produced by object spread, so key ordering is stable between
 * an unchanged row's two versions — an unchanged row serializes identically and is skipped.
 */
export function diffById<T extends { id: string }>(prev: T[], next: T[]): RowDiff<T> {
  const prevById = new Map(prev.map((entity) => [entity.id, entity]))
  const nextIds = new Set(next.map((entity) => entity.id))

  const upserts = next.filter((entity) => {
    const before = prevById.get(entity.id)
    return before === undefined || JSON.stringify(before) !== JSON.stringify(entity)
  })
  const deleteIds = prev.filter((entity) => !nextIds.has(entity.id)).map((entity) => entity.id)

  return { upserts, deleteIds }
}

/**
 * True when any residual collection differs, ignoring the always-advancing `updatedAt`. Lets a
 * pure facts/roles/skills/orgs edit skip re-writing the residual document entirely.
 */
export function residualChanged(prev: KnowledgeBaseResidual, next: KnowledgeBaseResidual): boolean {
  return JSON.stringify({ ...prev, updatedAt: '' }) !== JSON.stringify({ ...next, updatedAt: '' })
}
