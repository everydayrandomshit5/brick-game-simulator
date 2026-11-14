#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ "${1:-}" = "--install-desktop" ]; then
  DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  DESKTOP_FILE="$DESKTOP_DIR/brick-game-simulator.desktop"
  mkdir -p "$DESKTOP_DIR"
  chmod +x "$SCRIPT_DIR/run.sh"
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Brick Game 9999-in-1 Simulator
GenericName=Retro LCD Handheld Simulator
Comment=Retro 90s Handheld LCD Brick Game 9999-in-1 Simulator
Exec="$SCRIPT_DIR/run.sh"
Icon=$SCRIPT_DIR/assets/icon.png
Path=$SCRIPT_DIR
Terminal=false
Categories=Game;ArcadeGame;
Keywords=retro;tetris;lcd;handheld;gamepad;
StartupNotify=true
EOF
  chmod +x "$DESKTOP_FILE"
  echo "Installed desktop launcher to: $DESKTOP_FILE"
  exit 0
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Error: Node.js and npm are required to run Brick Game Simulator." >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Retro LCD Brick Game Simulator..."
exec npx electron . "$@"
