#!/usr/bin/env bash
set -e

# Verity One-Line Installer for Linux & macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/shironim/verity/master/scripts/install.sh | bash

REPO="shironim/verity"
INSTALL_DIR="${VERITY_INSTALL_DIR:-/usr/local/bin}"

echo "⚡ [Verity Installer] Mendeteksi arsitektur sistem..."

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    case "$ARCH" in
      x86_64) TARGET="verity-linux-x64" ;;
      aarch64|arm64) TARGET="verity-linux-arm64" ;;
      *) echo "❌ Arsitektur Linux '$ARCH' belum didukung."; exit 1 ;;
    esac
    ;;
  Darwin)
    case "$ARCH" in
      arm64) TARGET="verity-darwin-arm64" ;;
      x86_64) TARGET="verity-darwin-x64" ;;
      *) echo "❌ Arsitektur macOS '$ARCH' belum didukung."; exit 1 ;;
    esac
    ;;
  *)
    echo "❌ OS '$OS' tidak didukung oleh installer bash ini. Gunakan install.ps1 untuk Windows."
    exit 1
    ;;
esac

echo "📦 Target biner teridentifikasi: $TARGET"

# Jika direktori instalasi /usr/local/bin tidak writable, fallback ke ~/.local/bin
if [ ! -w "$INSTALL_DIR" ] && [ "$INSTALL_DIR" = "/usr/local/bin" ]; then
  if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
  else
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    USE_SUDO=""
  fi
else
  USE_SUDO=""
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$TARGET"
echo "⬇️  Mengunduh Verity dari GitHub Releases..."

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/verity" || {
    echo "⚠️  Gagal mengunduh biner rilis GitHub. Memeriksa ketersediaan Bun lokal..."
    if command -v bun >/dev/null 2>&1; then
      echo "🔨 Mengompilasi Verity menggunakan Bun lokal..."
      bun build --compile ./src/cli/index.ts --outfile "$TMP_DIR/verity"
    else
      echo "❌ Gagal mengunduh dan Bun tidak terpasang."
      exit 1
    fi
  }
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP_DIR/verity" "$DOWNLOAD_URL"
else
  echo "❌ Diperlukan 'curl' atau 'wget' untuk mengunduh biner."
  exit 1
fi

chmod +x "$TMP_DIR/verity"
echo "🚀 Memasang verity ke $INSTALL_DIR/verity..."
$USE_SUDO mv "$TMP_DIR/verity" "$INSTALL_DIR/verity"

echo "✅ Instalasi Berhasil!"
"$INSTALL_DIR/verity" --version
echo "Jalankan 'verity --help' atau 'verity init' di proyek Anda untuk memulai."
