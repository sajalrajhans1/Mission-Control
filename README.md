# LOCK IN 2026

A minimal, private, real-time mission control app for exactly two people. No auth, no accounts, no onboarding. Anyone with the URL can use it.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style Radix components
- Lucide Icons
- Supabase database and realtime

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project.

3. In Supabase SQL Editor, run:

```text
supabase/migrations/001_initial_schema.sql
```

4. Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Notes

The migration creates these tables:

- `tasks`
- `projects`
- `prompts`
- `ideas`
- `resources`
- `sticky_notes`
- `money_entries`
- `daily_logs`
- `wins`
- `settings`

Every table uses UUID primary keys, `created_at`, `updated_at`, anonymous RLS policies, and Supabase realtime publication membership.

This app intentionally does not use Supabase Auth. The privacy model is simply: only share the deployed URL with the other person.

## Vercel Deployment

1. Push this project to GitHub.
2. Import it into Vercel.
3. Add the same environment variables from `.env.example`.
4. Deploy.
5. Share the Vercel URL with your friend.

## Product Boundaries

This app intentionally excludes authentication, notifications, comments, chat, file uploads, roles, multiple workspaces, complex analytics, and calendar integrations.
