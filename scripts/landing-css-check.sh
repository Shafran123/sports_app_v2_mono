#!/usr/bin/env bash
# Feedback loop: does the landing app's compiled CSS contain the utilities
# its own components use? Red when Tailwind missed any of them.
set -uo pipefail
cd "$(dirname "$0")/.."

CSS="$(ls apps/landing/.next/static/css/*.css 2>/dev/null | head -1)"
if [ -z "$CSS" ]; then
  echo "RED: no compiled CSS found — build and run again"
  exit 1
fi

FAIL=0

# Classes used by apps/landing components (see src/components/**).
CLASSES="bg-surface-2 max-w-6xl rounded-3xl grid-cols-4 rounded-full h-16 px-4 pt-16 gap-10 lg:grid-cols-2"

for cls in $CLASSES; do
  if ! rg -q "$cls" "$CSS"; then
    echo "MISSING: $cls"
    FAIL=1
  fi
done

# Also confirm the theme tokens made it.
for tok in "--color-primary" "--color-ink" "--color-surface-2"; do
  if ! rg -q -- "$tok" "$CSS"; then
    echo "MISSING TOKEN: $tok"
    FAIL=1
  fi
done

if [ $FAIL -eq 0 ]; then
  echo "PASS: all landing utilities present"
fi
exit $FAIL