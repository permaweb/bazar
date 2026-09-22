import React from 'react';

import { type DialogFocusTarget, useDialogFocus } from './useDialogFocus';

const OPEN_MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]';

// True while any Dialog is open as a modal, so global shortcuts can stand down.
export function isModalDialogOpen() {
	return document.querySelector(OPEN_MODAL_SELECTOR) !== null;
}

// The only owner of dialog semantics: backdrop, `role="dialog"`, `aria-modal`, focus containment, Escape, and
// focus restoration. A closed dialog renders nothing unless `keepMounted` retains it hidden, as transaction side
// panels do while their work continues in the background; `hiding` marks their exit animation.
export default function Dialog(props: {
	children: React.ReactNode;
	open: boolean;
	onDismiss(): void;
	className: string;
	backdropClassName: string;
	as?: 'div' | 'section';
	id?: string;
	label?: string;
	labelledBy?: string;
	describedBy?: string;
	focusKey?: unknown;
	restoreTarget?: DialogFocusTarget;
	restoreFallback?: DialogFocusTarget;
	panelRef?: React.MutableRefObject<HTMLElement | null>;
	keepMounted?: boolean;
	hiding?: boolean;
}) {
	const panel = React.useRef<HTMLElement | null>(null);
	useDialogFocus(panel, {
		active: props.open,
		focusKey: props.focusKey,
		onEscape: props.onDismiss,
		restoreFallback: props.restoreFallback,
		restoreTarget: props.restoreTarget,
	});
	const attachPanel = React.useCallback(
		(element: HTMLElement | null) => {
			panel.current = element;
			if (props.panelRef) props.panelRef.current = element;
		},
		[props.panelRef]
	);

	function handleBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
		if (event.target === event.currentTarget) props.onDismiss();
	}

	if (!props.open && !props.keepMounted) return null;

	const Panel = props.as ?? 'div';
	return (
		<div
			className={`${props.backdropClassName}${props.hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!props.open}
			onMouseDown={handleBackdropMouseDown}
			role="presentation"
		>
			<Panel
				aria-describedby={props.open ? props.describedBy : undefined}
				aria-hidden={props.open ? undefined : true}
				aria-label={props.open ? props.label : undefined}
				aria-labelledby={props.open ? props.labelledBy : undefined}
				aria-modal={props.open ? true : undefined}
				className={props.className}
				id={props.id}
				ref={attachPanel}
				role={props.open ? 'dialog' : undefined}
				tabIndex={-1}
			>
				{props.children}
			</Panel>
		</div>
	);
}
