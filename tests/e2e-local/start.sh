#!/bin/sh
# Starts fake auth/upstash + the production build for the local end-to-end run.
# Usage: sh tests/e2e-local/start.sh   (expects `pnpm build` done with the same env)
set -e
cd "$(dirname "$0")/../.."
. tests/e2e-local/env.sh
setsid node tests/e2e-local/fake-auth.mjs > /tmp/fake-auth.log 2>&1 < /dev/null &
echo $! > /tmp/fake-auth.pid
NODE_ENV=production setsid node_modules/.bin/next start -p 3100 > /tmp/next.log 2>&1 < /dev/null &
echo $! > /tmp/next.pid
sleep 6
