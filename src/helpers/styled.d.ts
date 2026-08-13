import 'styled-components';

declare module 'styled-components' {
	interface GlobalThemeColors {
		transparent: string;
		contrastText: string;
		fixedInk: string;
		brandAccent: string;
		brandBadgeBackground: string;
		tooltipBorder: string;
		tooltipBackground: string;
		mutedSubtle: string;
		accent: string;
		accentStrong: string;
		buttonBackground: string;
		buttonHover: string;
		surfaceSubtle: string;
		surfaceHover: string;
		paperTranslucent: string;
		positiveText: string;
		positiveSurface: string;
		positiveBorder: string;
		negative: string;
		negativeSurface: string;
		negativeBorder: string;
		warningText: string;
		warningSurface: string;
		warningBorder: string;
		retryIcon: string;
		noticeText: string;
		noticeSurface: string;
		eventPurple: string;
		eventPurpleSurface: string;
		eventOrange: string;
		eventOrangeSurface: string;
		eventBlue: string;
		eventBlueSurface: string;
		eventPink: string;
		eventPinkSurface: string;
		focusRing: string;
		focusSoft: string;
		focusStrong: string;
		shadowSoft: string;
		shadowMenu: string;
		shadowMedium: string;
		shadowStrong: string;
		shadowNeutral: string;
		shadowFloating: string;
		shadowTiny: string;
		searchScrim: string;
		dialogScrim: string;
		dialogScrimClear: string;
		successSubtleBorder: string;
		successSubtleSurface: string;
		negativeSubtleBorder: string;
		negativeSubtleSurface: string;
		collectionDot: string;
		nameDot: string;
		collectionToneAqua: string;
		collectionTonePeach: string;
		imageGlassSurface: string;
		imageControlBorder: string;
		imageDetailBorder: string;
		imageControlSurface: string;
		imageOverlaySurface: string;
		previewOverlay: string;
		listedDot: string;
		staleDot: string;
		resolutionWarning: string;
		sequenceSuccess: string;
		sequenceWarning: string;
		sequenceWarningShadow: string;
		tabInset: string;
		gradientCoral: string;
		gradientCoralSoft: string;
		gradientCoralStrong: string;
		gradientPurple: string;
		gradientBlue: string;
		gradientBlueSoft: string;
		ghostGlow: string;
		homeFadeStrong: string;
		homeFadeSoft: string;
	}

	export interface DefaultTheme {
		scheme: 'dark' | 'light';
		colors: {
			border: { primary: string; alt1: string };
			container: {
				primary: { background: string };
				alt1: { background: string };
				alt2: { background: string };
			};
			font: { primary: string; alt1: string };
			global: GlobalThemeColors;
			indicator: { primary: string };
			nasaGraphic: { green1: string };
			stats: { alt7: string; alt8: string; alt10: string };
			status: { draft: string };
			warning: { primary: string };
		};
		typography: {
			family: { primary: string };
			weight: { regular: number };
			size: { display: string; body: string; small: string };
		};
	}
}
