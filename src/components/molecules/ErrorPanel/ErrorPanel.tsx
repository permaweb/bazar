import { ArrowRight, RefreshCw } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from '../../atoms/ArCurrencyLabel';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

export type ErrorPanelAction = {
	label: string;
	onClick(): void;
};

// The heading and the retry control's wording come from the caller's catalog: a molecule may not read the
// language provider. A retry handler without its label would render an unnamed control, so they travel together.
export default function ErrorPanel(props: {
	heading: string;
	message: string;
	retryAction?: ErrorPanelAction;
	secondaryAction?: ErrorPanelAction;
}) {
	return (
		<div className={`error-panel${props.retryAction ? ' retry-notice' : ''}`}>
			<strong>{props.heading}</strong>
			<span
				aria-label={formatArCurrencyText(`${props.heading}. ${props.message}`)}
				role={props.retryAction ? 'status' : 'alert'}
			>
				<ArCurrencyText>{props.message}</ArCurrencyText>
			</span>
			{props.retryAction || props.secondaryAction ? (
				<div className="error-panel-actions">
					{props.retryAction ? (
						<Button
							className="with-icon error-panel-retry"
							onClick={() => {
								props.retryAction?.onClick();
								document.getElementById('main-content')?.focus({ preventScroll: true });
							}}
						>
							<Icon icon={RefreshCw} size="sm" /> {props.retryAction.label}
						</Button>
					) : null}
					{props.secondaryAction ? (
						<Button className="with-icon error-panel-action" onClick={props.secondaryAction.onClick}>
							{props.secondaryAction.label} <Icon icon={ArrowRight} size="sm" />
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
