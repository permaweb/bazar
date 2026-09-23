/** One editable recipient row, exactly as typed or pasted; validation happens when the list is parsed. */
export type HolderDraftRow = { address: string; quantity: string };

export const EMPTY_HOLDER_ROW: HolderDraftRow = { address: '', quantity: '' };

// A single address/quantity pair typed or pasted into one field is left alone;
// anything carrying a newline, comma, or JSON bracket is treated as a whole
// list and expanded across rows (the "paste a blob, autofill the form" flow).
export function looksLikeHolderBlob(text: string): boolean {
	const trimmed = text.trim();
	return /[\n,]/.test(trimmed) || /^[[{]/.test(trimmed);
}

// Lenient expansion for autofill only — it fills the grid so the user can see
// and fix their data. Strict validation/dedup still runs downstream via
// parseHolderList, which surfaces the inline errors.
export function expandHolderBlob(text: string): HolderDraftRow[] {
	const trimmed = text.trim();
	if (!trimmed) return [];
	if (/^[[{]/.test(trimmed)) {
		try {
			const parsed: unknown = JSON.parse(trimmed);
			const rows: HolderDraftRow[] = [];
			if (Array.isArray(parsed)) {
				for (const entry of parsed) {
					if (Array.isArray(entry) && entry.length === 2) {
						rows.push({ address: String(entry[0] ?? ''), quantity: String(entry[1] ?? '') });
					} else if (entry && typeof entry === 'object') {
						const record = entry as Record<string, unknown>;
						rows.push({ address: String(record.address ?? ''), quantity: String(record.quantity ?? '') });
					}
				}
			} else if (parsed && typeof parsed === 'object') {
				for (const [address, quantity] of Object.entries(parsed as Record<string, unknown>)) {
					rows.push({ address, quantity: String(quantity ?? '') });
				}
			}
			return rows;
		} catch {
			// Not valid JSON — fall through and try CSV.
		}
	}
	const rows: HolderDraftRow[] = [];
	for (const line of trimmed.split(/\r?\n/)) {
		const content = line.trim();
		if (!content || content.startsWith('#')) continue;
		const [address = '', quantity = ''] = content.split(',').map((field) => field.trim());
		rows.push({ address, quantity });
	}
	return rows;
}

/** The rows the editor shows: always at least one row to type into. */
export function editableHolderRows(rows: HolderDraftRow[]): HolderDraftRow[] {
	return rows.length ? rows : [EMPTY_HOLDER_ROW];
}

export function updateHolderRow(
	rows: HolderDraftRow[],
	index: number,
	patch: Partial<HolderDraftRow>
): HolderDraftRow[] {
	return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function removeHolderRow(rows: HolderDraftRow[], index: number): HolderDraftRow[] {
	const next = rows.filter((_, i) => i !== index);
	return next.length ? next : [EMPTY_HOLDER_ROW];
}

export function appendHolderRow(rows: HolderDraftRow[]): HolderDraftRow[] {
	return [...rows, EMPTY_HOLDER_ROW];
}

/**
 * Expand a pasted list into rows, or `null` when the paste is a single value that should land in the field.
 * Rows the user already filled are kept and the pasted list is appended; the pasted-into row is replaced, so a
 * paste into the lone empty starter row is a clean replace.
 */
export function pasteHolderRows(rows: HolderDraftRow[], index: number, text: string): HolderDraftRow[] | null {
	if (!looksLikeHolderBlob(text)) return null;
	const expanded = expandHolderBlob(text);
	if (!expanded.length) return null;
	const kept = rows.filter((row, i) => i !== index && (row.address || row.quantity));
	return [...kept, ...expanded];
}

// The K/V rows are the editable source of truth; serialize non-empty rows
// back to the CSV the strict parser/validator already understands.
export function holderListText(rows: HolderDraftRow[]): string {
	return rows
		.filter((row) => row.address || row.quantity)
		.map((row) => `${row.address},${row.quantity}`)
		.join('\n');
}
