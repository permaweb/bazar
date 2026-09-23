import React from 'react';
import { Info, Plus, X } from 'lucide-react';

import { Pressable } from 'components/atoms/Pressable';
import { TextInput } from 'components/atoms/TextInput';
import { Tooltip } from 'components/atoms/Tooltip';

import {
	appendHolderRow,
	editableHolderRows,
	type HolderDraftRow,
	pasteHolderRows,
	removeHolderRow,
	updateHolderRow,
} from '../../../model/holder-list';

export default function HolderListField(props: {
	rows: HolderDraftRow[];
	onChange: (rows: HolderDraftRow[]) => void;
	disabled?: boolean;
	denomination: number;
	ticker: string;
}) {
	const editable = editableHolderRows(props.rows);
	const exampleAmount = props.denomination ? '250.5' : '250';

	const handleRowChange = (index: number, patch: Partial<HolderDraftRow>) => {
		props.onChange(updateHolderRow(editable, index, patch));
	};
	const handleRowRemove = (index: number) => props.onChange(removeHolderRow(editable, index));
	const handleRowAdd = () => props.onChange(appendHolderRow(editable));

	const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
		// A single value lands in the field; a pasted list expands across the rows.
		const pasted = pasteHolderRows(editable, index, event.clipboardData.getData('text'));
		if (!pasted) return;
		event.preventDefault();
		props.onChange(pasted);
	};

	return (
		<div className="holder-list">
			<div className="holder-list-head">
				<span>Recipients</span>
				<Tooltip
					className="field-hint"
					content={
						<>
							Paste a whole list into any field to autofill the rows. Accepts CSV — one{' '}
							<code>address,quantity</code> per line, <code>#</code> lines are comments — or JSON:{' '}
							<code>{`[{"address":"…","quantity":"${exampleAmount}"}]`}</code>,{' '}
							<code>{`[["…","${exampleAmount}"]]`}</code>, or <code>{`{"…":"${exampleAmount}"}`}</code>.
							Quantities are {props.ticker} amounts with up to {props.denomination} decimal
							{props.denomination === 1 ? ' place' : ' places'}; one row per address. Use quoted JSON
							strings for fractional or very large quantities.
						</>
					}
				>
					{(tooltipId) => (
						<span aria-describedby={tooltipId} aria-label="Holder list format" tabIndex={0}>
							<Info aria-hidden="true" />
						</span>
					)}
				</Tooltip>
			</div>
			<div className="holder-list-rows">
				{editable.map((row, index) => (
					<div className="holder-list-row" key={index}>
						<TextInput
							aria-label={`Recipient address, row ${index + 1}`}
							placeholder="Arweave address (43 characters)"
							spellCheck={false}
							autoComplete="off"
							value={row.address}
							disabled={props.disabled}
							onPaste={(event) => handlePaste(index, event)}
							onChange={(event) => handleRowChange(index, { address: event.target.value.trim() })}
						/>
						<TextInput
							aria-label={`Quantity in ${props.ticker}, row ${index + 1}`}
							placeholder={`Amount in ${props.ticker}`}
							inputMode="decimal"
							spellCheck={false}
							autoComplete="off"
							value={row.quantity}
							disabled={props.disabled}
							onPaste={(event) => handlePaste(index, event)}
							onChange={(event) => handleRowChange(index, { quantity: event.target.value.trim() })}
						/>
						<Pressable
							type="button"
							className="holder-list-remove"
							aria-label={`Remove recipient row ${index + 1}`}
							disabled={props.disabled || (editable.length === 1 && !row.address && !row.quantity)}
							onClick={() => handleRowRemove(index)}
						>
							<X aria-hidden="true" />
						</Pressable>
					</div>
				))}
			</div>
			<Pressable type="button" className="holder-list-add" onClick={handleRowAdd} disabled={props.disabled}>
				<Plus aria-hidden="true" /> Add recipient
			</Pressable>
		</div>
	);
}
