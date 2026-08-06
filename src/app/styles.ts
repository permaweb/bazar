import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    font-family: ${(props) => props.theme.typography.family.primary};
    color: ${(props) => props.theme.colors.font.primary};
    background: ${(props) => props.theme.colors.container.primary.background};
    color-scheme: ${(props) => props.theme.scheme};
    font-synthesis: none;

    --max-view-width: 1440px;
    --page-gutter: clamp(14px, 2vw, 20px);
    --page-block-spacing: clamp(38px, 5vw, 72px);
    --page-footer-spacing: clamp(48px, 6vw, 80px);
    --asset-grid-gap: clamp(12px, 1.5vw, 20px);
    --type-small: ${(props) => props.theme.typography.size.small};
    --type-body: ${(props) => props.theme.typography.size.body};
    --type-display: ${(props) => props.theme.typography.size.display};

    --ink: ${(props) => props.theme.colors.font.primary};
    --muted: ${(props) => props.theme.colors.font.alt1};
    --muted-subtle: ${(props) => props.theme.colors.global.mutedSubtle};
    --line: ${(props) => props.theme.colors.border.primary};
    --line-dark: ${(props) => props.theme.colors.border.alt1};
    --paper: ${(props) => props.theme.colors.container.primary.background};
    --panel: ${(props) => props.theme.colors.container.alt1.background};
    --surface: ${(props) => props.theme.colors.container.alt2.background};
    --accent: ${(props) => props.theme.colors.global.accent};
    --accent-dark: ${(props) => props.theme.colors.global.accentStrong};
    --button-accent: ${(props) => props.theme.colors.global.buttonBackground};
    --button-accent-hover: ${(props) => props.theme.colors.global.buttonHover};
    --surface-subtle: ${(props) => props.theme.colors.global.surfaceSubtle};
    --surface-hover: ${(props) => props.theme.colors.global.surfaceHover};
    --paper-translucent: ${(props) => props.theme.colors.global.paperTranslucent};
    --shadow-color: ${(props) => props.theme.colors.global.shadowMedium};
    --positive: ${(props) => props.theme.colors.indicator.primary};
    --positive-text: ${(props) => props.theme.colors.global.positiveText};
    --positive-surface: ${(props) => props.theme.colors.global.positiveSurface};
    --positive-border: ${(props) => props.theme.colors.global.positiveBorder};
    --negative: ${(props) => props.theme.colors.global.negative};
    --negative-surface: ${(props) => props.theme.colors.global.negativeSurface};
    --negative-border: ${(props) => props.theme.colors.global.negativeBorder};
    --warning-text: ${(props) => props.theme.colors.global.warningText};
    --warning-surface: ${(props) => props.theme.colors.global.warningSurface};
    --warning-border: ${(props) => props.theme.colors.global.warningBorder};
    --notice-text: ${(props) => props.theme.colors.global.noticeText};
    --notice-surface: ${(props) => props.theme.colors.global.noticeSurface};
    --event-purple: ${(props) => props.theme.colors.global.eventPurple};
    --event-purple-surface: ${(props) => props.theme.colors.global.eventPurpleSurface};
    --event-orange: ${(props) => props.theme.colors.global.eventOrange};
    --event-orange-surface: ${(props) => props.theme.colors.global.eventOrangeSurface};
    --event-blue: ${(props) => props.theme.colors.global.eventBlue};
    --event-blue-surface: ${(props) => props.theme.colors.global.eventBlueSurface};
    --event-pink: ${(props) => props.theme.colors.global.eventPink};
    --event-pink-surface: ${(props) => props.theme.colors.global.eventPinkSurface};
    --transparent: ${(props) => props.theme.colors.global.transparent};
    --contrast-text: ${(props) => props.theme.colors.global.contrastText};
    --fixed-ink: ${(props) => props.theme.colors.global.fixedInk};
    --coral: ${(props) => props.theme.colors.global.brandAccent};
    --brand-badge-background: ${(props) => props.theme.colors.global.brandBadgeBackground};
    --tooltip-border: ${(props) => props.theme.colors.global.tooltipBorder};
    --tooltip-background: ${(props) => props.theme.colors.global.tooltipBackground};
    --focus-ring: ${(props) => props.theme.colors.global.focusRing};
    --focus-soft: ${(props) => props.theme.colors.global.focusSoft};
    --focus-strong: ${(props) => props.theme.colors.global.focusStrong};
    --shadow-soft: ${(props) => props.theme.colors.global.shadowSoft};
    --shadow-menu: ${(props) => props.theme.colors.global.shadowMenu};
    --shadow-medium: ${(props) => props.theme.colors.global.shadowMedium};
    --shadow-strong: ${(props) => props.theme.colors.global.shadowStrong};
    --shadow-neutral: ${(props) => props.theme.colors.global.shadowNeutral};
    --shadow-floating: ${(props) => props.theme.colors.global.shadowFloating};
    --shadow-tiny: ${(props) => props.theme.colors.global.shadowTiny};
    --search-scrim: ${(props) => props.theme.colors.global.searchScrim};
    --dialog-scrim: ${(props) => props.theme.colors.global.dialogScrim};
    --dialog-scrim-clear: ${(props) => props.theme.colors.global.dialogScrimClear};
    --success-subtle-border: ${(props) => props.theme.colors.global.successSubtleBorder};
    --success-subtle-surface: ${(props) => props.theme.colors.global.successSubtleSurface};
    --negative-subtle-border: ${(props) => props.theme.colors.global.negativeSubtleBorder};
    --negative-subtle-surface: ${(props) => props.theme.colors.global.negativeSubtleSurface};
    --collection-dot: ${(props) => props.theme.colors.global.collectionDot};
    --name-dot: ${(props) => props.theme.colors.global.nameDot};
    --collection-tone-aqua: ${(props) => props.theme.colors.global.collectionToneAqua};
    --collection-tone-peach: ${(props) => props.theme.colors.global.collectionTonePeach};
    --image-glass-surface: ${(props) => props.theme.colors.global.imageGlassSurface};
    --image-control-border: ${(props) => props.theme.colors.global.imageControlBorder};
    --image-detail-border: ${(props) => props.theme.colors.global.imageDetailBorder};
    --image-control-surface: ${(props) => props.theme.colors.global.imageControlSurface};
    --image-overlay-surface: ${(props) => props.theme.colors.global.imageOverlaySurface};
    --preview-overlay: ${(props) => props.theme.colors.global.previewOverlay};
    --listed-dot: ${(props) => props.theme.colors.global.listedDot};
    --stale-dot: ${(props) => props.theme.colors.global.staleDot};
    --resolution-warning: ${(props) => props.theme.colors.global.resolutionWarning};
    --sequence-success: ${(props) => props.theme.colors.global.sequenceSuccess};
    --sequence-warning: ${(props) => props.theme.colors.global.sequenceWarning};
    --sequence-warning-shadow: ${(props) => props.theme.colors.global.sequenceWarningShadow};
    --tab-inset: ${(props) => props.theme.colors.global.tabInset};
    --gradient-coral: ${(props) => props.theme.colors.global.gradientCoral};
    --gradient-coral-soft: ${(props) => props.theme.colors.global.gradientCoralSoft};
    --gradient-coral-strong: ${(props) => props.theme.colors.global.gradientCoralStrong};
    --gradient-purple: ${(props) => props.theme.colors.global.gradientPurple};
    --gradient-blue: ${(props) => props.theme.colors.global.gradientBlue};
    --gradient-blue-soft: ${(props) => props.theme.colors.global.gradientBlueSoft};
    --ghost-glow: ${(props) => props.theme.colors.global.ghostGlow};
    --home-fade-strong: ${(props) => props.theme.colors.global.homeFadeStrong};
    --home-fade-soft: ${(props) => props.theme.colors.global.homeFadeSoft};
  }

  * {
    box-sizing: border-box;
    font-weight: ${(props) => props.theme.typography.weight.regular};
  }

  html {
    min-width: 320px;
    background: ${(props) => props.theme.colors.container.primary.background};
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    min-height: 100dvh;
    background: ${(props) => props.theme.colors.container.primary.background};
    color: ${(props) => props.theme.colors.font.primary};
    font-size: ${(props) => props.theme.typography.size.body};
    -webkit-font-smoothing: antialiased;
  }

  #root {
    width: min(1600px, 100%);
    min-height: 100vh;
    min-height: 100dvh;
    margin: 0 auto;
  }
`;
