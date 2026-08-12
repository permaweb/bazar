import React from 'react';
import { Info, Plus, X } from 'lucide-react';

export type HolderDraftRow = { address: string; quantity: string };

const EMPTY_ROW: HolderDraftRow = { address: '', quantity: '' };

// A single address/quantity pair typed or pasted into one field is left alone;
// anything carrying a newline, comma, or JSON bracket is treated as a whole
// list and expanded across rows (the "paste a blob, autofill the form" flow).
function looksLikeBlob(text: string): boolean {
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

export function HolderListField({
	rows,
	onChange,
	disabled,
	denomination,
	ticker,
}: {
	rows: HolderDraftRow[];
	onChange: (rows: HolderDraftRow[]) => void;
	disabled?: boolean;
	denomination: number;
	ticker: string;
}) {
	const editable = rows.length ? rows : [EMPTY_ROW];
	const exampleAmount = denomination ? '250.5' : '250';

	const setRow = (index: number, patch: Partial<HolderDraftRow>) => {
		onChange(editable.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	};
	const removeRow = (index: number) => {
		const next = editable.filter((_, i) => i !== index);
		onChange(next.length ? next : [EMPTY_ROW]);
	};
	const addRow = () => onChange([...editable, EMPTY_ROW]);

	const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
		const clip = event.clipboardData.getData('text');
		if (!looksLikeBlob(clip)) return; // single value — let it land in the field
		const expanded = expandHolderBlob(clip);
		if (!expanded.length) return;
		event.preventDefault();
		// Keep any rows the user already filled, then append the pasted list. If
		// the grid was just the one empty starter row, this is a clean replace.
		const kept = editable.filter((row, i) => i !== index && (row.address || row.quantity));
		onChange([...kept, ...expanded]);
	};

	return (
		<div className="holder-list">
			<div className="holder-list-head">
				<span>Recipients</span>
				<span className="field-hint" tabIndex={0} aria-label="Holder list format">
					<Info aria-hidden="true" />
					<span className="field-hint-pop" role="tooltip">
						Paste a whole list into any field to autofill the rows. Accepts CSV — one{' '}
						<code>address,quantity</code> per line, <code>#</code> lines are comments — or JSON:{' '}
						<code>{`[{"address":"…","quantity":"${exampleAmount}"}]`}</code>,{' '}
						<code>{`[["…","${exampleAmount}"]]`}</code>, or <code>{`{"…":"${exampleAmount}"}`}</code>.
						Quantities are {ticker} amounts with up to {denomination} decimal
						{denomination === 1 ? ' place' : ' places'}; one row per address. Use quoted JSON strings for
						fractional or very large quantities.
					</span>
				</span>
			</div>
			<div className="holder-list-rows">
				{editable.map((row, index) => (
					<div className="holder-list-row" key={index}>
						<input
							aria-label={`Recipient address, row ${index + 1}`}
							placeholder="Arweave address (43 characters)"
							spellCheck={false}
							autoComplete="off"
							value={row.address}
							disabled={disabled}
							onPaste={(event) => handlePaste(index, event)}
							onChange={(event) => setRow(index, { address: event.target.value.trim() })}
						/>
						<input
							aria-label={`Quantity in ${ticker}, row ${index + 1}`}
							placeholder={`Amount in ${ticker}`}
							inputMode="decimal"
							spellCheck={false}
							autoComplete="off"
							value={row.quantity}
							disabled={disabled}
							onPaste={(event) => handlePaste(index, event)}
							onChange={(event) => setRow(index, { quantity: event.target.value.trim() })}
						/>
						<button
							type="button"
							className="holder-list-remove"
							aria-label={`Remove recipient row ${index + 1}`}
							disabled={disabled || (editable.length === 1 && !row.address && !row.quantity)}
							onClick={() => removeRow(index)}
						>
							<X aria-hidden="true" />
						</button>
					</div>
				))}
			</div>
			<button type="button" className="holder-list-add" onClick={addRow} disabled={disabled}>
				<Plus aria-hidden="true" /> Add recipient
			</button>
		</div>
	);
}
