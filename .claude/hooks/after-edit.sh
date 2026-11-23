#!/usr/bin/env bash
# Fast feedback after every edit: typecheck only the touched package.
# Exit 2 sends the error back to Claude so it fixes it immediately.
input=$(cat)
file=$(echo "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
pkg_dir=$(dirname "$file")
while [ "$pkg_dir" != "/" ] && [ ! -f "$pkg_dir/package.json" ]; do pkg_dir=$(dirname "$pkg_dir"); done
[ -f "$pkg_dir/package.json" ] || exit 0
if ! out=$(cd "$pkg_dir" && npx tsc --noEmit -p . 2>&1 | head -30); then
  echo "Typecheck failed in $pkg_dir:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
