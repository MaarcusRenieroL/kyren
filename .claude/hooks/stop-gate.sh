#!/usr/bin/env bash
# Blocks Claude from finishing while anything is red.
# Only gates when code changed, so plain Q&A sessions can still end.
input=$(cat)
# Avoid infinite loops: if we're already continuing because of this hook, let it stop.
echo "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

git diff --quiet HEAD -- apps packages 2>/dev/null && git diff --cached --quiet -- apps packages 2>/dev/null && exit 0

module=$(cat .claude/current-module 2>/dev/null)

fail() { echo "STOP BLOCKED: $1 is failing. Fix it before finishing. Output:" >&2; echo "$2" | tail -40 >&2; exit 2; }

out=$(pnpm -s typecheck 2>&1) || fail "typecheck" "$out"
out=$(pnpm -s lint 2>&1)      || fail "lint" "$out"
out=$(pnpm -s test 2>&1)      || fail "unit tests" "$out"
if [ -n "$module" ]; then
  out=$(pnpm -s test:e2e --grep "@$module" 2>&1) || fail "E2E for @$module" "$out"
fi
exit 0
