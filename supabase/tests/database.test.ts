import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { MIGRATIONS, applyMigration, asUser, createDatabase, createUser } from './harness'

// Integration tests against a real Postgres (PGlite): the schema, every migration, RLS and the JSONB checks.

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  company: 'Acme',
  role: 'Frontend Engineer',
  description: 'Build UIs',
  tags: [],
  archived: false,
  ...extra,
})

async function insertJob(db: PGlite, userId: string, data: unknown, id = (data as { id?: string }).id ?? randomUUID()) {
  await db.query('insert into public.jobs (id, user_id, data) values ($1, $2, $3)', [id, userId, JSON.stringify(data)])
}

describe('migrations', () => {
  it('apply cleanly on a fresh database', async () => {
    const db = await createDatabase()
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_constraint where conname like '%\\_data\\_shape'",
    )
    expect(rows[0].n).toBe(13)
  }, 60_000)

  it('are idempotent: running them all a second time changes nothing', async () => {
    const db = await createDatabase()
    for (const file of MIGRATIONS) await applyMigration(db, file)
  }, 60_000)
})

describe('JSONB shape checks (0017)', () => {
  let db: PGlite
  const userId = randomUUID()

  beforeAll(async () => {
    db = await createDatabase()
    await createUser(db, userId)
  }, 60_000)

  it('accepts the documents the app writes', async () => {
    const id = randomUUID()
    await insertJob(db, userId, job(id))
    const appId = randomUUID()
    await db.query('insert into public.applications (id, user_id, data) values ($1, $2, $3)', [
      appId,
      userId,
      JSON.stringify({ id: appId, company: 'Acme', role: 'Engineer', stage: 'applied', events: [] }),
    ])
    await db.query('insert into public.job_analyses (user_id, job_id, data) values ($1, $2, $3)', [
      userId,
      id,
      JSON.stringify({ jobId: id, match: { atsScore: 80 } }),
    ])
  })

  it.each([
    ['a document whose id differs from the row id', () => job(randomUUID()), randomUUID()],
    ['a document without company', () => { const { company: _drop, ...rest } = job(randomUUID()); return rest }, undefined],
    ['a non-string role', () => job(randomUUID(), { role: 42 }), undefined],
    ['a JSON array instead of an object', () => [1, 2, 3], randomUUID()],
    ['a document over 256 KB', () => job(randomUUID(), { description: 'x'.repeat(270_000) }), undefined],
  ])('rejects %s', async (_label, build, rowId) => {
    const data = build()
    await expect(insertJob(db, userId, data, rowId)).rejects.toThrow(/jobs_data_shape/)
  })

  it('rejects an application with an unknown stage or without an events array', async () => {
    const insert = (data: Record<string, unknown>) =>
      db.query('insert into public.applications (id, user_id, data) values ($1, $2, $3)', [data.id, userId, JSON.stringify(data)])
    const base = { company: 'Acme', role: 'Engineer', events: [] }
    await expect(insert({ id: randomUUID(), ...base, stage: 'teleported' })).rejects.toThrow(/applications_data_shape/)
    await expect(insert({ id: randomUUID(), ...base, stage: 'applied', events: null })).rejects.toThrow(/applications_data_shape/)
  })

  it('rejects an analysis filed under another job', async () => {
    const jobId = randomUUID()
    await insertJob(db, userId, job(jobId))
    await expect(
      db.query('insert into public.job_analyses (user_id, job_id, data) values ($1, $2, $3)', [
        userId,
        jobId,
        JSON.stringify({ jobId: randomUUID(), match: {} }),
      ]),
    ).rejects.toThrow(/job_analyses_data_shape/)
  })
})

describe('0017 on a database that already holds bad rows', () => {
  it('still applies, leaves the affected constraint NOT VALID, and checks new writes', async () => {
    const db = await createDatabase({ before: '0017' })
    const userId = randomUUID()
    await createUser(db, userId)
    await insertJob(db, userId, { legacy: true }, randomUUID())

    await applyMigration(db, '0017_jsonb_shape_checks.sql')

    const { rows } = await db.query<{ conname: string; convalidated: boolean }>(
      "select conname, convalidated from pg_constraint where conname in ('jobs_data_shape', 'applications_data_shape')",
    )
    expect(Object.fromEntries(rows.map((r) => [r.conname, r.convalidated]))).toEqual({
      jobs_data_shape: false,
      applications_data_shape: true,
    })
    await expect(insertJob(db, userId, { legacy: true }, randomUUID())).rejects.toThrow(/jobs_data_shape/)
  }, 60_000)
})

describe('row level security', () => {
  let db: PGlite
  const alice = randomUUID()
  const bob = randomUUID()

  beforeAll(async () => {
    db = await createDatabase()
    await createUser(db, alice)
    await createUser(db, bob)
  }, 60_000)

  it('caps Free users at 3 jobs but lets them re-save an existing one', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    await asUser(db, alice, async () => {
      for (const id of ids) await insertJob(db, alice, job(id))
      await expect(insertJob(db, alice, job(randomUUID()))).rejects.toThrow(/row-level security/)
      await db.query(
        'insert into public.jobs (id, user_id, data) values ($1, $2, $3) on conflict (id) do update set data = excluded.data',
        [ids[0], alice, JSON.stringify(job(ids[0], { role: 'Renamed' }))],
      )
    })
  })

  it('hides one user’s rows from another', async () => {
    const { rows } = await asUser(db, bob, () => db.query('select id from public.jobs'))
    expect(rows).toEqual([])
  })

  it('does not let clients call the unsubscribe-token function (0016)', async () => {
    await expect(asUser(db, bob, () => db.query('select public.email_unsubscribe_token($1)', [alice]))).rejects.toThrow(
      /permission denied/,
    )
  })

  it('does not let clients write their own tier', async () => {
    await expect(
      asUser(db, alice, () => db.query("insert into public.subscriptions (user_id, tier) values ($1, 'pro')", [alice])),
    ).rejects.toThrow(/row-level security|permission denied/)
  })
})

describe('Stripe event ordering (0018)', () => {
  it('applies newer events and ignores older ones', async () => {
    const db = await createDatabase()
    const userId = randomUUID()
    await createUser(db, userId)
    const apply = async (tier: string, createdAt: string) => {
      const { rows } = await db.query<{ applied: boolean }>(
        'select public.apply_subscription_event($1, $2, $3, $4, $5, null, $6) as applied',
        [userId, tier, tier === 'pro' ? 'active' : 'canceled', 'cus_1', 'sub_1', createdAt],
      )
      return rows[0].applied
    }
    const tier = async () =>
      (await db.query<{ tier: string }>('select tier from public.subscriptions where user_id = $1', [userId])).rows[0].tier

    expect(await apply('pro', '2026-09-01T10:00:00Z')).toBe(true)
    expect(await apply('free', '2026-09-02T10:00:00Z')).toBe(true) // cancellation
    expect(await apply('pro', '2026-09-01T12:00:00Z')).toBe(false) // late `.updated` from before the cancellation
    expect(await tier()).toBe('free')
  }, 60_000)

  it('is not callable by clients', async () => {
    const db = await createDatabase()
    const userId = randomUUID()
    await createUser(db, userId)
    await expect(
      asUser(db, userId, () =>
        db.query("select public.apply_subscription_event($1, 'pro', 'active', 'c', 's', null, now())", [userId]),
      ),
    ).rejects.toThrow(/permission denied/)
  }, 60_000)
})
