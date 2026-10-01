#!/bin/sh
for f in /tmp/fake-auth.pid /tmp/next.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; rm -f "$f"; done
# next start forks a next-server child
for p in $(pgrep -f "^next-server" 2>/dev/null); do kill "$p" 2>/dev/null; done
true
