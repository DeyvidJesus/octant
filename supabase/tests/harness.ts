import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const ROOT = path.resolve(__dirname, '..', '..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

// The pieces of a Supabase project the SQL depends on: roles, auth.users, auth.uid() and the realtime
// publication. Default privileges mirror Supabase, so REVOKEs in migrations are meaningful.
const SUPABASE_SHIMS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

export const MIGRATIONS = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()

/** A fresh in-memory Postgres with the consolidated schema plus migrations, optionally stopping before one. */
export async function createDatabase(options: { before?: string } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { uuid_ossp } })
  await db.exec(SUPABASE_SHIMS)
  await db.exec(fs.readFileSync(path.join(ROOT, 'supabase-schema.sql'), 'utf8'))
  for (const file of MIGRATIONS) {
    if (options.before && file >= options.before) break
    await applyMigration(db, file)
  }
  return db
}

export async function applyMigration(db: PGlite, file: string): Promise<void> {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
}

/** Runs `fn` as a signed-in user, the way PostgREST does: role `authenticated` plus the JWT subject. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

export async function createUser(db: PGlite, id: string): Promise<void> {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id.slice(0, 8)}@example.com`])
}
