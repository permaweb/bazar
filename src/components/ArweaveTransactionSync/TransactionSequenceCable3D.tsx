import React from 'react';
import styled, { keyframes } from 'styled-components';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { ObserverView } from 'weave-wrangler';

import {
	type ArweaveRecallContent,
	type ArweaveRecallContentKind,
	canPreviewRecallImage,
	fetchBoundedRecallImage,
} from 'api/arweave-mining-telemetry';

import {
	ACCEPTED_PROOF_ANNOTATION_LIFETIME_MS,
	acceptedProofAnnotationIsVisible,
	acceptedProofAnnotationOpacity,
} from './acceptedProofs';
import { ObserverTooltipCard, type ObserverTooltipStage } from './ObserverTooltipCard';
import { progressColorRgb } from './progressColors';
import { sequencePhaseBounds } from './sequence';
import { RaceTooltip as RaceTooltipContainer } from './styles';
import { TransactionRendererFallback } from './TransactionVisualizerFallback';

export { TransactionRendererFallback } from './TransactionVisualizerFallback';

type Marker = {
	kind: 'event' | 'proof';
	confirmation: boolean;
	progress: number;
	state: ObserverView['state'];
	confirmations: number;
	error: boolean;
	detail: string;
	observedAt?: number;
};

export type Infinity3DLane = {
	observerUrl: string;
	label: string;
	detail: string;
	statusLabel: string;
	stages: ObserverTooltipStage[];
	progress: number;
	phases: Array<{
		progress: number;
		started: boolean;
		complete: boolean;
	}>;
	state: ObserverView['state'];
	confirmations: number;
	error: boolean;
	markers: Marker[];
};

type Props = {
	lanes: Infinity3DLane[];
	ariaLabel: string;
	phaseLabels: string[];
	active?: boolean;
	layout?: 'spread' | 'bundle';
	miningActivity?: {
		candidateRate?: number;
		acceptedProofs: Array<{
			key: string;
			height: number;
			observedAt: number;
			label: string;
			meta: string;
			recalls: Array<{
				key: string;
				content?: ArweaveRecallContent;
				fallback: string;
				contentLabel: string;
				meta?: string;
			}>;
		}>;
	};
};

export type CableTelemetry = {
	heading: string;
	liveLabel: string;
	metrics: Array<{ label: string; value: string }>;
	activityLabel: string;
	activity: Array<{
		key: string;
		label: string;
		detail: string;
		kind: 'proof' | 'status' | 'confirmation' | 'error';
		typeLabel: string;
	}>;
	mining: {
		heading: string;
		status: string;
		metrics: Array<{ label: string; value: string }>;
	};
};

type LaneHover = {
	kind: 'lane';
	observerLabel: string;
	detail: string;
	stages: ObserverTooltipStage[];
	x: number;
	y: number;
	below: boolean;
};

type Hover = LaneHover;

type MarkerHoverData = {
	laneIndex: number;
	detail: string;
};

function useTransientAcceptedProofs(
	proofs: NonNullable<Props['miningActivity']>['acceptedProofs']
): NonNullable<Props['miningActivity']>['acceptedProofs'] {
	const [, setVisibilityClock] = React.useState(() => Date.now());
	const now = Date.now();
	const visibleProofs = proofs.filter((proof) => acceptedProofAnnotationIsVisible(proof.observedAt, now));
	const nextRemovalAt = visibleProofs.reduce(
		(earliest, proof) => Math.min(earliest, proof.observedAt + ACCEPTED_PROOF_ANNOTATION_LIFETIME_MS),
		Number.POSITIVE_INFINITY
	);

	React.useEffect(() => {
		if (!Number.isFinite(nextRemovalAt)) return undefined;
		const timer = window.setTimeout(
			() => setVisibilityClock(Date.now()),
			Math.max(0, nextRemovalAt - Date.now()) + 16
		);
		return () => window.clearTimeout(timer);
	}, [nextRemovalAt]);

	return visibleProofs;
}

type WireState = {
	positions: Float32Array;
	baseGeometry: LineGeometry;
	baseMaterial: LineMaterial;
	baseLine: Line2;
	phaseGeometries: LineGeometry[];
	phaseMaterials: LineMaterial[];
	phaseLines: Line2[];
	laneIndex: number;
	displayedPhaseProgress: number[];
};

const SAMPLE_COUNT = 720;
const BASE_WIRE = new THREE.Color('#aeb6b1');
const HIGHLIGHT_WIRE = new THREE.Color('#d9dedb');
const BASE_LINE_WIDTH = 2.8;
const PROGRESS_LINE_WIDTH = 4.1;
const MAX_MINING_PARTICLES = 180;
const PICK_SAMPLE_STEP = 12;
const MAX_RENDER_PIXEL_RATIO = 1.5;
const PARTICLE_HIGHLIGHT = new THREE.Color('#ffffff');
const ACCEPTED_PROOF_CARD_WIDTH = 224;
const ACCEPTED_PROOF_CARD_HEIGHT = 144;
const ACCEPTED_PROOF_CARD_COMPACT_WIDTH = 196;
const ACCEPTED_PROOF_CARD_COMPACT_HEIGHT = 128;
const EMPTY_ACCEPTED_PROOFS: NonNullable<Props['miningActivity']>['acceptedProofs'] = [];

export function createWebGLRendererSafely(
	create: () => THREE.WebGLRenderer = () => new THREE.WebGLRenderer({ alpha: true, antialias: true })
) {
	try {
		return create();
	} catch {
		return null;
	}
}

export function shouldRenderProofPins(rendererUnavailable: boolean) {
	return !rendererUnavailable;
}

export function shouldClearTransactionInspection(key: string, inspected: boolean) {
	return key === 'Escape' && inspected;
}

type TransactionOrbitControls = Pick<
	OrbitControls,
	| 'enableDamping'
	| 'dampingFactor'
	| 'enablePan'
	| 'enableZoom'
	| 'minDistance'
	| 'maxDistance'
	| 'autoRotate'
	| 'autoRotateSpeed'
>;

export function configureTransactionOrbitControls(controls: TransactionOrbitControls, bundled: boolean) {
	controls.enableDamping = true;
	controls.dampingFactor = 0.07;
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.minDistance = bundled ? 10.4 : 11.8;
	controls.maxDistance = 20;
	controls.autoRotate = true;
	controls.autoRotateSpeed = 0.22;
}

