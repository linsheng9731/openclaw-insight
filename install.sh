#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# 🦞 openclaw-insight installer
# One-click install via GitHub Releases or npm fallback
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-insight/main/install.sh | bash
#   curl -fsSL ... | bash -s -- --version v1.2.0
#   curl -fsSL ... | bash -s -- --npm
# ─────────────────────────────────────────────────────────

REPO="linsheng9731/openclaw-insight"
BINARY_NAME="openclaw-insight"
INSTALL_DIR="${OPENCLAW_INSIGHT_INSTALL_DIR:-}"
VERSION=""
USE_NPM=false
VERBOSE=false

# ─── Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()    { printf "${BLUE}ℹ${RESET} %s\n" "$*"; }
success() { printf "${GREEN}✔${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
error()   { printf "${RED}✘${RESET} %s\n" "$*" >&2; }
step()    { printf "\n${BOLD}${CYAN}▸ %s${RESET}\n" "$*"; }

# ─── Parse Arguments ─────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)  VERSION="$2"; shift 2 ;;
    --npm)         USE_NPM=true; shift ;;
    --verbose)     VERBOSE=true; shift ;;
    --dir)         INSTALL_DIR="$2"; shift 2 ;;
    --help|-h)
      cat <<EOF
${BOLD}🦞 openclaw-insight installer${RESET}

${BOLD}USAGE${RESET}
  curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-insight/main/install.sh | bash
  curl -fsSL ... | bash -s -- [OPTIONS]

${BOLD}OPTIONS${RESET}
  --version, -v <tag>   Install a specific version (e.g. v1.0.0)
  --npm                 Force install via npm instead of binary
  --dir <path>          Custom install directory
  --verbose             Enable verbose output
  --help, -h            Show this help message

${BOLD}ENVIRONMENT${RESET}
  OPENCLAW_INSIGHT_INSTALL_DIR   Override install directory
  GITHUB_TOKEN                   GitHub token for private repos / rate limits

${BOLD}EXAMPLES${RESET}
  # Install latest
  curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-insight/main/install.sh | bash

  # Install specific version
  curl -fsSL ... | bash -s -- --version v1.2.0

  # Install via npm globally
  curl -fsSL ... | bash -s -- --npm

  # Custom directory
  curl -fsSL ... | bash -s -- --dir /opt/tools
EOF
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Header ──────────────────────────────────────────────
printf "\n${BOLD}${CYAN}"
cat <<'BANNER'
   ___                    ____ _                 ___           _       _     _   
  / _ \ _ __   ___ _ __  / ___| | __ ___      _|_ _|_ __  ___(_) __ _| |__ | |_ 
 | | | | '_ \ / _ \ '_ \| |   | |/ _` \ \ /\ / /| || '_ \/ __| |/ _` | '_ \| __|
 | |_| | |_) |  __/ | | | |___| | (_| |\ V  V / | || | | \__ \ | (_| | | | | |_ 
  \___/| .__/ \___|_| |_|\____|_|\__,_| \_/\_/ |___|_| |_|___/_|\__, |_| |_|\__|
       |_|                                                       |___/           
BANNER
printf "${RESET}\n"

# ─── Detect Platform ─────────────────────────────────────
step "Detecting platform"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) error "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  armv7l)        ARCH="armv7" ;;
  *) error "Unsupported architecture: $ARCH"; exit 1 ;;
esac

info "Platform: ${BOLD}${PLATFORM}-${ARCH}${RESET}"

# ─── Resolve Install Directory ───────────────────────────
if [[ -z "$INSTALL_DIR" ]]; then
  if [[ -d "$HOME/.local/bin" ]] || [[ -w "$HOME/.local" ]] || [[ -w "$HOME" ]]; then
    INSTALL_DIR="$HOME/.local/bin"
  elif [[ -w "/usr/local/bin" ]]; then
    INSTALL_DIR="/usr/local/bin"
  else
    INSTALL_DIR="$HOME/.local/bin"
  fi
fi

