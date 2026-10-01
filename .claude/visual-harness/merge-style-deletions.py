#!/usr/bin/env python3
from __future__ import annotations

"""Resolve a stylesheet merge where every side only deletes rules.

The styles migration has several agents removing their own components' rules from the same global
stylesheet. Each side is a strict subsequence of the merge base, so the merged result is the base
minus the union of both sides' deletions. Any insertion or modification is reported instead of
being merged, because that would mean an agent edited the sheet rather than deleting from it.

Usage: merge-style-deletions.py <base-ref> <ours-ref> <theirs-ref> <path>
"""
import subprocess
import sys
from difflib import SequenceMatcher


def read(ref: str, path: str) -> list[str]:
    return subprocess.run(
        ['git', 'show', f'{ref}:{path}'], check=True, capture_output=True, text=True
    ).stdout.splitlines(keepends=True)


def deleted_indices(base: list[str], side: list[str], label: str) -> set[int]:
    removed: set[int] = set()
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, base, side, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        if tag == 'delete':
            removed.update(range(i1, i2))
            continue
        print(f'{label}: {tag} at base lines {i1 + 1}-{i2}, side lines {j1 + 1}-{j2}', file=sys.stderr)
        for line in side[j1:j2]:
            print(f'  + {line.rstrip()}', file=sys.stderr)
        raise SystemExit(f'{label} did not only delete lines; resolve {path} by hand')


    return removed


if __name__ == '__main__':
    base_ref, ours_ref, theirs_ref, path = sys.argv[1:5]
    base = read(base_ref, path)
    ours = read(ours_ref, path)
    theirs = read(theirs_ref, path)
    dropped = deleted_indices(base, ours, 'ours') | deleted_indices(base, theirs, 'theirs')
    merged = [line for index, line in enumerate(base) if index not in dropped]
    with open(path, 'w') as handle:
        handle.writelines(merged)
    print(f'{path}: {len(base)} -> {len(merged)} lines ({len(dropped)} deleted by either side)')