export function TransactionSequenceCable3D({
	lanes,
	ariaLabel,
	phaseLabels,
	active = true,
	layout = 'spread',
	miningActivity,
}: Props) {
	const mountRef = React.useRef<HTMLDivElement>(null);
	const activeRef = React.useRef(active);
	const resumeSyncRef = React.useRef(false);
	const phaseLabelRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
	const wireStatesRef = React.useRef<WireState[]>([]);
	const laneDataRef = React.useRef(lanes);
	const miningActivityRef = React.useRef(miningActivity);
	const markerGeometryRef = React.useRef<THREE.BufferGeometry>();
	const eventHoverDataRef = React.useRef<MarkerHoverData[]>([]);
	const confirmationHoverDataRef = React.useRef<MarkerHoverData[]>([]);
	const proofHoverDataRef = React.useRef<MarkerHoverData[]>([]);
	const acceptedProofPinRefs = React.useRef(new Map<string, HTMLSpanElement>());
	const highlightedLaneRef = React.useRef<number>();
	const tooltipRef = React.useRef<HTMLSpanElement>(null);
	const hoverRef = React.useRef<Hover>();
	const keyboardCursorRef = React.useRef(-1);
	const [hover, setHover] = React.useState<Hover>();
	const [rendererUnavailable, setRendererUnavailable] = React.useState(false);
	const acceptedProofs = useTransientAcceptedProofs(miningActivity?.acceptedProofs ?? EMPTY_ACCEPTED_PROOFS);
	const visibleMiningActivity = miningActivity ? { ...miningActivity, acceptedProofs } : undefined;
	const phaseLabelKey = phaseLabels.join('\u0000');
	const tooltipId = React.useId();

	if (active && !activeRef.current) resumeSyncRef.current = true;
	activeRef.current = active;
	laneDataRef.current = lanes;
	miningActivityRef.current = visibleMiningActivity;

	React.useEffect(() => {
		const current = hoverRef.current;
		const laneIndex = highlightedLaneRef.current;
		if (current?.kind !== 'lane' || laneIndex === undefined) return;
		const lane = lanes[laneIndex];
		if (!lane) return;
		const nextHover: LaneHover = {
			...current,
			observerLabel: lane.label,
			stages: lane.stages,
		};
		hoverRef.current = nextHover;
		setHover(nextHover);
	}, [lanes]);

	React.useEffect(() => {
		const mount = mountRef.current;
		if (!mount || lanes.length === 0) return undefined;
		const bundled = layout === 'bundle';
		const phaseCount = Math.max(1, phaseLabels.length);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
		camera.position.set(bundled ? 0.35 : 0.8, bundled ? 0.35 : 0.75, bundled ? 15.4 : 16.9);
		camera.lookAt(0, 0, 0);

		const renderer = createWebGLRendererSafely();
		if (!renderer) {
			setRendererUnavailable(true);
			return undefined;
		}
		setRendererUnavailable(false);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.setAttribute(
			'aria-label',
			`${ariaLabel}. Use arrow keys to inspect observer lanes and events; press Escape to clear.`
		);
		renderer.domElement.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape');
		renderer.domElement.setAttribute('aria-roledescription', 'interactive transaction map');
		renderer.domElement.setAttribute('role', 'application');
		renderer.domElement.tabIndex = 0;
		mount.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		configureTransactionOrbitControls(controls, bundled);
		// OrbitControls defaults to `touch-action: none`, which traps vertical
		// gestures inside the visualization instead of scrolling the dialog.
		renderer.domElement.style.touchAction = 'pan-y';

		const group = new THREE.Group();
		group.rotation.set(bundled ? -0.16 : -0.11, bundled ? 0.04 : 0.09, bundled ? -0.01 : -0.025);
		scene.add(group);
		const baseLineWidth = bundled ? 2.4 : BASE_LINE_WIDTH;
		const progressLineWidth = bundled ? 3.7 : PROGRESS_LINE_WIDTH;

		const wireStates = lanes.map((_, laneIndex) => {
			const positions = createWirePositions(laneIndex, lanes.length, layout);
			const closedPositions = closedLinePositions(positions);
			const baseGeometry = new LineGeometry();
			baseGeometry.setPositions(closedPositions);
			const baseMaterial = new LineMaterial({
				color: BASE_WIRE.getHex(),
				linewidth: baseLineWidth,
				transparent: true,
				opacity: 0.9,
				alphaToCoverage: true,
			});
			const baseLine = new Line2(baseGeometry, baseMaterial);
			const phaseGeometries: LineGeometry[] = [];
			const phaseMaterials: LineMaterial[] = [];
			const phaseLines: Line2[] = [];
			for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex += 1) {
				const bounds = sequencePhaseBounds(phaseIndex, phaseCount);
				const startIndex = Math.round((bounds.start / 100) * SAMPLE_COUNT);
				const endIndex = Math.round((bounds.end / 100) * SAMPLE_COUNT);
				const geometry = new LineGeometry();
				geometry.setPositions(phaseLinePositions(positions, startIndex, endIndex));
				geometry.setColors(createProgressColors(startIndex, endIndex));
				geometry.instanceCount = 1;
				const material = new LineMaterial({
					vertexColors: true,
					linewidth: progressLineWidth,
					transparent: true,
					opacity: 1,
					depthWrite: false,
					alphaToCoverage: true,
				});
				const line = new Line2(geometry, material);
				line.frustumCulled = false;
				line.renderOrder = 2;
				phaseGeometries.push(geometry);
				phaseMaterials.push(material);
				phaseLines.push(line);
			}
			baseLine.userData.laneIndex = laneIndex;
			baseLine.frustumCulled = false;
			group.add(baseLine, ...phaseLines);
			const wire: WireState = {
				positions,
				baseGeometry,
				baseMaterial,
				baseLine,
				phaseGeometries,
				phaseMaterials,
				phaseLines,
				laneIndex,
				displayedPhaseProgress: Array.from(
					{ length: phaseCount },
					(_, phaseIndex) =>
						lanes[laneIndex]?.phases[phaseIndex]?.progress ??
						sequencePhaseBounds(phaseIndex, phaseCount).start
				),
			};
			snapWireProgress(wire, lanes[laneIndex], phaseCount);
			return wire;
		});
		wireStatesRef.current = wireStates;

		const dotTexture = createDotTexture();
		const eventGeometry = new THREE.BufferGeometry();
		markerGeometryRef.current = eventGeometry;
		const confirmationGeometry = new THREE.BufferGeometry();
		const proofGeometry = new THREE.BufferGeometry();
		const activeHeadGeometry = new THREE.BufferGeometry();
		const maxActiveHeads = lanes.length * phaseCount;
		activeHeadGeometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(new Float32Array(maxActiveHeads * 3), 3)
		);
		activeHeadGeometry.setAttribute(
			'color',
			new THREE.Float32BufferAttribute(new Float32Array(maxActiveHeads * 3), 3)
		);
		activeHeadGeometry.setDrawRange(0, 0);
		const acceptedProofGeometry = new THREE.BufferGeometry();
		const miningParticleGeometry = new THREE.BufferGeometry();
		miningParticleGeometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(new Float32Array(MAX_MINING_PARTICLES * 3), 3)
		);
		miningParticleGeometry.setAttribute(
			'color',
			new THREE.Float32BufferAttribute(new Float32Array(MAX_MINING_PARTICLES * 3), 3)
		);
		miningParticleGeometry.setDrawRange(0, 0);
		const eventHaloMaterial = new THREE.PointsMaterial({
			color: 0x111111,
			size: 0.35,
			sizeAttenuation: true,
			map: dotTexture,
			alphaTest: 0.2,
			transparent: true,
			opacity: 0.96,
			depthWrite: false,
		});
		const eventMaterial = new THREE.PointsMaterial({
			size: 0.3,
			sizeAttenuation: true,
			map: dotTexture,
			alphaTest: 0.2,
			vertexColors: true,
			transparent: true,
			opacity: 1,
			depthWrite: false,
		});
		const confirmationHaloMaterial = eventHaloMaterial.clone();
		confirmationHaloMaterial.size = 0.58;
		const confirmationMaterial = eventMaterial.clone();
		confirmationMaterial.size = 0.5;
		const proofHaloMaterial = eventHaloMaterial.clone();
		proofHaloMaterial.size = 0.255;
		proofHaloMaterial.opacity = 0.32;
		const proofMaterial = eventMaterial.clone();
		proofMaterial.size = 0.22;
		const activeHeadMaterial = eventMaterial.clone();
		activeHeadMaterial.size = 0.12;
		const acceptedProofHaloMaterial = eventHaloMaterial.clone();
		acceptedProofHaloMaterial.size = 0.385;
		acceptedProofHaloMaterial.opacity = 0.86;
		const acceptedProofMaterial = eventMaterial.clone();
		acceptedProofMaterial.size = 0.33;
		const miningParticleMaterial = new THREE.PointsMaterial({
			size: 0.1,
			sizeAttenuation: true,
			map: dotTexture,
			alphaTest: 0.08,
			vertexColors: true,
			transparent: true,
			opacity: 0.62,
			depthWrite: false,
		});
		const eventHalo = new THREE.Points(eventGeometry, eventHaloMaterial);
		const eventMarkers = new THREE.Points(eventGeometry, eventMaterial);
		const confirmationHalo = new THREE.Points(confirmationGeometry, confirmationHaloMaterial);
		const confirmationMarkers = new THREE.Points(confirmationGeometry, confirmationMaterial);
		const proofHalo = new THREE.Points(proofGeometry, proofHaloMaterial);
		const proofMarkers = new THREE.Points(proofGeometry, proofMaterial);
		const activeHeads = new THREE.Points(activeHeadGeometry, activeHeadMaterial);
		const acceptedProofHalo = new THREE.Points(acceptedProofGeometry, acceptedProofHaloMaterial);
		const acceptedProofMarkers = new THREE.Points(acceptedProofGeometry, acceptedProofMaterial);
		const miningParticles = new THREE.Points(miningParticleGeometry, miningParticleMaterial);
		activeHeads.frustumCulled = false;
		miningParticles.frustumCulled = false;
		proofHalo.renderOrder = 4;
		proofMarkers.renderOrder = 5;
		eventHalo.renderOrder = 4;
		eventMarkers.renderOrder = 5;
		confirmationHalo.renderOrder = 6;
		confirmationMarkers.renderOrder = 7;
		activeHeads.renderOrder = 3;
		miningParticles.renderOrder = 3;
		acceptedProofHalo.renderOrder = 8;
		acceptedProofMarkers.renderOrder = 9;
		group.add(
			miningParticles,
			proofHalo,
			proofMarkers,
			eventHalo,
			eventMarkers,
			confirmationHalo,
			confirmationMarkers,
			activeHeads,
			acceptedProofHalo,
			acceptedProofMarkers
		);

		const pickLineMaterial = new THREE.LineBasicMaterial({ visible: false });
		const pickLines = wireStates.map((wire) => {
			const pickGeometry = new THREE.BufferGeometry();
			pickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(decimateWire(wire.positions), 3));
			const pickLine = new THREE.LineLoop(pickGeometry, pickLineMaterial);
			pickLine.userData.laneIndex = wire.laneIndex;
			pickLine.visible = false;
			group.add(pickLine);
			return pickLine;
		});
		const raycaster = new THREE.Raycaster();
		(raycaster.params as typeof raycaster.params & { Line: { threshold: number } }).Line = { threshold: 0.18 };
		raycaster.params.Points = { threshold: 0.24 };
		const pointer = new THREE.Vector2();
		const raycastHits: THREE.Intersection[] = [];
		const firstIntersection = (object: THREE.Object3D): THREE.Intersection | undefined => {
			raycastHits.length = 0;
			raycaster.intersectObject(object, false, raycastHits);
			return raycastHits[0];
		};
		const firstLaneIntersection = (): THREE.Intersection | undefined => {
			raycastHits.length = 0;
			raycaster.intersectObjects(pickLines, false, raycastHits);
			return raycastHits[0];
		};
		const setWireHighlight = (wire: WireState, highlighted: boolean) => {
			wire.baseMaterial.color.copy(highlighted ? HIGHLIGHT_WIRE : BASE_WIRE);
			wire.baseMaterial.linewidth = highlighted ? baseLineWidth + 0.7 : baseLineWidth;
			wire.baseMaterial.opacity = highlighted ? 1 : 0.9;
			wire.phaseMaterials.forEach((material) => {
				material.linewidth = highlighted ? progressLineWidth + 0.6 : progressLineWidth;
			});
			wire.baseLine.renderOrder = highlighted ? 6 : 0;
			wire.phaseLines.forEach((line) => {
				line.renderOrder = highlighted ? 7 : 2;
			});
		};
		const highlightLane = (laneIndex?: number) => {
			if (highlightedLaneRef.current === laneIndex) return;
			const previousLaneIndex = highlightedLaneRef.current;
			highlightedLaneRef.current = laneIndex;
			controls.autoRotate = laneIndex === undefined;
			if (previousLaneIndex !== undefined) {
				const previousWire = wireStates[previousLaneIndex];
				if (previousWire) setWireHighlight(previousWire, false);
			}
			if (laneIndex !== undefined) {
				const nextWire = wireStates[laneIndex];
				if (nextWire) setWireHighlight(nextWire, true);
			}
		};
		const updateTooltipPosition = (x: number, y: number) => {
			const tooltip = tooltipRef.current;
			if (!tooltip) return;
			tooltip.style.setProperty('--race-tooltip-x', `${x}px`);
			tooltip.style.setProperty('--race-tooltip-y', `${y}px`);
		};
		const showHover = (nextHover: Hover) => {
			const currentHover = hoverRef.current;
			hoverRef.current = nextHover;
			renderer.domElement.setAttribute('aria-describedby', tooltipId);
			renderer.domElement.setAttribute('data-dialog-escape-owner', '');
			updateTooltipPosition(nextHover.x, nextHover.y);
			if (!sameHoverContent(currentHover, nextHover)) setHover(nextHover);
		};
		const hideHover = () => {
			renderer.domElement.removeAttribute('data-dialog-escape-owner');
			if (!hoverRef.current) return;
			hoverRef.current = undefined;
			renderer.domElement.removeAttribute('aria-describedby');
			setHover(undefined);
		};
		const processPointerMove = (clientX: number, clientY: number) => {
			const bounds = renderer.domElement.getBoundingClientRect();
			pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
			pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);
			const horizontalInset = Math.min(150, bounds.width / 2);
			const x = Math.max(horizontalInset, Math.min(bounds.width - horizontalInset, clientX - bounds.left));
			const y = Math.max(0, Math.min(bounds.height, clientY - bounds.top));
			const confirmationHit = firstIntersection(confirmationMarkers);
			const eventHit = confirmationHit ? undefined : firstIntersection(eventMarkers);
			const proofHit = confirmationHit || eventHit ? undefined : firstIntersection(proofMarkers);
			const markerHoverData = confirmationHit
				? confirmationHit.index === undefined
					? undefined
					: confirmationHoverDataRef.current[confirmationHit.index]
				: eventHit?.index !== undefined
				? eventHoverDataRef.current[eventHit.index]
				: proofHit?.index === undefined
				? undefined
				: proofHoverDataRef.current[proofHit.index];
			const hit = markerHoverData ? undefined : firstLaneIntersection();
			if (!markerHoverData && !hit) {
				highlightLane(undefined);
				hideHover();
				return;
			}
			const laneIndex = markerHoverData?.laneIndex ?? (hit?.object.userData.laneIndex as number | undefined);
			if (laneIndex === undefined) return;
			const lane = laneDataRef.current[laneIndex];
			if (!lane) return;
			highlightLane(laneIndex);
			showHover({
				kind: 'lane',
				observerLabel: lane.label,
				detail: markerHoverData?.detail ?? lane.statusLabel,
				stages: lane.stages,
				x,
				y,
				below: y < 58,
			});
		};
		let pointerFrame = 0;
		let pendingPointer: { x: number; y: number } | undefined;
		let controlsActive = false;
		const handlePointerMove = (event: PointerEvent) => {
			if (controlsActive) return;
			pendingPointer = { x: event.clientX, y: event.clientY };
			if (pointerFrame) return;
			pointerFrame = window.requestAnimationFrame(() => {
				pointerFrame = 0;
				const nextPointer = pendingPointer;
				pendingPointer = undefined;
				if (nextPointer) processPointerMove(nextPointer.x, nextPointer.y);
			});
		};
		const clearHover = () => {
			if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
			pointerFrame = 0;
			pendingPointer = undefined;
			highlightLane(undefined);
			keyboardCursorRef.current = -1;
			hideHover();
		};
		const keyboardItems = () =>
			laneDataRef.current.flatMap((lane, laneIndex) => [
				{ laneIndex, detail: lane.statusLabel },
				...[
					...eventHoverDataRef.current,
					...confirmationHoverDataRef.current,
					...proofHoverDataRef.current,
				].filter((item) => item.laneIndex === laneIndex),
			]);
		const showKeyboardItem = (item: MarkerHoverData) => {
			const lane = laneDataRef.current[item.laneIndex];
			if (!lane) return;
			const bounds = renderer.domElement.getBoundingClientRect();
			highlightLane(item.laneIndex);
			showHover({
				kind: 'lane',
				observerLabel: lane.label,
				detail: item.detail,
				stages: lane.stages,
				x: bounds.width / 2,
				y: bounds.height / 2,
				below: false,
			});
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			const items = keyboardItems();
			if (!items.length) return;
			if (shouldClearTransactionInspection(event.key, Boolean(hoverRef.current))) {
				event.preventDefault();
				clearHover();
				return;
			}
			let next = keyboardCursorRef.current;
			if (event.key === 'Home') next = 0;
			else if (event.key === 'End') next = items.length - 1;
			else if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (next + 1) % items.length;
			else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (next <= 0 ? items.length : next) - 1;
			else return;
			event.preventDefault();
			keyboardCursorRef.current = next;
			showKeyboardItem(items[next]);
		};
		let tapStart: { x: number; y: number } | undefined;
		const handlePointerDown = (event: PointerEvent) => {
			tapStart = { x: event.clientX, y: event.clientY };
		};
		const handlePointerUp = (event: PointerEvent) => {
			const started = tapStart;
			tapStart = undefined;
			if (!started || Math.hypot(event.clientX - started.x, event.clientY - started.y) > 8) return;
			renderer.domElement.focus({ preventScroll: true });
			processPointerMove(event.clientX, event.clientY);
		};
		const handleControlsStart = () => {
			controlsActive = true;
			clearHover();
		};
		const handleControlsEnd = () => {
			controlsActive = false;
		};
		controls.addEventListener('start', handleControlsStart);
		controls.addEventListener('end', handleControlsEnd);
		renderer.domElement.addEventListener('pointermove', handlePointerMove);
		renderer.domElement.addEventListener('pointerdown', handlePointerDown);
		renderer.domElement.addEventListener('pointerup', handlePointerUp);
		renderer.domElement.addEventListener('pointerleave', clearHover);
		renderer.domElement.addEventListener('keydown', handleKeyDown);

		let renderWidth = 0;
		let renderHeight = 0;
		const resize = () => {
			const bounds = mount.getBoundingClientRect();
			if (!bounds.width || !bounds.height) return;
			renderWidth = bounds.width;
			renderHeight = bounds.height;
			camera.aspect = bounds.width / bounds.height;
			camera.updateProjectionMatrix();
			renderer.setSize(bounds.width, bounds.height, false);
			wireStates.forEach((wire) => {
				wire.baseMaterial.resolution.set(bounds.width, bounds.height);
				wire.phaseMaterials.forEach((material) => material.resolution.set(bounds.width, bounds.height));
			});
		};
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(mount);
		resize();

		let frame = 0;
		let previousFrameAt = performance.now();
		let markerSignature = '';
		let markerDataSource: Infinity3DLane[] | undefined;
		let activityPhase = 0.08;
		let acceptedProofSignature = '';
		const acceptedProofProgress = new Map<string, number>();
		const miningParticleColor = new THREE.Color();
		const activeHeadColor = new THREE.Color();
		const phaseLabelPoints = Array.from({ length: phaseCount }, () => new THREE.Vector3());
		const acceptedProofPinPoint = new THREE.Vector3();
		const render = () => {
			frame = window.requestAnimationFrame(render);
			const frameAt = performance.now();
			if (!activeRef.current || document.hidden) {
				previousFrameAt = frameAt;
				return;
			}
			if (resumeSyncRef.current) {
				wireStates.forEach((wire) => {
					const lane = laneDataRef.current[wire.laneIndex];
					if (lane) snapWireProgress(wire, lane, phaseCount);
				});
				resumeSyncRef.current = false;
			}
			const deltaSeconds = Math.min(0.05, Math.max(0, (frameAt - previousFrameAt) / 1_000));
			previousFrameAt = frameAt;
			wireStates.forEach((wire) => {
				const lane = laneDataRef.current[wire.laneIndex];
				if (lane) updateWireProgress(wire, lane, deltaSeconds, phaseCount);
			});
			activityPhase = updateMiningParticles(
				wireStates,
				miningParticleGeometry,
				miningActivityRef.current?.candidateRate,
				deltaSeconds,
				activityPhase,
				miningParticleColor
			);
			updateActiveHeads(wireStates, laneDataRef.current, activeHeadGeometry, phaseCount, activeHeadColor);
			const acceptedProofs = miningActivityRef.current?.acceptedProofs ?? [];
			const nextAcceptedProofSignature = acceptedProofs
				.map(
					(proof) =>
						`${proof.key}:${proof.meta}:${proof.recalls
							.map(
								(recall) => `${recall.key}:${recall.content?.contentUrl}:${recall.content?.contentType}`
							)
							.join(',')}`
				)
				.join('|');
			if (acceptedProofSignature !== nextAcceptedProofSignature) {
				acceptedProofSignature = nextAcceptedProofSignature;
				const activeProofKeys = new Set(acceptedProofs.map((proof) => proof.key));
				for (const proofKey of acceptedProofProgress.keys()) {
					if (!activeProofKeys.has(proofKey)) acceptedProofProgress.delete(proofKey);
				}
				for (const proof of acceptedProofs) {
					if (!acceptedProofProgress.has(proof.key)) {
						acceptedProofProgress.set(proof.key, medianWireProgress(wireStates));
					}
				}
				updateAcceptedProofMarkers(
					wireStates,
					acceptedProofs,
					acceptedProofProgress,
					acceptedProofGeometry,
					phaseCount
				);
			}
			if (markerDataSource !== laneDataRef.current) {
				markerDataSource = laneDataRef.current;
				const nextMarkerSignature = markerDataSignature(markerDataSource);
				if (markerSignature !== nextMarkerSignature) {
					markerSignature = nextMarkerSignature;
					const markerHoverData = updateMarkers(
						wireStates,
						markerDataSource,
						eventGeometry,
						confirmationGeometry,
						proofGeometry,
						phaseCount
					);
					eventHoverDataRef.current = markerHoverData.events;
					confirmationHoverDataRef.current = markerHoverData.confirmations;
					proofHoverDataRef.current = markerHoverData.proofs;
				}
			}
			controls.update();
			group.updateWorldMatrix(true, false);
			camera.updateWorldMatrix(true, false);
			updateAcceptedProofPins(
				acceptedProofs,
				acceptedProofProgress,
				acceptedProofPinRefs.current,
				wireStates[0],
				group,
				camera,
				renderWidth,
				renderHeight,
				acceptedProofPinPoint
			);
			phaseLabelRefs.current.forEach((element, phaseIndex) => {
				updateSegmentLabel(
					element,
					wireStates,
					highlightedLaneRef.current,
					((phaseIndex + 0.5) / phaseCount) * SAMPLE_COUNT,
					group,
					camera,
					renderWidth,
					renderHeight,
					phaseLabelPoints[phaseIndex]
				);
			});
			renderer.render(scene, camera);
		};
		frame = window.requestAnimationFrame(render);

		return () => {
			window.cancelAnimationFrame(frame);
			if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
			resizeObserver.disconnect();
			controls.removeEventListener('start', handleControlsStart);
			controls.removeEventListener('end', handleControlsEnd);
			renderer.domElement.removeEventListener('pointermove', handlePointerMove);
			renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
			renderer.domElement.removeEventListener('pointerup', handlePointerUp);
			renderer.domElement.removeEventListener('pointerleave', clearHover);
			renderer.domElement.removeEventListener('keydown', handleKeyDown);
			controls.dispose();
			wireStates.forEach(({ baseGeometry, phaseGeometries, baseMaterial, phaseMaterials }) => {
				baseGeometry.dispose();
				phaseGeometries.forEach((geometry) => geometry.dispose());
				baseMaterial.dispose();
				phaseMaterials.forEach((material) => material.dispose());
			});
			pickLines.forEach((pickLine) => pickLine.geometry.dispose());
			pickLineMaterial.dispose();
			eventGeometry.dispose();
			confirmationGeometry.dispose();
			proofGeometry.dispose();
			activeHeadGeometry.dispose();
			acceptedProofGeometry.dispose();
			miningParticleGeometry.dispose();
			eventHaloMaterial.dispose();
			eventMaterial.dispose();
			confirmationHaloMaterial.dispose();
			confirmationMaterial.dispose();
			proofHaloMaterial.dispose();
			proofMaterial.dispose();
			activeHeadMaterial.dispose();
			acceptedProofHaloMaterial.dispose();
			acceptedProofMaterial.dispose();
			miningParticleMaterial.dispose();
			dotTexture.dispose();
			renderer.dispose();
			renderer.domElement.remove();
			wireStatesRef.current = [];
			markerGeometryRef.current = undefined;
			highlightedLaneRef.current = undefined;
			hoverRef.current = undefined;
			eventHoverDataRef.current = [];
			confirmationHoverDataRef.current = [];
			proofHoverDataRef.current = [];
		};
	}, [ariaLabel, lanes.length, layout, phaseLabelKey]);

	const laneHover = hover;

	return (
		<Stage>
			<CanvasMount ref={mountRef} />
			{rendererUnavailable ? <TransactionRendererFallback lanes={lanes} /> : null}
			{laneHover &&
				phaseLabels.map((phaseLabel, phaseIndex) => {
					const stage = laneHover.stages[phaseIndex];
					return (
						<PhaseLabel
							key={`${phaseIndex}:${phaseLabel}`}
							ref={(element) => {
								phaseLabelRefs.current[phaseIndex] = element;
							}}
						>
							{stage?.label ?? phaseLabel}{' '}
							<strong>
								{stage?.count ?? 0}/{stage?.target ?? 0}
							</strong>
						</PhaseLabel>
					);
				})}
			{shouldRenderProofPins(rendererUnavailable) ? (
				<AcceptedProofPins>
					{acceptedProofs.map((proof) => (
						<AcceptedProofPin
							key={proof.key}
							ref={(element) => {
								if (element) acceptedProofPinRefs.current.set(proof.key, element);
								else acceptedProofPinRefs.current.delete(proof.key);
							}}
							data-block-height={proof.height}
						>
							<AcceptedProofStem />
							<AcceptedProofCard>
								<AcceptedProofLabel>{proof.label}</AcceptedProofLabel>
								<AcceptedProofMeta>{proof.meta}</AcceptedProofMeta>
								<AcceptedProofPayloads>
									{proof.recalls.slice(0, 2).map((recall) => (
										<AcceptedProofPayload
											key={recall.key}
											as={recall.content?.kind === 'binary' ? 'span' : 'a'}
											href={
												recall.content?.kind === 'binary'
													? undefined
													: recall.content?.contentUrl
											}
											target={recall.content?.kind === 'binary' ? undefined : '_blank'}
											rel={recall.content?.kind === 'binary' ? undefined : 'noreferrer'}
											aria-label={`${proof.label}: ${recall.contentLabel}`}
										>
											<RecallContentPreview content={recall.content} fallback={recall.fallback} />
											<AcceptedProofContentType>
												{recall.contentLabel}
												{recall.content?.kind !== 'binary' && recall.content?.contentUrl
													? ' ↗'
													: ''}
											</AcceptedProofContentType>
											{recall.meta && (
												<AcceptedProofRecallMeta>{recall.meta}</AcceptedProofRecallMeta>
											)}
										</AcceptedProofPayload>
									))}
								</AcceptedProofPayloads>
							</AcceptedProofCard>
						</AcceptedProofPin>
					))}
				</AcceptedProofPins>
			) : null}
			{hover && (
				<RaceTooltipContainer
					aria-live="polite"
					id={tooltipId}
					ref={tooltipRef}
					$left={hover.x}
					$top={hover.y}
					$below={hover.below}
					role={'tooltip'}
				>
					<ObserverTooltipCard
						observerLabel={hover.observerLabel}
						stages={hover.stages}
						detail={hover.detail}
					/>
				</RaceTooltipContainer>
			)}
		</Stage>
	);
}

