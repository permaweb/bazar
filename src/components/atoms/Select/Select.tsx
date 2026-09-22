import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from '../ArCurrencyLabel';
import { Button } from '../Button';

type SelectOption<Value extends string> = {
	value: Value;
	label: string;
};

export default function Select<Value extends string>(props: {
	label: string;
	value: Value;
	options: readonly SelectOption<Value>[];
	onChange(value: Value): void;
	showLabel?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const rootRef = React.useRef<HTMLDivElement>(null);
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const menuId = React.useId();
	const selectedIndex = Math.max(
		0,
		props.options.findIndex((option) => option.value === props.value)
	);
	const selected = props.options[selectedIndex];

	React.useEffect(() => {
		if (!open) return;
		const closeOnOutsidePress = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener('pointerdown', closeOnOutsidePress);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsidePress);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	const focusOption = (index: number) => {
		const normalizedIndex = (index + props.options.length) % props.options.length;
		optionRefs.current[normalizedIndex]?.focus();
	};
	const openAndFocus = (index = selectedIndex) => {
		setOpen(true);
		window.requestAnimationFrame(() => focusOption(index));
	};
	const selectOption = (option: SelectOption<Value>) => {
		props.onChange(option.value);
		setOpen(false);
		triggerRef.current?.focus();
	};
	const leaveOptions = (backwards: boolean) => {
		const trigger = triggerRef.current;
		const tabStops = [
			...document.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			),
		].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
		const triggerIndex = trigger ? tabStops.indexOf(trigger) : -1;
		const target = backwards ? trigger : tabStops[triggerIndex + 1];
		target?.focus();
		setOpen(false);
	};

	return (
		<div
			className="market-select"
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
			}}
			ref={rootRef}
		>
			{props.showLabel ?? true ? <span className="market-select-label">{props.label}</span> : null}
			<Button
				aria-controls={menuId}
				aria-expanded={open}
				aria-haspopup="listbox"
				aria-label={formatArCurrencyText(`${props.label}: ${selected.label}`)}
				className={`market-select-trigger${open ? ' open' : ''}`}
				size="custom"
				onClick={() => (open ? setOpen(false) : openAndFocus())}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
					event.preventDefault();
					openAndFocus(event.key === 'ArrowDown' ? selectedIndex : selectedIndex - 1);
				}}
				ref={triggerRef}
				type="button"
			>
				<span>
					<ArCurrencyText>{selected.label}</ArCurrencyText>
				</span>
				<ChevronDown aria-hidden="true" />
			</Button>
			{open ? (
				<div aria-label={props.label} className="market-select-menu" id={menuId} role="listbox">
					{props.options.map((option, index) => {
						const active = option.value === props.value;
						return (
							<Button
								aria-selected={active}
								className={`market-select-option${active ? ' active' : ''}`}
								key={option.value}
								size="custom"
								onClick={() => selectOption(option)}
								onKeyDown={(event) => {
									if (event.key === 'Tab') {
										event.preventDefault();
										leaveOptions(event.shiftKey);
									} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
										event.preventDefault();
										focusOption(index + (event.key === 'ArrowDown' ? 1 : -1));
									} else if (event.key === 'Home' || event.key === 'End') {
										event.preventDefault();
										focusOption(event.key === 'Home' ? 0 : props.options.length - 1);
									}
								}}
								ref={(element) => {
									optionRefs.current[index] = element;
								}}
								role="option"
								tabIndex={-1}
								variant="ghost"
								type="button"
							>
								<span>
									<ArCurrencyText>{option.label}</ArCurrencyText>
								</span>
								{active ? <Check aria-hidden="true" /> : null}
							</Button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
