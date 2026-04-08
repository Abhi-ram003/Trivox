# Trivox

This project is a 3-bot AI app with:

- sign up and login
- per-user chat history
- saved prompts and responses
- three focused bots: Chat, Code, and Research

## Repo structure

- `public/` contains the frontend used by both local development and Vercel deployment
- `api/` contains the serverless routes for Vercel
- `lib/` contains shared NVIDIA and auth logic
- `supabase/schema.sql` contains the database schema and policies

## Recommended NVIDIA models

Use these model ids in your environment:

```text
CHAT_MODEL=meta/llama-3.3-70b-instruct
CODE_MODEL=qwen/qwen3-coder-480b-a35b-instruct
RESEARCH_MODEL=qwen/qwq-32b
```

## Environment setup

```text
NVIDIA_API_KEY=your_real_nvidia_key

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key

CHAT_MODEL=meta/llama-3.3-70b-instruct
CODE_MODEL=qwen/qwen3-coder-480b-a35b-instruct
RESEARCH_MODEL=qwen/qwq-32b

PORT=3000
```

## What each bot does

- `Chat Bot` for daily-use conversations, writing, and normal questions using Meta Llama 3.3 70B
- `Code Bot` for code generation, debugging, and implementation help
- `Research Bot` for deeper reasoning, comparisons, and structured analysis

## Current database storage

Chat history is stored in Supabase Postgres:

- `public.chats` stores one row per conversation
- `public.messages` stores each user message and assistant response

The SQL schema is in `supabase/schema.sql`.

## Notes

- The frontend reads public config from `/api/health`
- The `/api/chat` route requires a logged-in Supabase session
- All three bots use NVIDIA-hosted models
