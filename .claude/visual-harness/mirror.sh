#!/usr/bin/env bash
# Copy the harness SOURCE (scripts only — never recordings, captures, refs or builds) into the repo
# at .claude/visual-harness/, so it survives a scratchpad wipe. The mirrored copy keeps writing its
# artefacts to the scratchpad via the DATA_DIR file.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-/Users/nickj/arc/repos/bazar/.claude/visual-harness}"

mkdir -p "$DEST/scripts/lib"
cp "$HERE/run.sh" "$HERE/mirror.sh" "$HERE/README.md" "$DEST/"
cp "$HERE"/scripts/*.mjs "$DEST/scripts/"
cp "$HERE"/scripts/lib/*.mjs "$DEST/scripts/lib/"
chmod +x "$DEST/run.sh" "$DEST/mirror.sh"
printf '%s\n' "$HERE" > "$DEST/DATA_DIR"

echo "mirrored harness source to $DEST"
echo "artefact directory for that copy: $(cat "$DEST/DATA_DIR")"
