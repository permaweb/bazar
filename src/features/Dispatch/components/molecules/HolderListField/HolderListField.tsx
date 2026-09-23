import React from 'react';
import { Info, Plus, X } from 'lucide-react';

import { Pressable } from 'components/atoms/Pressable';
import { TextInput } from 'components/atoms/TextInput';
import { Tooltip } from 'components/atoms/Tooltip';
import { formatMessage } from 'helpers/i18n';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { DISPATCH_MESSAGES } from '../../../messages';
import {
	appendHolderRow,
	editableHolderRows,
	type HolderDraftRow,
	pasteHolderRows,
	removeHolderRow,
	updateHolderRow,
} from '../../../model/holder-list';

/** The CSV column order the parser accepts. A format sample like the JSON shapes below, not copy. */
const CSV_HOLDER_SAMPLE = 'address,quantity';

export default function HolderListField(props: {
	rows: HolderDraftRow[];
	onChange: (rows: HolderDraftRow[]) => void;
	disabled?: boolean;
	denomination: number;
	ticker: string;
}) {
	const messages = useMessages(DISPATCH_MESSAGES);
	const plural = usePlural();
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
				<span>{messages.dispatchHolderListRecipients}</span>
				<Tooltip
					className="field-hint"
					content={
						<>
							{messages.dispatchHolderListFormatIntro} <code>{CSV_HOLDER_SAMPLE}</code>{' '}
							{messages.dispatchHolderListFormatPerLine} <code>#</code>{' '}
							{messages.dispatchHolderListFormatComments}{' '}
							<code>{`[{"address":"…","quantity":"${exampleAmount}"}]`}</code>,{' '}
							<code>{`[["…","${exampleAmount}"]]`}</code>, {messages.dispatchHolderListFormatOr}{' '}
							<code>{`{"…":"${exampleAmount}"}`}</code>.{' '}
							{plural(messages.dispatchHolderListFormatQuantities, props.denomination, {
								ticker: props.ticker,
								denomination: props.denomination,
							})}
						</>
					}
				>
					{(tooltipId) => (
						<span
							aria-describedby={tooltipId}
							aria-label={messages.dispatchHolderListFormatLabel}
							tabIndex={0}
						>
							<Info aria-hidden="true" />
						</span>
					)}
				</Tooltip>
			</div>
			<div className="holder-list-rows">
				{editable.map((row, index) => (
					<div className="holder-list-row" key={index}>
						<TextInput
							aria-label={formatMessage(messages.dispatchHolderRowAddressLabel, { row: index + 1 })}
							placeholder={messages.dispatchHolderRowAddressPlaceholder}
							spellCheck={false}
							autoComplete="off"
							value={row.address}
							disabled={props.disabled}
							onPaste={(event) => handlePaste(index, event)}
							onChange={(event) => handleRowChange(index, { address: event.target.value.trim() })}
						/>
						<TextInput
							aria-label={formatMessage(messages.dispatchHolderRowQuantityLabel, {
								ticker: props.ticker,
								row: index + 1,
							})}
							placeholder={formatMessage(messages.dispatchHolderRowQuantityPlaceholder, {
								ticker: props.ticker,
							})}
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
							aria-label={formatMessage(messages.dispatchHolderRowRemove, { row: index + 1 })}
							disabled={props.disabled || (editable.length === 1 && !row.address && !row.quantity)}
							onClick={() => handleRowRemove(index)}
						>
							<X aria-hidden="true" />
						</Pressable>
					</div>
				))}
			</div>
			<Pressable type="button" className="holder-list-add" onClick={handleRowAdd} disabled={props.disabled}>
				<Plus aria-hidden="true" /> {messages.dispatchHolderRowAdd}
			</Pressable>
		</div>
	);
}
