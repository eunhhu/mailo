#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building mailo ==="

# Build frontend
echo "-> Building frontend..."
cd "$PROJECT_DIR/frontend"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build

# Build backend (single binary)
echo "-> Building backend..."
cd "$PROJECT_DIR"
bun build src/index.ts --compile --outfile mailo-server

echo "=== Build complete ==="
echo "Binary: $PROJECT_DIR/mailo-server"
