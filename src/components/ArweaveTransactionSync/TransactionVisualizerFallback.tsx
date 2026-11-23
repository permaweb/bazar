import React from 'react';
import styled from 'styled-components';

import type { Infinity3DLane } from './TransactionSequenceCable3D';

type BoundaryProps = React.PropsWithChildren<{
	fallback: React.ReactNode;
	resetKey?: string;
}>;

type BoundaryState = {
	failed: boolean;
};

export class TransactionVisualizerBoundary extends React.Component<BoundaryProps, BoundaryState> {
	state: BoundaryState = { failed: false };

	static getDerivedStateFromError(): BoundaryState {
		return { failed: true };
	}

	componentDidUpdate(previousProps: BoundaryProps) {
		if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
			this.setState({ failed: false });
		}
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

/**
 * Why the lane list stands in for the 3D network view.
 * - `loading`: the lazy three.js chunk is still downloading (Suspense fallback). Neutral copy, no live region.
 * - `unavailable`: WebGL could not start or the visualizer crashed. Announced once through role=status.
 */
export type TransactionRendererFallbackVariant = 'loading' | 'unavailable';

export function TransactionRendererFallback({
	lanes,
	variant = 'unavailable',
}: {
	lanes: Infinity3DLane[];
	variant?: TransactionRendererFallbackVariant;
}) {
	return (
		<RendererFallback data-renderer-state={variant}>
			{variant === 'loading' ? (
				<div className="renderer-fallback-heading">
					<strong>Loading 3D network view…</strong>
				</div>
			) : (
				<div className="renderer-fallback-heading" aria-atomic="true" aria-live="polite" role="status">
					<strong>3D network view unavailable</strong>
					<span>Transaction tracking continues with live observer status.</span>
				</div>
			)}
			<ul aria-label="Live observer status">
				{lanes.slice(0, 8).map((lane) => (
					<li key={lane.observerUrl}>
						<span>{lane.label}</span>
						<small>{lane.statusLabel}</small>
					</li>
				))}
			</ul>
		</RendererFallback>
	);
}

const RendererFallback = styled.div`
	position: relative;
	z-index: 4;
	width: 100%;
	padding: 16px 18px;
	display: grid;
	align-content: start;
	gap: 6px;
	overflow: hidden;
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 14px;
	background: color-mix(in srgb, ${(props) => props.theme.colors.container.primary.background} 94%, transparent);
	color: ${(props) => props.theme.colors.font.alt1};

	.renderer-fallback-heading {
		display: grid;
		gap: 6px;
	}

	.renderer-fallback-heading > strong {
		color: ${(props) => props.theme.colors.font.primary};
	}

	.renderer-fallback-heading > span,
	small {
		font-size: ${(props) => props.theme.typography.size.body};
	}

	ul {
		margin: 8px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		list-style: none;
	}

	li {
		min-width: 0;
		padding: 7px 9px;
		display: grid;
		gap: 2px;
		border-radius: 8px;
		background: ${(props) => props.theme.colors.container.alt1.background};
	}

	li span,
	li small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		padding: 12px;

		ul {
			grid-template-columns: 1fr;
		}
	}
`;
