#!/bin/bash

echo "🧹 Cleaning old build artifacts..."

# Remove dist folder
rm -rf dist/

# Remove node_modules cache (optional but thorough)
rm -rf node_modules/.vite/

# Remove any stale cache
rm -rf .vite/

echo "✅ Cache cleared!"
echo ""
echo "Now run these commands:"
echo "1. Stop your dev server (Ctrl+C if running)"
echo "2. npm run dev"
echo "3. In browser: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)"
