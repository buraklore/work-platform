# Environment for the local end-to-end run (fake auth + local Postgres). Not for production.
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=local-e2e-anon-key-0000000000000000
export NEXT_PUBLIC_APP_URL=http://localhost:3100
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/app_e2e
export CRON_SECRET=local-e2e-cron-secret-000000000000
export UPSTASH_REDIS_REST_URL=http://127.0.0.1:54322
export UPSTASH_REDIS_REST_TOKEN=local-e2e-upstash-token-0000000000
export NEXT_TELEMETRY_DISABLED=1
