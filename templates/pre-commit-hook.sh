#!/usr/bin/env bash
# Verity Pre-Commit Hook
# Prevents committing code changes that leave specification anchors in a STALE state.

echo "🔍 [Verity] Memeriksa integritas spesifikasi sebelum commit..."

# Cari binary verity atau jalankan via bun/npx
if command -v verity >/dev/null 2>&1; then
  CMD="verity"
elif command -v bun >/dev/null 2>&1 && [ -f "./src/cli/index.ts" ]; then
  CMD="bun run ./src/cli/index.ts"
elif command -v npx >/dev/null 2>&1; then
  CMD="npx @dimassetoid/verity"
else
  echo "⚠️  [Verity] Command verity/bun tidak ditemukan. Melewati pemeriksaan pre-commit."
  exit 0
fi

# Jalankan verity check dengan flag --ci
$CMD check --ci

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ [Verity] Commit Ditolak! Terdeteksi spec-drift (anchor berstatus STALE)."
  echo "👉 Silakan rekonsiliasi spesifikasi terkait, lalu segel kembali dengan:"
  echo "   verity link <spec-path> <target-code-path>"
  echo "   (atau gunakan 'git commit --no-verify' untuk bypass jika darurat)"
  exit 1
fi

echo "✅ [Verity] Seluruh spesifikasi selaras dengan kode aktual."
exit 0
