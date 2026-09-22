import { ArrowRight, RefreshCw } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from '../../atoms/ArCurrencyLabel';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

export type ErrorPanelAction = {
	label: string;
	onClick(): void;
};

export default function ErrorPanel(props: {
	message: string;
	onRetry?: () => void;
	secondaryAction?: ErrorPanelAction;
}) {
	const heading = 'Unable to load';
	return (
		<div className={`error-panel${props.onRetry ? ' retry-notice' : ''}`}>
			<strong>{heading}</strong>
			<span
				aria-label={formatArCurrencyText(`${heading}. ${props.message}`)}
				role={props.onRetry ? 'status' : 'alert'}
			>
				<ArCurrencyText>{props.message}</ArCurrencyText>
			</span>
			{props.onRetry || props.secondaryAction ? (
				<div className="error-panel-actions">
					{props.onRetry ? (
						<Button
							className="with-icon error-panel-retry"
							onClick={() => {
								props.onRetry?.();
								document.getElementById('main-content')?.focus({ preventScroll: true });
							}}
						>
							<Icon icon={RefreshCw} size="sm" /> Retry
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
