# Supabase Implementation Guide

This document outlines the exact steps to finalize your Supabase setup for the **Octant** project. Since the app relies on Supabase for Auth and a simplified cloud-native state synchronization (where Zustand stores persist directly to JSONB columns), setting up your database is straightforward.

## 1. Environment Variables

You need to add the following variables to your local `.env` and to your deployment platform (e.g. Vercel, Netlify):

```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
```
*(You can find these in your Supabase Dashboard under **Project Settings > API**).*

---

## 2. Authentication Setup

1. Go to your Supabase Dashboard.
2. Navigate to **Authentication > Providers**.
3. Ensure **Email** is enabled (by default, it is).
4. If you want to allow users to sign up without confirming their email during development, go to **Authentication > URL Configuration** and disable **Confirm email**. Alternatively, configure your SMTP settings to send verification emails.

---

## 3. Database Schema & RLS Policies

To make sure your remote database perfectly matches the state syncing we built into the app, you need to create the tables and secure them. 

We utilize a hybrid schema design: tables are strongly typed for relational mapping (`user_id`, `id`) but utilize `jsonb` payload columns (`data`, `state`, `preferences`) to allow Zustand to serialize complex nested domains without brittle schema migrations.

**Instructions:**
1. Open your Supabase Dashboard.
2. Go to the **SQL Editor**.
3. Paste and run the following exact SQL script. It will create all 8 necessary tables and attach Row Level Security (RLS) so users can only read and write their own data.

```sql
-- 1. Create Tables

-- Settings (Single row per user)
CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Resumes (Single row per user)
CREATE TABLE resumes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_base JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Interview Prep State (Single row per user)
CREATE TABLE interview_preps (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Discovery State (Single row per user)
CREATE TABLE discoveries (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Generator State (Single row per user)
CREATE TABLE generators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Jobs (Multiple rows per user)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Job Analyses (Multiple rows per user)
CREATE TABLE job_analyses (
  job_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_score INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (job_id, user_id)
);

-- Applications (Multiple rows per user)
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);


-- 2. Enable Row Level Security (RLS)

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_preps ENABLE ROW LEVEL SECURITY;
ALTER TABLE discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE generators ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;


-- 3. Create RLS Policies (Users can only access their own rows)

-- Settings Policies
CREATE POLICY "Users can manage own settings" ON settings FOR ALL USING (auth.uid() = user_id);

-- Resumes Policies
CREATE POLICY "Users can manage own resumes" ON resumes FOR ALL USING (auth.uid() = user_id);

-- Interview Prep Policies
CREATE POLICY "Users can manage own interview preps" ON interview_preps FOR ALL USING (auth.uid() = user_id);

-- Discovery Policies
CREATE POLICY "Users can manage own discoveries" ON discoveries FOR ALL USING (auth.uid() = user_id);

-- Generator Policies
CREATE POLICY "Users can manage own generators" ON generators FOR ALL USING (auth.uid() = user_id);

-- Jobs Policies
CREATE POLICY "Users can manage own jobs" ON jobs FOR ALL USING (auth.uid() = user_id);

-- Job Analyses Policies
CREATE POLICY "Users can manage own job analyses" ON job_analyses FOR ALL USING (auth.uid() = user_id);

-- Applications Policies
CREATE POLICY "Users can manage own applications" ON applications FOR ALL USING (auth.uid() = user_id);
```

---

## 4. That's It!

Once the SQL script succeeds, your Supabase backend is 100% ready. 
- You do not need to configure anything else in the dashboard.
- Since we use a `jsonb` column for complex domains (like Job tags, Application timeline events, Resume objects), you won't ever need to run SQL migrations if you add a new property to those frontend TypeScript types in the future. Supabase will seamlessly accept the new JSON shapes. 
