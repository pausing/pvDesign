#!/usr/bin/env bash
set -euo pipefail
# Nixpacks' nodejs_22 is 22.10; Vite 8 / Rolldown need >= 22.12.
VERSION="${NODE_INSTALL_VERSION:-22.14.0}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
esac
PREFIX="${NODE_INSTALL_PREFIX:-/usr/local}"
curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${VERSION}/node-v${VERSION}-linux-${NODE_ARCH}.tar.xz"
tar -xJf /tmp/node.tar.xz -C "$PREFIX" --strip-components=1
rm -f /tmp/node.tar.xz
hash -r
echo "installed $(node -v) $(npm -v)"
