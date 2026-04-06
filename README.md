# NVIDIA Prompt Studio

This project is now a ChatGPT-style app with:

- sign up and login
- per-user chat history
- saved prompts and responses
- NVIDIA-powered replies through a server-side API route

## Stack

- Frontend: plain HTML, CSS, and browser JavaScript
- Auth and database: Supabase Auth + Postgres
- AI responses: NVIDIA API
- Deployment: Vercel-friendly static site with API routes

## Where chat history is stored

Chat history is stored in Supabase Postgres:

- `public.chats` stores one row per conversation
- `public.messages` stores each user message and assistant response

The SQL schema is in `supabase/schema.sql`.

## Setup

1. Create a Supabase project
2. Open the SQL editor in Supabase
3. Run the SQL from `supabase/schema.sql`
4. In Supabase Auth, keep Email auth enabled
5. Copy `.env.example` to `.env`
6. Fill in these values:

```text
NVIDIA_API_KEY=your_real_nvidia_key
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
PORT=3000
```

## Local preview

Run:

```powershell
node server.mjs
```

Then open:

```text
http://localhost:3000
```

## Deploy on Vercel

1. Push this folder to GitHub
2. Import the repo into Vercel
3. Add the same environment variables from `.env`
4. Deploy

## Notes

- The frontend reads Supabase public config from `/api/health`
- The `/api/chat` route requires a logged-in Supabase session before it calls NVIDIA
- Saved history is protected by Supabase Row Level Security policies
- The app accepts the new Supabase `publishable key` format and also supports the older `anon` key name as a fallback