mkdir -p "$INSTALL_DIR" 2>/dev/null || {
  error "Cannot create install directory: $INSTALL_DIR"
  error "Try: sudo mkdir -p $INSTALL_DIR && sudo chown \$USER $INSTALL_DIR"
  exit 1
}

info "Install directory: ${BOLD}${INSTALL_DIR}${RESET}"

# ─── Check Dependencies ─────────────────────────────────
has_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! has_cmd curl && ! has_cmd wget; then
  error "curl or wget is required"
  exit 1
fi

fetch() {
  local url="$1" dest="$2"
  local auth_header=""
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header="Authorization: token $GITHUB_TOKEN"
  fi

  if has_cmd curl; then
    if [[ -n "$auth_header" ]]; then
      curl -fsSL -H "$auth_header" -o "$dest" "$url"
    else
      curl -fsSL -o "$dest" "$url"
    fi
  else
    if [[ -n "$auth_header" ]]; then
      wget -q --header="$auth_header" -O "$dest" "$url"
    else
      wget -q -O "$dest" "$url"
    fi
  fi
}

fetch_text() {
  local url="$1"
  local auth_header=""
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header="Authorization: token $GITHUB_TOKEN"
  fi

  if has_cmd curl; then
    if [[ -n "$auth_header" ]]; then
      curl -fsSL -H "$auth_header" "$url"
    else
      curl -fsSL "$url"
    fi
  else
    if [[ -n "$auth_header" ]]; then
      wget -q --header="$auth_header" -O - "$url"
    else
      wget -q -O - "$url"
    fi
  fi
}

# ─── NPM Fallback ───────────────────────────────────────
install_via_npm() {
  step "Installing via npm"

  if ! has_cmd npm && ! has_cmd npx; then
    error "npm is required for npm installation"
    error "Install Node.js from https://nodejs.org/"
    exit 1
  fi

  local pkg="openclaw-insight"
  if [[ -n "$VERSION" ]]; then
    pkg="openclaw-insight@${VERSION#v}"
  fi

  info "Running: npm install -g $pkg"
  npm install -g "$pkg"
  success "Installed via npm!"
  
  if has_cmd openclaw-insight; then
    info "Version: $(openclaw-insight --version 2>/dev/null || echo 'unknown')"
  fi
  return 0
}

if $USE_NPM; then
  install_via_npm
  exit 0
fi

# ─── Resolve Version ────────────────────────────────────
step "Resolving version"

