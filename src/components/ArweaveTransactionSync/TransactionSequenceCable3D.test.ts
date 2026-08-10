import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';

import { theme } from 'helpers/theme';

import { RaceShell, RaceTooltip } from './styles';
import {
	CableTelemetryPanel,
	configureTransactionOrbitControls,
	createWebGLRendererSafely,
	type Infinity3DLane,
	retainedPhaseProgress,
	shouldClearTransactionInspection,
	shouldRenderProofPins,
	TransactionRendererFallback,
} from './TransactionSequenceCable3D';
import { TransactionVisualizerBoundary } from './TransactionVisualizerFallback';

function fallbackLane(statusLabel: string): Infinity3DLane {
	return {
		observerUrl: 'https://observer.example',
		label: 'Observer one',
		detail: '',
		statusLabel,
		stages: [],
		progress: 0,
		phases: [],
		state: 'pending',
		confirmations: 0,
		error: false,
		markers: [],
	};
}

function renderFallback(statusLabel: string) {
	return renderToStaticMarkup(
		React.createElement(
			ThemeProvider,
			{ theme },
			React.createElement(TransactionRendererFallback, { lanes: [fallbackLane(statusLabel)] })
		)
	);
}

describe('transaction map renderer fallback', () => {
	it('contains a failed lazy visualizer and renders its local fallback', () => {
		const boundary = new TransactionVisualizerBoundary({
			children: 'visualizer',
			fallback: 'tracking continues',
		});
		boundary.state = TransactionVisualizerBoundary.getDerivedStateFromError();

		expect(boundary.render()).toBe('tracking continues');
	});

	it('omits the raw HTTP status-count row from network telemetry', () => {
		const markup = renderToStaticMarkup(
			React.createElement(
				ThemeProvider,
				{ theme },
				React.createElement(CableTelemetryPanel, {
					telemetry: {
						heading: 'Network consensus',
						liveLabel: 'Live',
						metrics: [],
						activityLabel: 'Recent network activity',
						activity: [],
						mining: { heading: 'Arweave protocol', status: 'Sampling live mining activity', metrics: [] },
					},
				})
			)
		);
		expect(markup).not.toContain('HTTP 404');
		expect(markup).toContain('Recent network activity');
	});

	it('positions observer tooltips inside the transaction visualization', () => {
		const sheet = new ServerStyleSheet();
		renderToStaticMarkup(
			sheet.collectStyles(
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(RaceTooltip, { $below: false, $left: 120, $top: 80 }, 'Observer status')
				)
			)
		);
		const css = sheet.getStyleTags();
		sheet.seal();
		expect(css).toContain('position:absolute');
		expect(css).not.toContain('position:fixed');
	});

	it('keeps the transaction map in a fixed viewport as observer lanes are added', () => {
		const sheet = new ServerStyleSheet();
		renderToStaticMarkup(
			sheet.collectStyles(
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(RaceShell, { $height: 320, $embedded: false })
				)
			)
		);
		const css = sheet.getStyleTags();
		sheet.seal();
		expect(css).toContain('width:100%');
		expect(css).toContain('height:clamp(280px,48dvh,320px)');
		expect(css).toContain('margin:8px auto 0');
		expect(css).not.toContain('aspect-ratio');
		expect(css).not.toContain('margin-bottom:-126px');
	});

	it('lets the unavailable network view size to its content at the full container width', () => {
		const sheet = new ServerStyleSheet();
		renderToStaticMarkup(
			sheet.collectStyles(
				React.createElement(
					ThemeProvider,
					{ theme },
					React.createElement(TransactionRendererFallback, { lanes: [fallbackLane('Confirmed')] })
				)
			)
		);
		const css = sheet.getStyleTags();
		sheet.seal();
		expect(css).toContain('position:relative');
		expect(css).toContain('width:100%');
		expect(css).toContain('padding:16px 18px');
		expect(css).not.toContain('position:absolute');
		expect(css).not.toContain('inset:18px');
	});

	it('owns Escape only while an inspection is visible', () => {
		expect(shouldClearTransactionInspection('Escape', true)).toBe(true);
		expect(shouldClearTransactionInspection('Escape', false)).toBe(false);
		expect(shouldClearTransactionInspection('ArrowRight', true)).toBe(false);
	});

	it('turns WebGL initialization failure into an optional visualization fallback', () => {
		expect(
			createWebGLRendererSafely(() => {
				throw new Error('WebGL unavailable');
			})
		).toBeNull();
		expect(shouldRenderProofPins(true)).toBe(false);
	});

	it('keeps proof cards available with the normal renderer', () => {
		expect(shouldRenderProofPins(false)).toBe(true);
	});

	it('locks the transaction map framing so vertical gestures remain available to the dialog', () => {
		const controls = {
			enableDamping: false,
			dampingFactor: 0,
			enablePan: true,
			enableZoom: true,
			minDistance: 0,
			maxDistance: 0,
			autoRotate: false,
			autoRotateSpeed: 0,
		};

		configureTransactionOrbitControls(controls, true);

		expect(controls).toMatchObject({
			enableDamping: true,
			dampingFactor: 0.07,
			enablePan: false,
			enableZoom: false,
			minDistance: 10.4,
			maxDistance: 20,
			autoRotate: true,
			autoRotateSpeed: 0.22,
		});
	});

	it('keeps changing observer rows outside the one-time fallback announcement', () => {
		const initial = renderFallback('Waiting for transaction');
		const changed = renderFallback('3 confirmations');
		expect(initial.match(/role="status"/g)).toHaveLength(1);
		expect(changed.match(/role="status"/g)).toHaveLength(1);
		expect(initial).toContain('aria-label="Live observer status"');
		expect(initial.indexOf('role="status"')).toBeLessThan(initial.indexOf('aria-label="Live observer status"'));
		expect(changed).toContain('3 confirmations');
		expect(changed).toContain('Transaction tracking continues with live observer status.');
	});

	it('restores hidden cable progress to the latest live position without moving backward', () => {
		expect(retainedPhaseProgress(18, 42, 0, 50)).toBe(42);
		expect(retainedPhaseProgress(42, 18, 0, 50)).toBe(42);
		expect(retainedPhaseProgress(18, 72, 0, 50)).toBe(50);
	});
});
