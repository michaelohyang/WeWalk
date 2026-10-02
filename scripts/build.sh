#!/usr/bin/env sh
# Wraps src/app.html (a page fragment, as the claude.ai Artifact host expects)
# into a standalone dist/index.html you can serve from any static host.
set -e
cd "$(dirname "$0")/.."
mkdir -p dist
{
  printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
  cat src/app.html
  printf '\n</body></html>\n'
} > dist/index.html
echo "Built dist/index.html"