function RecallContentPreview({ content, fallback }: { content?: ArweaveRecallContent; fallback: string }) {
	if (!content) return <AcceptedProofPayloadText>{fallback}</AcceptedProofPayloadText>;
	const title = content.contentType ?? fallback;
	if (canPreviewRecallImage(content)) {
		return <img src={content.contentUrl} alt={title} loading={'lazy'} />;
	}
	if (content.kind === 'image' && content.contentLength === undefined) {
		return <BoundedRecallImagePreview content={content} title={title} />;
	}
	return (
		<AcceptedProofPayloadText>
			{content.metadata?.length ? content.metadata.join(' · ') : contentSymbol(content.kind)}
		</AcceptedProofPayloadText>
	);
}

function BoundedRecallImagePreview({ content, title }: { content: ArweaveRecallContent; title: string }) {
	const [imageUrl, setImageUrl] = React.useState<string>();

	React.useEffect(() => {
		const controller = new AbortController();
		let objectUrl: string | undefined;
		setImageUrl(undefined);
		void fetchBoundedRecallImage(content, controller.signal)
			.then((image) => {
				if (!image || controller.signal.aborted) return;
				objectUrl = URL.createObjectURL(image);
				setImageUrl(objectUrl);
			})
			.catch(() => undefined);
		return () => {
			controller.abort();
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [content]);

	return imageUrl ? (
		<img src={imageUrl} alt={title} />
	) : (
		<AcceptedProofPayloadText aria-label={'Loading image preview'}>Image</AcceptedProofPayloadText>
	);
}

function contentSymbol(kind: ArweaveRecallContentKind): string {
	if (kind === 'audio') return '♪';
	if (kind === 'video') return '▶';
	if (kind === 'html') return '</>';
	if (kind === 'pdf') return 'PDF';
	if (kind === 'json') return '{}';
	if (kind === 'text') return 'Aa';
	return '◫';
}

export function CableTelemetryPanel({ telemetry }: { telemetry: CableTelemetry }) {
	return (
		<ProtocolTelemetry aria-label={`${telemetry.heading}. ${telemetry.liveLabel}`}>
			<ProtocolTelemetryHeading>
				<ProtocolTelemetryPulse />
				<span>{telemetry.heading}</span>
				<ProtocolTelemetryLive>{telemetry.liveLabel}</ProtocolTelemetryLive>
			</ProtocolTelemetryHeading>
			<ProtocolSummary>
				<ProtocolSummarySection>
					<ProtocolActivityHeading>{telemetry.mining.heading}</ProtocolActivityHeading>
					<ProtocolMetricGrid>
						{telemetry.mining.metrics.map((metric) => (
							<ProtocolMetric key={metric.label}>
								<span>{metric.label}</span>
								<strong>{metric.value}</strong>
							</ProtocolMetric>
						))}
					</ProtocolMetricGrid>
					<MiningStatus>{telemetry.mining.status}</MiningStatus>
				</ProtocolSummarySection>
				<ProtocolSummarySection>
					<ProtocolActivityHeading>{telemetry.liveLabel}</ProtocolActivityHeading>
					<ProtocolMetricGrid>
						{telemetry.metrics.map((metric) => (
							<ProtocolMetric key={metric.label}>
								<span>{metric.label}</span>
								<strong>{metric.value}</strong>
							</ProtocolMetric>
						))}
					</ProtocolMetricGrid>
				</ProtocolSummarySection>
			</ProtocolSummary>
			<ProtocolActivityHeading>{telemetry.activityLabel}</ProtocolActivityHeading>
			<ActivityRolodex activity={telemetry.activity} />
		</ProtocolTelemetry>
	);
}

const ACTIVITY_STREAM_INTERVAL_MS = 360;
const ACTIVITY_VISIBLE_ROWS = 5;
const MAX_ACTIVITY_QUEUE = 80;
const MAX_SEEN_ACTIVITY = 500;

function ActivityRolodex({ activity }: { activity: CableTelemetry['activity'] }) {
	const [visible, setVisible] = React.useState<CableTelemetry['activity']>([]);
	const queueRef = React.useRef<CableTelemetry['activity']>([]);
	const seenRef = React.useRef(new Set<string>());
	const seenOrderRef = React.useRef<string[]>([]);

	React.useEffect(() => {
		if (!activity.length) {
			queueRef.current = [];
			seenRef.current.clear();
			seenOrderRef.current = [];
			setVisible([]);
			return;
		}

		const additions = activity.filter((event) => !seenRef.current.has(event.key)).reverse();
		if (!additions.length) return;

		for (const event of additions) {
			seenRef.current.add(event.key);
			seenOrderRef.current.push(event.key);
		}
		queueRef.current.push(...additions);
		queueRef.current = queueRef.current.slice(-MAX_ACTIVITY_QUEUE);

		while (seenOrderRef.current.length > MAX_SEEN_ACTIVITY) {
			const expired = seenOrderRef.current.shift();
			if (expired) seenRef.current.delete(expired);
		}
	}, [activity]);

	React.useEffect(() => {
		const timer = window.setInterval(() => {
			const next = queueRef.current.shift();
			if (!next) return;
			setVisible((current) =>
				[next, ...current.filter((event) => event.key !== next.key)].slice(0, ACTIVITY_VISIBLE_ROWS)
			);
		}, ACTIVITY_STREAM_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, []);

	return (
		<ProtocolActivity>
			{visible.map((event) => (
				<ProtocolActivityRow key={event.key}>
					<ActivityKind $kind={event.kind}>{event.typeLabel}</ActivityKind>
					<strong>{event.label}</strong>
					<span>{event.detail}</span>
				</ProtocolActivityRow>
			))}
		</ProtocolActivity>
	);
}

function createWirePositions(laneIndex: number, laneCount: number, layout: NonNullable<Props['layout']>): Float32Array {
	if (layout === 'bundle') return createStandaloneCablePositions(laneIndex, laneCount);
	const positions = new Float32Array(SAMPLE_COUNT * 3);
	const laneOffset = laneCount <= 1 ? 0 : (laneIndex / (laneCount - 1) - 0.5) * 3.5;
	for (let index = 0; index < SAMPLE_COUNT; index += 1) {
		const t = (index / SAMPLE_COUNT) * Math.PI * 2;
		const x = 5.8 * Math.sin(t);
		const y = 2.7 * Math.sin(2 * t);
		const dx = 5.8 * Math.cos(t);
		const dy = 5.4 * Math.cos(2 * t);
		const length = Math.hypot(dx, dy) || 1;
		const normalX = -dy / length;
		const normalY = dx / length;
		positions[index * 3] = x + normalX * laneOffset;
		positions[index * 3 + 1] = y + normalY * laneOffset;
		positions[index * 3 + 2] = 0.52 * Math.cos(t) + laneOffset * 0.1;
	}
	return positions;
}

function decimateWire(positions: Float32Array): Float32Array {
	const pointCount = Math.ceil(SAMPLE_COUNT / PICK_SAMPLE_STEP);
	const decimated = new Float32Array(pointCount * 3);
	for (
		let pointIndex = 0, sourceIndex = 0;
		pointIndex < pointCount;
		pointIndex += 1, sourceIndex += PICK_SAMPLE_STEP
	) {
		const sourceOffset = (sourceIndex % SAMPLE_COUNT) * 3;
		const targetOffset = pointIndex * 3;
		decimated[targetOffset] = positions[sourceOffset];
		decimated[targetOffset + 1] = positions[sourceOffset + 1];
		decimated[targetOffset + 2] = positions[sourceOffset + 2];
	}
	return decimated;
}

function sameHoverContent(current: Hover | undefined, next: Hover): boolean {
	return Boolean(
		current &&
			current.below === next.below &&
			current.observerLabel === next.observerLabel &&
			current.detail === next.detail &&
			current.stages === next.stages
	);
}

function createStandaloneCablePositions(laneIndex: number, laneCount: number): Float32Array {
	const positions = new Float32Array(SAMPLE_COUNT * 3);
	const goldenAngle = Math.PI * (3 - Math.sqrt(5));
	const cableRadius = laneCount <= 1 ? 0 : 1.42 * Math.sqrt((laneIndex + 0.5) / laneCount);
	const cableAngle = laneIndex * goldenAngle;

	for (let index = 0; index < SAMPLE_COUNT; index += 1) {
		const t = (index / SAMPLE_COUNT) * Math.PI * 2;
		const centerX = 5.55 * Math.sin(t);
		const centerY = 2.45 * Math.sin(2 * t);
		const centerZ = 0.58 * Math.cos(t);
		const dx = 5.55 * Math.cos(t);
		const dy = 4.9 * Math.cos(2 * t);
		const dz = -0.58 * Math.sin(t);
		const tangentLength = Math.hypot(dx, dy, dz) || 1;
		const tangentX = dx / tangentLength;
		const tangentY = dy / tangentLength;
		const tangentZ = dz / tangentLength;
		const planarLength = Math.hypot(tangentX, tangentY) || 1;
		const normalX = -tangentY / planarLength;
		const normalY = tangentX / planarLength;
		const binormalX = -tangentZ * normalY;
		const binormalY = tangentZ * normalX;
		const binormalZ = tangentX * normalY - tangentY * normalX;
		const crossSectionX = Math.cos(cableAngle) * cableRadius;
		const crossSectionY = Math.sin(cableAngle) * cableRadius;

		positions[index * 3] = centerX + normalX * crossSectionX + binormalX * crossSectionY;
		positions[index * 3 + 1] = centerY + normalY * crossSectionX + binormalY * crossSectionY;
		positions[index * 3 + 2] = centerZ + binormalZ * crossSectionY;
	}

	return positions;
}

function updateSegmentLabel(
	element: HTMLSpanElement | null,
	wires: WireState[],
	laneIndex: number | undefined,
	pointIndex: number,
	group: THREE.Group,
	camera: THREE.Camera,
	width: number,
	height: number,
	point: THREE.Vector3
): void {
	if (!element || laneIndex === undefined || wires.length === 0 || !width || !height) return;
	const wire = wires[laneIndex];
	if (!wire) return;
	const offset = Math.round(pointIndex) * 3;
	point.set(wire.positions[offset], wire.positions[offset + 1], wire.positions[offset + 2]);
	group.localToWorld(point);
	point.project(camera);
	element.style.setProperty('--phase-label-x', `${(point.x * 0.5 + 0.5) * width}px`);
	element.style.setProperty('--phase-label-y', `${(-point.y * 0.5 + 0.5) * height}px`);
	const opacity = point.z >= -1 && point.z <= 1 ? '1' : '0';
	if (element.style.opacity !== opacity) element.style.opacity = opacity;
}

function closedLinePositions(positions: Float32Array): Float32Array {
	const closed = new Float32Array((SAMPLE_COUNT + 1) * 3);
	closed.set(positions);
	closed.set(positions.subarray(0, 3), SAMPLE_COUNT * 3);
	return closed;
}

function phaseLinePositions(positions: Float32Array, startIndex: number, endIndex: number): Float32Array {
	const phasePositions = new Float32Array((endIndex - startIndex + 1) * 3);
	for (let index = startIndex; index <= endIndex; index += 1) {
		const sourceIndex = (index % SAMPLE_COUNT) * 3;
		const targetIndex = (index - startIndex) * 3;
		phasePositions[targetIndex] = positions[sourceIndex];
		phasePositions[targetIndex + 1] = positions[sourceIndex + 1];
		phasePositions[targetIndex + 2] = positions[sourceIndex + 2];
	}
	return phasePositions;
}

function createProgressColors(startIndex: number, endIndex: number): Float32Array {
	const colors = new Float32Array((endIndex - startIndex + 1) * 3);
	const color = new THREE.Color();
	for (let index = startIndex; index <= endIndex; index += 1) {
		progressColor(((index - startIndex) / (endIndex - startIndex)) * 100, color);
		const targetIndex = (index - startIndex) * 3;
		colors[targetIndex] = color.r;
		colors[targetIndex + 1] = color.g;
		colors[targetIndex + 2] = color.b;
	}
	return colors;
}

function updateWireProgress(wire: WireState, lane: Infinity3DLane, deltaSeconds: number, phaseCount: number): void {
	wire.phaseGeometries.forEach((geometry, phaseIndex) => {
		const { start: phaseStart, end: phaseEnd } = sequencePhaseBounds(phaseIndex, phaseCount);
		wire.displayedPhaseProgress[phaseIndex] = updatePhaseProgress(
			geometry,
			wire.displayedPhaseProgress[phaseIndex] ?? phaseStart,
			lane.phases[phaseIndex]?.progress ?? phaseStart,
			phaseStart,
			phaseEnd,
			deltaSeconds
		);
	});
}

function snapWireProgress(wire: WireState, lane: Infinity3DLane, phaseCount: number): void {
	wire.phaseGeometries.forEach((geometry, phaseIndex) => {
		const { start: phaseStart, end: phaseEnd } = sequencePhaseBounds(phaseIndex, phaseCount);
		const nextProgress = retainedPhaseProgress(
			wire.displayedPhaseProgress[phaseIndex] ?? phaseStart,
			lane.phases[phaseIndex]?.progress ?? phaseStart,
			phaseStart,
			phaseEnd
		);
		wire.displayedPhaseProgress[phaseIndex] = nextProgress;
		setPhaseInstanceCount(geometry, nextProgress, phaseStart, phaseEnd);
	});
}

export function retainedPhaseProgress(
	displayedProgress: number,
	liveProgress: number,
	phaseStart: number,
	phaseEnd: number
): number {
	return Math.max(displayedProgress, Math.min(phaseEnd, Math.max(phaseStart, liveProgress)));
}

function updatePhaseProgress(
	geometry: LineGeometry,
	displayedProgress: number,
	progress: number,
	phaseStart: number,
	phaseEnd: number,
	deltaSeconds: number
): number {
	const target = retainedPhaseProgress(displayedProgress, progress, phaseStart, phaseEnd);
	const smoothing = 1 - Math.exp(-deltaSeconds * 11);
	let nextProgress = displayedProgress + (target - displayedProgress) * smoothing;
	if (target - nextProgress < 0.002) nextProgress = target;
	setPhaseInstanceCount(geometry, nextProgress, phaseStart, phaseEnd);
	return nextProgress;
}

function setPhaseInstanceCount(geometry: LineGeometry, progress: number, phaseStart: number, phaseEnd: number): void {
	const segmentCount = Math.round(((phaseEnd - phaseStart) / 100) * SAMPLE_COUNT);
	const instanceCount = Math.max(
		1,
		Math.min(segmentCount, Math.ceil(((progress - phaseStart) / (phaseEnd - phaseStart)) * segmentCount))
	);
	if (geometry.instanceCount !== instanceCount) geometry.instanceCount = instanceCount;
}

function updateMarkers(
	wires: WireState[],
	lanes: Infinity3DLane[],
	eventGeometry: THREE.BufferGeometry,
	confirmationGeometry: THREE.BufferGeometry,
	proofGeometry: THREE.BufferGeometry,
	phaseCount: number
): { events: MarkerHoverData[]; confirmations: MarkerHoverData[]; proofs: MarkerHoverData[] } {
	const eventPositions: number[] = [];
	const eventColors: number[] = [];
	const eventHoverData: MarkerHoverData[] = [];
	const confirmationPositions: number[] = [];
	const confirmationColors: number[] = [];
	const confirmationHoverData: MarkerHoverData[] = [];
	const proofPositions: number[] = [];
	const proofColors: number[] = [];
	const proofHoverData: MarkerHoverData[] = [];
	wires.forEach((wire, laneIndex) => {
		const lane = lanes[laneIndex];
		if (!lane) return;
		for (const marker of lane.markers) {
			const pointIndex = Math.min(
				SAMPLE_COUNT - 1,
				Math.max(0, Math.round((marker.progress / 100) * (SAMPLE_COUNT - 1)))
			);
			const offset = pointIndex * 3;
			if (marker.kind === 'proof') {
				proofPositions.push(wire.positions[offset], wire.positions[offset + 1], wire.positions[offset + 2]);
				const color = markerColor(marker, phaseCount);
				proofColors.push(color.r, color.g, color.b);
				proofHoverData.push({ laneIndex, detail: marker.detail });
				continue;
			}
			const confirmation = marker.confirmation;
			const positions = confirmation ? confirmationPositions : eventPositions;
			const colors = confirmation ? confirmationColors : eventColors;
			const hoverData = confirmation ? confirmationHoverData : eventHoverData;
			positions.push(wire.positions[offset], wire.positions[offset + 1], wire.positions[offset + 2]);
			const color = markerColor(marker, phaseCount);
			colors.push(color.r, color.g, color.b);
			hoverData.push({ laneIndex, detail: marker.detail });
		}
	});
	updateMarkerGeometry(eventGeometry, eventPositions, eventColors);
	updateMarkerGeometry(confirmationGeometry, confirmationPositions, confirmationColors);
	updateMarkerGeometry(proofGeometry, proofPositions, proofColors);
	return { events: eventHoverData, confirmations: confirmationHoverData, proofs: proofHoverData };
}

function updateActiveHeads(
	wires: WireState[],
	lanes: Infinity3DLane[],
	geometry: THREE.BufferGeometry,
	phaseCount: number,
	color: THREE.Color
): void {
	const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
	const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;
	const positions = positionAttribute.array as Float32Array;
	const colors = colorAttribute.array as Float32Array;
	let activeCount = 0;
	const writeHead = (wire: WireState, progress: number) => {
		const offset = activeCount * 3;
		writeWirePoint(wire.positions, progress, positions, offset);
		phaseProgressColor(progress, phaseCount, color);
		colors[offset] = color.r;
		colors[offset + 1] = color.g;
		colors[offset + 2] = color.b;
		activeCount += 1;
	};
	wires.forEach((wire, laneIndex) => {
		const lane = lanes[laneIndex];
		if (!lane) return;
		lane.phases.forEach((phase, phaseIndex) => {
			if (phase.started && !phase.complete) {
				writeHead(
					wire,
					wire.displayedPhaseProgress[phaseIndex] ?? sequencePhaseBounds(phaseIndex, phaseCount).start
				);
			}
		});
	});
	positionAttribute.needsUpdate = true;
	colorAttribute.needsUpdate = true;
	geometry.setDrawRange(0, activeCount);
}

function updateMiningParticles(
	wires: WireState[],
	geometry: THREE.BufferGeometry,
	candidateRate: number | undefined,
	deltaSeconds: number,
	phase: number,
	color: THREE.Color
): number {
	if (!candidateRate || !wires.length) {
		geometry.setDrawRange(0, 0);
		return phase;
	}
	const density = THREE.MathUtils.clamp(Math.log10(candidateRate + 1) / 5, 0.08, 1);
	const activeCount = Math.min(MAX_MINING_PARTICLES, Math.max(14, Math.round(18 + density * 162)));
	const nextPhase = (phase + deltaSeconds * (0.035 + density * 0.035)) % 1;
	const positions = (geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
	const colors = (geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
	for (let index = 0; index < activeCount; index += 1) {
		const wire = wires[(index * 13) % wires.length];
		const particlePhase = (nextPhase + index / activeCount + ((index * 37) % 19) / 1900) % 1;
		writeWirePoint(wire.positions, particlePhase * 100, positions, index * 3);
		progressColor(particlePhase * 100, color).lerp(PARTICLE_HIGHLIGHT, 0.18);
		colors[index * 3] = color.r;
		colors[index * 3 + 1] = color.g;
		colors[index * 3 + 2] = color.b;
	}
	(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
	(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
	geometry.setDrawRange(0, activeCount);
	return nextPhase;
}

function updateAcceptedProofMarkers(
	wires: WireState[],
	proofs: NonNullable<Props['miningActivity']>['acceptedProofs'],
	progressByKey: Map<string, number>,
	geometry: THREE.BufferGeometry,
	phaseCount: number
): void {
	const positions: number[] = [];
	const colors: number[] = [];
	if (!wires.length) {
		updateMarkerGeometry(geometry, positions, colors);
		return;
	}
	const wire = wires[0];
	for (const proof of proofs) {
		const progress = progressByKey.get(proof.key) ?? 0;
		const color = phaseProgressColor(progress, phaseCount);
		const targetOffset = positions.length;
		positions.push(0, 0, 0);
		writeWirePoint(wire.positions, progress, positions, targetOffset);
		colors.push(color.r, color.g, color.b);
	}
	updateMarkerGeometry(geometry, positions, colors);
}

function updateAcceptedProofPins(
	proofs: NonNullable<Props['miningActivity']>['acceptedProofs'],
	progressByKey: Map<string, number>,
	elements: Map<string, HTMLSpanElement>,
	wire: WireState | undefined,
	group: THREE.Group,
	camera: THREE.Camera,
	width: number,
	height: number,
	point: THREE.Vector3
): void {
	if (!wire || !width || !height) return;
	const coordinates = new Float32Array(3);
	const now = Date.now();
	proofs.forEach((proof, index) => {
		const element = elements.get(proof.key);
		if (!element) return;
		writeWirePoint(wire.positions, progressByKey.get(proof.key) ?? 0, coordinates, 0);
		point.set(coordinates[0], coordinates[1], coordinates[2]);
		group.localToWorld(point);
		point.project(camera);
		const anchorX = (point.x * 0.5 + 0.5) * width;
		const anchorY = (-point.y * 0.5 + 0.5) * height;
		const compact = width <= 480;
		const cardWidth = Math.min(
			compact ? ACCEPTED_PROOF_CARD_COMPACT_WIDTH : ACCEPTED_PROOF_CARD_WIDTH,
			Math.max(1, width - 8)
		);
		const cardHeight = Math.min(
			compact ? ACCEPTED_PROOF_CARD_COMPACT_HEIGHT : ACCEPTED_PROOF_CARD_HEIGHT,
			Math.max(1, height - 8)
		);
		const { x: cardX, y: cardY } = acceptedProofCardPosition(
			index,
			proofs.length,
			anchorX,
			anchorY,
			width,
			height,
			cardWidth,
			cardHeight
		);
		const connector = connectorEndpoint(anchorX, anchorY, cardX, cardY, cardWidth, cardHeight);
		const deltaX = connector.x - anchorX;
		const deltaY = connector.y - anchorY;
		element.style.setProperty('--proof-pin-x', `${anchorX}px`);
		element.style.setProperty('--proof-pin-y', `${anchorY}px`);
		element.style.setProperty('--proof-card-width', `${cardWidth}px`);
		element.style.setProperty('--proof-card-height', `${cardHeight}px`);
		element.style.setProperty('--proof-card-x', `${cardX - anchorX}px`);
		element.style.setProperty('--proof-card-y', `${cardY - anchorY}px`);
		element.style.setProperty('--proof-stem-length', `${Math.hypot(deltaX, deltaY)}px`);
		element.style.setProperty('--proof-stem-angle', `${Math.atan2(deltaY, deltaX)}rad`);
		element.style.opacity =
			point.z >= -1 && point.z <= 1 ? String(acceptedProofAnnotationOpacity(proof.observedAt, now)) : '0';
	});
}

export function acceptedProofCardPosition(
	index: number,
	proofCount: number,
	anchorX: number,
	anchorY: number,
	width: number,
	height: number,
	cardWidth: number,
	cardHeight: number
): { x: number; y: number } {
	const edge = 4;
	const gap = 12;
	const maxX = Math.max(edge, width - cardWidth - edge);
	const maxY = Math.max(edge, height - cardHeight - edge);
	const roomOnRight = width - anchorX;
	const roomOnLeft = anchorX;
	const placeOnRight = roomOnRight >= cardWidth + gap + edge || roomOnRight >= roomOnLeft;
	const nearVerticalCenter = Math.abs(anchorY - height / 2) < cardHeight / 2 + gap;
	const placeBelow = nearVerticalCenter && proofCount > 1 ? index % 2 === 0 : anchorY < height / 2;

	return {
		x: Math.min(maxX, Math.max(edge, placeOnRight ? anchorX + gap : anchorX - cardWidth - gap)),
		y: Math.min(maxY, Math.max(edge, placeBelow ? anchorY + gap : anchorY - cardHeight - gap)),
	};
}

export function connectorEndpoint(
	anchorX: number,
	anchorY: number,
	cardX: number,
	cardY: number,
	cardWidth: number,
	cardHeight: number
): { x: number; y: number } {
	const centerX = cardX + cardWidth / 2;
	const centerY = cardY + cardHeight / 2;
	const towardAnchorX = anchorX - centerX;
	const towardAnchorY = anchorY - centerY;
	const scaleX = towardAnchorX === 0 ? Number.POSITIVE_INFINITY : cardWidth / 2 / Math.abs(towardAnchorX);
	const scaleY = towardAnchorY === 0 ? Number.POSITIVE_INFINITY : cardHeight / 2 / Math.abs(towardAnchorY);
	const scale = Math.min(1, scaleX, scaleY);
	return {
		x: centerX + towardAnchorX * scale,
		y: centerY + towardAnchorY * scale,
	};
}

function medianWireProgress(wires: WireState[]): number {
	if (!wires.length) return 0;
	const progress = wires.map((wire) => Math.max(...wire.displayedPhaseProgress)).sort((left, right) => left - right);
	const middle = Math.floor(progress.length / 2);
	return progress.length % 2 ? progress[middle] : (progress[middle - 1] + progress[middle]) / 2;
}

function writeWirePoint(
	wirePositions: Float32Array,
	progress: number,
	target: Float32Array | number[],
	targetOffset: number
): void {
	const scaledIndex = ((progress % 100) / 100) * SAMPLE_COUNT;
	const lowerIndex = Math.min(SAMPLE_COUNT - 1, Math.max(0, Math.floor(scaledIndex)));
	const upperIndex = (lowerIndex + 1) % SAMPLE_COUNT;
	const mix = scaledIndex - Math.floor(scaledIndex);
	const lowerOffset = lowerIndex * 3;
	const upperOffset = upperIndex * 3;
	target[targetOffset] = THREE.MathUtils.lerp(wirePositions[lowerOffset], wirePositions[upperOffset], mix);
	target[targetOffset + 1] = THREE.MathUtils.lerp(
		wirePositions[lowerOffset + 1],
		wirePositions[upperOffset + 1],
		mix
	);
	target[targetOffset + 2] = THREE.MathUtils.lerp(
		wirePositions[lowerOffset + 2],
		wirePositions[upperOffset + 2],
		mix
	);
}

function updateMarkerGeometry(geometry: THREE.BufferGeometry, positions: number[], colors: number[]): void {
	updateGeometryAttribute(geometry, 'position', positions);
	updateGeometryAttribute(geometry, 'color', colors);
	if (positions.length) geometry.computeBoundingSphere();
}

function markerDataSignature(lanes: Infinity3DLane[]): string {
	return lanes
		.map((lane) =>
			lane.markers
				.map(
					(marker) =>
						`${marker.kind}:${marker.confirmation}:${marker.progress}:${marker.state}:${marker.confirmations}:${marker.error}:${marker.detail}`
				)
				.join(',')
		)
		.join('|');
}

function markerColor(marker: Infinity3DLane['markers'][number], phaseCount: number): THREE.Color {
	return phaseProgressColor(marker.progress, phaseCount);
}

function createDotTexture(): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext('2d');
	if (context) {
		context.clearRect(0, 0, 64, 64);
		context.fillStyle = '#ffffff';
		context.beginPath();
		context.arc(32, 32, 29, 0, Math.PI * 2);
		context.fill();
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function updateGeometryAttribute(geometry: THREE.BufferGeometry, name: string, values: number[]): void {
	const current = geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
	if (current?.array.length === values.length) {
		(current.array as Float32Array).set(values);
		current.needsUpdate = true;
		return;
	}
	geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
}

function progressColor(progress: number, target = new THREE.Color()): THREE.Color {
	const { r, g, b } = progressColorRgb(progress);
	return target.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function phaseProgressColor(progress: number, phaseCount: number, target = new THREE.Color()): THREE.Color {
	const safePhaseCount = Math.max(1, phaseCount);
	const phaseSize = sequencePhaseBounds(0, safePhaseCount).end;
	const phaseIndex = Math.min(safePhaseCount - 1, Math.floor(Math.max(0, progress) / phaseSize));
	const phaseProgress = ((progress - phaseIndex * phaseSize) / phaseSize) * 100;
	return progressColor(phaseProgress, target);
}

const Stage = styled.div`
	position: absolute;
	inset: 0;
	overflow: hidden;
	border-radius: 24px;
	background: radial-gradient(circle at 50% 42%, rgba(0, 143, 32, 0.035), transparent 58%);
`;

const CanvasMount = styled.div`
	position: absolute;
	inset: 0;
	cursor: grab;

	&:active {
		cursor: grabbing;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
`;

const AcceptedProofPins = styled.span`
	position: absolute;
	inset: 0;
	z-index: 300;
	pointer-events: none;
`;

const acceptedProofConnectorEnter = keyframes`
	from {
		opacity: 0;
		transform: rotate(var(--proof-stem-angle, 0)) scaleX(0);
	}
	to {
		opacity: 1;
		transform: rotate(var(--proof-stem-angle, 0)) scaleX(1);
	}
`;

const acceptedProofCardEnter = keyframes`
	from { opacity: 0; }
	to { opacity: 1; }
`;

const AcceptedProofPin = styled.span`
	position: absolute;
	top: 0;
	left: 0;
	z-index: 3;
	width: 0;
	height: 0;
	opacity: 0;
	transform: translate3d(var(--proof-pin-x, 0), var(--proof-pin-y, 0), 0);
	will-change: transform;
	pointer-events: none;
`;

const AcceptedProofStem = styled.span`
	position: absolute;
	top: -0.5px;
	left: 0;
	width: var(--proof-stem-length, 0);
	height: 1px;
	transform: rotate(var(--proof-stem-angle, 0)) scaleX(1);
	transform-origin: 0 50%;
	background: color-mix(in srgb, ${(props) => props.theme.colors.font.alt1} 48%, transparent);
	animation: ${acceptedProofConnectorEnter} 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
	pointer-events: none;

	@media (prefers-reduced-motion: reduce) {
		animation: none;
	}
`;

const AcceptedProofCard = styled.span`
	position: absolute;
	display: grid;
	box-sizing: border-box;
	width: var(--proof-card-width, ${ACCEPTED_PROOF_CARD_WIDTH}px);
	height: var(--proof-card-height, ${ACCEPTED_PROOF_CARD_HEIGHT}px);
	padding: 8px;
	grid-template-rows: auto auto minmax(0, 1fr);
	gap: 5px;
	transform: translate3d(var(--proof-card-x, 0), var(--proof-card-y, 0), 0);
	overflow: hidden;
	background: color-mix(in srgb, ${(props) => props.theme.colors.container.primary.background} 98%, transparent);
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 10px;
	box-shadow: 0 10px 28px rgba(28, 25, 22, 0.14);
	animation: ${acceptedProofCardEnter} 360ms ease-out both;
	pointer-events: auto;

	@media (prefers-reduced-motion: reduce) {
		animation: none;
	}

	@media (max-width: 480px) {
		width: var(--proof-card-width, ${ACCEPTED_PROOF_CARD_COMPACT_WIDTH}px);
		height: var(--proof-card-height, ${ACCEPTED_PROOF_CARD_COMPACT_HEIGHT}px);
		padding: 6px;
		gap: 4px;
		border-radius: 8px;
	}
`;

const AcceptedProofLabel = styled.span`
	overflow: hidden;
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.body};
	font-variant-numeric: tabular-nums;
	font-weight: ${(props) => props.theme.typography.weight.regular};
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;

	@media (max-width: 480px) {
		font-size: ${(props) => props.theme.typography.size.body};
	}
`;

const AcceptedProofMeta = styled.span`
	overflow: hidden;
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.small};
	font-variant-numeric: tabular-nums;
	line-height: 1.15;
	text-overflow: ellipsis;
	white-space: nowrap;

	@media (max-width: 480px) {
		font-size: ${(props) => props.theme.typography.size.small};
	}
`;

const AcceptedProofPayloads = styled.span`
	display: grid;
	grid-auto-flow: column;
	grid-auto-columns: minmax(0, 1fr);
	min-width: 0;
	min-height: 0;
	gap: 6px;
`;

const AcceptedProofPayload = styled.a`
	display: grid;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	background: color-mix(in srgb, ${(props) => props.theme.colors.font.primary} 6%, transparent);
	border: 1px solid color-mix(in srgb, ${(props) => props.theme.colors.border.alt1} 60%, transparent);
	border-radius: 6px;
	color: ${(props) => props.theme.colors.font.primary};
	text-decoration: none;
	position: relative;

	img {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
		pointer-events: none;
	}
`;

const AcceptedProofPayloadText = styled.span`
	display: block;
	box-sizing: border-box;
	align-self: center;
	width: 100%;
	padding: 17px 6px 15px;
	overflow: hidden;
	color: ${(props) => props.theme.colors.font.alt1};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;

	@media (max-width: 480px) {
		padding: 15px 4px 13px;
		font-size: ${(props) => props.theme.typography.size.small};
	}
`;

const AcceptedProofContentType = styled.span`
	position: absolute;
	right: 2px;
	bottom: 2px;
	left: 2px;
	padding: 3px 4px;
	overflow: hidden;
	background: color-mix(in srgb, ${(props) => props.theme.colors.container.primary.background} 90%, transparent);
	border-radius: 4px;
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.regular};
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;

	@media (max-width: 480px) {
		font-size: ${(props) => props.theme.typography.size.small};
	}
`;

const AcceptedProofRecallMeta = styled.span`
	position: absolute;
	top: 2px;
	right: 4px;
	left: 4px;
	overflow: hidden;
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.small};
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const proofPulse = keyframes`
	0%, 100% { opacity: 0.34; transform: scale(0.82); }
	50% { opacity: 1; transform: scale(1); }
`;

const activityEnter = keyframes`
	from { opacity: 0; transform: translateY(-8px); }
	to { opacity: 1; transform: translateY(0); }
`;

const ProtocolTelemetry = styled.div`
	position: relative;
	z-index: 2;
	container-type: inline-size;
	display: grid;
	box-sizing: border-box;
	width: 100%;
	gap: 8px;
	margin: 10px 0 0;
	padding: 12px 14px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 10px;
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	font-variant-numeric: tabular-nums;
	line-height: 1.3;
`;

const ProtocolTelemetryHeading = styled.span`
	display: flex;
	align-items: center;
	gap: 6px;
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: inherit;
	font-weight: ${(props) => props.theme.typography.weight.regular};
`;

const ProtocolTelemetryPulse = styled.span`
	flex: 0 0 auto;
	width: 6px;
	height: 6px;
	background: ${(props) => props.theme.colors.nasaGraphic.green1};
	border-radius: 50%;
	box-shadow: 0 0 0 3px color-mix(in srgb, ${(props) => props.theme.colors.nasaGraphic.green1} 16%, transparent);
	animation: ${proofPulse} 1.15s ease-in-out infinite;
`;

const ProtocolTelemetryLive = styled.span`
	margin-left: auto;
	color: ${(props) => props.theme.colors.nasaGraphic.green1};
	font-size: inherit;
`;

const ProtocolMetricGrid = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 5px;
`;

const ProtocolSummary = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
	align-items: start;
	gap: 14px 24px;
`;

const ProtocolSummarySection = styled.span`
	display: grid;
	gap: 6px;
	min-width: 0;
`;

const ProtocolMetric = styled.span`
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: baseline;
	gap: 12px;
	min-width: 0;
	font-size: inherit;

	strong {
		justify-self: end;
		font-size: inherit;
		font-weight: ${(props) => props.theme.typography.weight.regular};
		text-align: right;
		white-space: nowrap;
	}

	span {
		min-width: 0;
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: inherit;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
`;

const MiningStatus = styled.span`
	padding-bottom: 4px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: inherit;
`;

const ProtocolActivityHeading = styled.span`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: inherit;
	font-weight: ${(props) => props.theme.typography.weight.regular};
`;

const ProtocolActivity = styled.span`
	display: grid;
	gap: 4px;
	min-height: 108px;
	font-size: inherit;
`;

const ProtocolActivityRow = styled.span`
	display: grid;
	grid-template-columns: 80px minmax(90px, 0.55fr) minmax(0, 1.8fr);
	align-items: center;
	gap: 7px;
	min-width: 0;
	animation: ${activityEnter} 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	font-size: inherit;

	strong,
	span {
		overflow: hidden;
		font-size: inherit;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-weight: ${(props) => props.theme.typography.weight.regular};
	}

	span {
		color: ${(props) => props.theme.colors.font.alt1};
	}

	@container (max-width: 420px) {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 4px 8px;

		> span:last-child {
			grid-column: 1 / -1;
		}
	}
`;

const ActivityKind = styled.span<{ $kind: CableTelemetry['activity'][number]['kind'] }>`
	justify-self: start;
	box-sizing: border-box;
	max-width: 100%;
	padding: 2px 6px;
	background: ${(props) =>
		props.$kind === 'proof'
			? 'color-mix(in srgb, #a76b00 12%, transparent)'
			: props.$kind === 'error'
			? 'color-mix(in srgb, #b42318 10%, transparent)'
			: `color-mix(in srgb, ${props.theme.colors.nasaGraphic.green1} 10%, transparent)`};
	border: 1px solid
		${(props) =>
			props.$kind === 'proof'
				? 'color-mix(in srgb, #a76b00 38%, transparent)'
				: props.$kind === 'error'
				? 'color-mix(in srgb, #b42318 35%, transparent)'
				: `color-mix(in srgb, ${props.theme.colors.nasaGraphic.green1} 38%, transparent)`};
	border-radius: 999px;
	color: ${(props) =>
		props.$kind === 'proof'
			? '#8b5900'
			: props.$kind === 'error'
			? '#9f1d14'
			: props.theme.colors.nasaGraphic.green1} !important;
	font-size: inherit;
	line-height: 1.15;
`;

const PhaseLabel = styled.span`
	position: absolute;
	top: 0;
	left: 0;
	z-index: 4;
	padding: 5px 9px;
	transform: translate3d(var(--phase-label-x, 0), var(--phase-label-y, 0), 0) translate(-50%, calc(-100% - 14px));
	will-change: transform;
	background: color-mix(in srgb, ${(props) => props.theme.colors.container.primary.background} 94%, transparent);
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 999px;
	box-shadow: 0 5px 18px rgba(0, 0, 0, 0.08);
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.small};
	line-height: 1;
	white-space: nowrap;
	pointer-events: none;

	strong {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: inherit;
		font-weight: ${(props) => props.theme.typography.weight.regular};
	}

	&::after {
		position: absolute;
		bottom: -10px;
		left: 50%;
		width: 1px;
		height: 10px;
		background: ${(props) => props.theme.colors.border.alt1};
		content: '';
	}
`;