if [[ -z "$VERSION" ]]; then
  info "Fetching latest release..."
  RELEASE_JSON=$(fetch_text "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || echo "")
  
  if [[ -z "$RELEASE_JSON" ]]; then
    warn "Could not fetch latest release, falling back to npm install"
    install_via_npm
    exit 0
  fi

  VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  
  if [[ -z "$VERSION" ]]; then
    warn "Could not parse release version, falling back to npm install"
    install_via_npm
    exit 0
  fi
fi

info "Version: ${BOLD}${VERSION}${RESET}"

# ─── Download Binary ─────────────────────────────────────
step "Downloading binary"

ASSET_NAME="${BINARY_NAME}-${VERSION#v}-${PLATFORM}-${ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"
CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

info "Downloading ${BOLD}${ASSET_NAME}${RESET}..."
if ! fetch "$DOWNLOAD_URL" "$TMP_DIR/$ASSET_NAME" 2>/dev/null; then
  warn "Binary release not found for ${PLATFORM}-${ARCH}"
  warn "Falling back to npm install..."
  install_via_npm
  exit 0
fi

success "Downloaded $(du -h "$TMP_DIR/$ASSET_NAME" | cut -f1 | xargs)"

# ─── Verify Checksum ─────────────────────────────────────
step "Verifying integrity"

if fetch "$CHECKSUM_URL" "$TMP_DIR/checksums.txt" 2>/dev/null; then
  EXPECTED=$(grep "$ASSET_NAME" "$TMP_DIR/checksums.txt" | awk '{print $1}')
  
  if [[ -n "$EXPECTED" ]]; then
    if has_cmd sha256sum; then
      ACTUAL=$(sha256sum "$TMP_DIR/$ASSET_NAME" | awk '{print $1}')
    elif has_cmd shasum; then
      ACTUAL=$(shasum -a 256 "$TMP_DIR/$ASSET_NAME" | awk '{print $1}')
    else
      warn "No checksum tool available, skipping verification"
      ACTUAL="$EXPECTED"
    fi
    
    if [[ "$ACTUAL" == "$EXPECTED" ]]; then
      success "Checksum verified (SHA-256)"
    else
      error "Checksum mismatch!"
      error "Expected: $EXPECTED"
      error "Actual:   $ACTUAL"
      exit 1
    fi
  else
    warn "No checksum entry for $ASSET_NAME, skipping verification"
  fi
else
  warn "Checksums file not available, skipping verification"
fi

# ─── Extract & Install ───────────────────────────────────
step "Installing"

tar xzf "$TMP_DIR/$ASSET_NAME" -C "$TMP_DIR"

# Find the extracted directory (should contain package.json and bin)
EXTRACTED_DIR=$(find "$TMP_DIR" -name "openclaw-insight-*" -type d | head -1)

if [[ -z "$EXTRACTED_DIR" ]]; then
  error "Extracted directory not found"
  exit 1
fi

# Copy all files to install directory
info "Copying files to $INSTALL_DIR"
cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || {
  error "Cannot copy files to $INSTALL_DIR"
  exit 1
}

# Make sure the binary is executable
chmod +x "$INSTALL_DIR/bin/openclaw-insight.mjs"

# Create a symlink for easier execution
if [[ ! -L "$INSTALL_DIR/openclaw-insight" && ! -f "$INSTALL_DIR/openclaw-insight" ]]; then
  ln -sf "$INSTALL_DIR/bin/openclaw-insight.mjs" "$INSTALL_DIR/openclaw-insight"
fi

success "Installed to ${BOLD}${INSTALL_DIR}${RESET}"

# ─── Verify Installation ─────────────────────────────────
step "Verifying installation"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  warn "$INSTALL_DIR is not in your PATH"
  printf "\n"
  info "Add to your shell profile:"
  
  SHELL_NAME=$(basename "${SHELL:-/bin/bash}")
  case "$SHELL_NAME" in
    zsh)  PROFILE="~/.zshrc" ;;
    bash) PROFILE="~/.bashrc" ;;
    fish) PROFILE="~/.config/fish/config.fish" ;;
    *)    PROFILE="~/.profile" ;;
  esac

  if [[ "$SHELL_NAME" == "fish" ]]; then
    printf "\n  ${DIM}echo 'set -gx PATH %s \$PATH' >> %s${RESET}\n\n" "$INSTALL_DIR" "$PROFILE"
  else
    printf "\n  ${DIM}echo 'export PATH=\"%s:\$PATH\"' >> %s${RESET}\n\n" "$INSTALL_DIR" "$PROFILE"
  fi
fi

if has_cmd "$BINARY_NAME"; then
  VER=$("$BINARY_NAME" --version 2>/dev/null || echo "$VERSION")
  success "openclaw-insight ${BOLD}${VER}${RESET} is ready!"
else
  success "openclaw-insight installed to ${INSTALL_DIR}/${BINARY_NAME}"
  info "Restart your terminal or run: export PATH=\"${INSTALL_DIR}:\$PATH\""
fi

# ─── Done ────────────────────────────────────────────────
printf "\n${BOLD}${GREEN}🦞 Installation complete!${RESET}\n\n"
printf "  ${DIM}Get started:${RESET}\n"
printf "    ${CYAN}openclaw-insight${RESET}              # Analyze last 30 days\n"
printf "    ${CYAN}openclaw-insight --days 7${RESET}     # Last 7 days only\n"
printf "    ${CYAN}openclaw-insight --help${RESET}       # All options\n\n"
