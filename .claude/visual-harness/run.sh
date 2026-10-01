#!/usr/bin/env bash
# Visual-regression harness for the Bazar frontend.
#
#   ./run.sh build     <name> <commit>     build a reference dist from a commit
#   ./run.sh discover  <name>              harvest real collection/asset/profile ids into ids.json
#   ./run.sh record    <name> [commit]     build (if a commit is given) + discover + record + capture
#   ./run.sh topup     <name>              record only what a replay is missing (repeats)
#   ./run.sh capture   <ref|dist> <name>   replay the recordings and capture
#   ./run.sh compare   <a> <b>             diff two captures into a Markdown + JSON report
#   ./run.sh calibrate [ref] [base]        capture the reference build again and compare
#   ./run.sh scenarios                     list the scenario names
#
# Artefacts live under $VR_DATA (default: this directory). The mirrored copy in
# .claude/visual-harness sets VR_DATA to the scratchpad so the repo stays clean.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export HARNESS_ROOT="$HERE"
# The mirrored copy under .claude/visual-harness ships a DATA_DIR file pointing at the scratchpad,
# so running from the repo never writes refs/captures/recordings into the working tree.
export VR_DATA="${VR_DATA:-$( [ -f "$HERE/DATA_DIR" ] && cat "$HERE/DATA_DIR" || echo "$HERE" )}"
REPO="${VR_REPO:-/Users/nickj/arc/repos/bazar/.claude/worktrees/integration}"
NODE_MODULES="${VR_NODE_MODULES:-$REPO/node_modules}"

mkdir -p "$VR_DATA"/{refs,captures,recordings,reports,build}

usage() { awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "${BASH_SOURCE[0]}"; }

cmd_build() {
	local name="${1:?usage: run.sh build <name> <commit>}" commit="${2:?usage: run.sh build <name> <commit>}"
	local wt="$VR_DATA/build/wt-$name" out="$VR_DATA/refs/$name/dist"
	echo "building $commit -> $out"
	rm -rf "$wt"
	git -C "$REPO" worktree prune
	git -C "$REPO" worktree add --detach "$wt" "$commit" >/dev/null
	# Never run npm install: borrow the integration worktree's node_modules.
	ln -sfn "$NODE_MODULES" "$wt/node_modules"
	mkdir -p "$VR_DATA/refs/$name"
	( cd "$wt" && npx vite build --outDir "$out" --emptyOutDir )   # tsc is deliberately skipped
	git -C "$REPO" worktree remove --force "$wt"
	git -C "$REPO" worktree prune
	echo "$commit" > "$VR_DATA/refs/$name/COMMIT"
	echo "built $name from $commit"
}

cmd_discover() { node "$HERE/scripts/discover.mjs" "${1:-styles-base}"; }

cmd_record() {
	local name="${1:?usage: run.sh record <name> [commit]}" commit="${2:-}"
	[ -n "$commit" ] && cmd_build "$name" "$commit"
	cmd_discover "$name"
	# Pass 1 writes the recordings, driving the page patiently so the rate limiter can be waited out.
	# Its timing is nothing like a replay, so its capture is kept only as <name>-recording.
	node "$HERE/scripts/capture.mjs" "$name" "$name-recording" --record "${@:3}"
	cmd_topup "$name" "${@:3}"
	# Final pass replays the recordings, so the baseline and every later capture share one timing.
	node "$HERE/scripts/capture.mjs" "$name" "$name" "${@:3}"
}

# The app batches GraphQL ids by what has arrived so far, so recording (slow, rate-limited) and
# replaying (instant) form different batches and therefore different request bodies. Top-up passes
# record under replay timing until a plain replay needs nothing new.
cmd_topup() {
	local name="${1:?usage: run.sh topup <name>}" rounds="${VR_TOPUP_ROUNDS:-4}"
	for round in $(seq 1 "$rounds"); do
		echo "top-up round $round/$rounds"
		node "$HERE/scripts/capture.mjs" "$name" "$name-topup" --topup "${@:2}"
		local missing
		missing=$(node -e "
			const data = require('$VR_DATA/captures/$name-topup/manifest.json');
			console.log(data.scenarios.reduce((sum, s) => sum + s.network.recorded, 0));
		")
		echo "top-up round $round recorded $missing new request(s)"
		[ "$missing" = "0" ] && break
	done
}

cmd_capture() {
	local target="${1:?usage: run.sh capture <ref|dist> <name>}" name="${2:?usage: run.sh capture <ref|dist> <name>}"
	node "$HERE/scripts/capture.mjs" "$target" "$name" "${@:3}"
}

cmd_compare() {
	node "$HERE/scripts/compare.mjs" "${1:?usage: run.sh compare <a> <b>}" "${2:?usage: run.sh compare <a> <b>}" "${@:3}"
}

cmd_calibrate() {
	local ref="${1:-styles-base}" base="${2:-$ref}"
	local probe="${ref}-calibration"
	echo "calibration: capturing $ref again as $probe, then comparing against $base"
	node "$HERE/scripts/capture.mjs" "$ref" "$probe"
	node "$HERE/scripts/compare.mjs" "$base" "$probe"
}

cmd_scenarios() {
	node -e "
		import('$HERE/scripts/lib/scenarios.mjs').then(({ buildScenarios }) => {
			for (const s of buildScenarios()) console.log(\`\${s.name}\t\${s.route}\t\${s.viewport.width}x\${s.viewport.height}\`);
		});
	"
}

case "${1:-}" in
	build) shift; cmd_build "$@" ;;
	discover) shift; cmd_discover "$@" ;;
	record) shift; cmd_record "$@" ;;
	topup) shift; cmd_topup "$@" ;;
	capture) shift; cmd_capture "$@" ;;
	compare) shift; cmd_compare "$@" ;;
	calibrate) shift; cmd_calibrate "$@" ;;
	scenarios) shift; cmd_scenarios "$@" ;;
	*) usage; exit 2 ;;
esac
