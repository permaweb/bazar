import styled, { type DefaultTheme, keyframes } from 'styled-components';
import type { ObserverView } from 'weave-wrangler';

import { confirmationTrustTone } from './confirmationTrust';
import { PROGRESS_GRADIENT, confirmationProgress, progressColorCss } from './progressColors';

const sweepProgress = keyframes`
	0% { transform: translateX(-100%); }
	100% { transform: translateX(100%); }
`;

const activeTipPulse = keyframes`
	0%, 100% { opacity: 0.38; }
	50% { opacity: 1; }
`;

type LaneTrustProps = {
  $state: ObserverView['state'];
  $confirmations: number;
  $hasError: boolean;
};

type RaceTrustProps = LaneTrustProps & {
  $phaseComplete: boolean;
};

function laneTrustColor(props: LaneTrustProps & { theme: DefaultTheme }): string {
  switch (confirmationTrustTone(props.$state, props.$confirmations, props.$hasError)) {
    case 'error':
      return props.theme.colors.warning.primary;
    case 'pending':
      return `color-mix(in srgb, ${props.theme.colors.status.draft} 62%, ${props.theme.colors.container.primary.background})`;
    case 'confirmation-1':
      return progressColorCss(confirmationProgress(1, 5));
    case 'confirmation-2':
      return progressColorCss(confirmationProgress(2, 5));
    case 'confirmation-3':
      return progressColorCss(confirmationProgress(3, 5));
    case 'confirmation-4':
      return progressColorCss(confirmationProgress(4, 5));
    case 'confirmation-5':
      return progressColorCss(confirmationProgress(5, 5));
    case 'neutral':
    default:
      return `color-mix(in srgb, ${props.theme.colors.status.draft} 28%, ${props.theme.colors.container.primary.background})`;
  }
}

function completedLaneTrustColor(props: RaceTrustProps & { theme: DefaultTheme }): string {
  return laneTrustColor(props);
}

export const Wrapper = styled.div`
  padding: 6px 24px 26px;
  color: ${(props) => props.theme.colors.font.primary};
  font-size: ${(props) => props.theme.typography.size.xxSmall};
  font-family: ${(props) => props.theme.typography.family.primary};
`;

export const Stepper = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 8px 0 26px;
`;

export const Step = styled.div<{ $state: 'done' | 'active' | 'next' }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  text-align: center;
  opacity: ${(props) => (props.$state === 'next' ? 0.42 : 1)};

  &::before {
    content: '';
    position: absolute;
    top: 17px;
    right: 50%;
    width: 100%;
    height: 1px;
    background: ${(props) => props.theme.colors.border.primary};
    z-index: 0;
  }

  &:first-child::before {
    display: none;
  }

  span {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid ${(props) => props.theme.colors.border.primary};
    background: ${(props) =>
      props.$state === 'active'
        ? props.theme.colors.container.alt2.background
        : props.theme.colors.container.primary.background};
    color: ${(props) => props.theme.colors.font.primary};
    font-size: ${(props) => props.theme.typography.size.xxSmall};

    > div,
    svg {
      display: block;
      width: 18px;
      height: 18px;
    }
  }

  p {
    margin: 0;
    font-size: ${(props) => props.theme.typography.size.xxSmall};
    line-height: 1.25;
  }
`;

export const StatusCard = styled.div`
  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: ${(props) => props.theme.typography.size.small};
    font-weight: ${(props) => props.theme.typography.weight.medium};
  }

  p {
    margin-top: 5px;
    color: ${(props) => props.theme.colors.font.alt1};
    font-size: ${(props) => props.theme.typography.size.xxSmall};
    line-height: 1.45;
  }
`;

export const CostCard = styled.div`
  margin-top: 18px;
  padding: 16px;
  border: 1px solid ${(props) => props.theme.colors.border.primary};
  border-radius: 6px;
  background: ${(props) => props.theme.colors.container.alt1.background};

  h4 {
    margin: 0 0 12px;
    font-size: ${(props) => props.theme.typography.size.small};
    font-weight: ${(props) => props.theme.typography.weight.medium};
  }

  > small {
    display: block;
    margin-top: 10px;
    color: ${(props) => props.theme.colors.font.alt1};
    font-size: ${(props) => props.theme.typography.size.xxxxSmall};
    line-height: 1.45;
  }
`;

export const CostSummary = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
  padding: 12px 16px;
  border: 1px solid ${(props) => props.theme.colors.border.primary};
  border-radius: 6px;
  background: ${(props) => props.theme.colors.container.alt1.background};
  font-size: ${(props) => props.theme.typography.size.small};

  strong {
    font-weight: ${(props) => props.theme.typography.weight.medium};
  }
`;

export const CostRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 5px 0;
  color: ${(props) => props.theme.colors.font.alt1};
  font-size: ${(props) => props.theme.typography.size.xxSmall};

  strong {
    color: ${(props) => props.theme.colors.font.primary};
    font-weight: ${(props) => props.theme.typography.weight.medium};
  }
`;

export const CostTotal = styled(CostRow)`
  margin-top: 7px;
  padding-top: 12px;
  border-top: 1px solid ${(props) => props.theme.colors.border.primary};
  font-size: ${(props) => props.theme.typography.size.small};
`;

export const TransactionHeader = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-top: 22px;

  > div:first-child {
    min-width: 0;
    display: grid;
    gap: 3px;
    color: ${(props) => props.theme.colors.font.alt1};
    font-size: ${(props) => props.theme.typography.size.xxSmall};

    > strong {
      color: ${(props) => props.theme.colors.font.primary};
      font-weight: ${(props) => props.theme.typography.weight.medium};
    }

    > span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
`;

export const Depth = styled.div<{ $success: boolean }>`
  flex: 0 0 auto;
  color: ${(props) => (props.$success ? props.theme.colors.indicator.primary : props.theme.colors.font.primary)};

  strong {
    font-size: ${(props) => props.theme.typography.size.small};
  }

  span {
    color: ${(props) => props.theme.colors.font.alt1};
    font-size: ${(props) => props.theme.typography.size.xxSmall};
  }
`;

export const ProgressTrack = styled.div<{ $active: boolean; $progress: number } & LaneTrustProps>`
  position: relative;
  z-index: 2;
  height: 16px;
  margin: 9px 0 5px;
  overflow: hidden;
  border-radius: 999px;
  background: ${(props) => props.theme.colors.border.primary};
  box-shadow: ${(props) => (props.$active ? `0 0 0 1px ${props.theme.colors.border.alt1}` : 'none')};

  span {
    position: relative;
    display: block;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
    background: ${(props) => (props.$hasError ? props.theme.colors.warning.primary : PROGRESS_GRADIENT)};
    background-size: ${(props) => `${10000 / Math.max(1, props.$progress)}% 100%`};
    transition: width 420ms ease;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent,
        ${(props) => props.theme.colors.container.primary.background},
        transparent
      );
      opacity: ${(props) => (props.$active ? 0.7 : 0)};
      animation: ${(props) => (props.$active ? sweepProgress : 'none')} 1.05s ease-in-out infinite;
    }
  }
`;

export const RiskNote = styled.p`
  position: relative;
  z-index: 2;
  margin: 7px 0 0;
  color: #525252;
  font-size: ${(props) => props.theme.typography.size.xxSmall};
`;

export const RaceShell = styled.div<{ $height: number; $embedded: boolean }>`
  position: relative;
  z-index: 0;
  display: grid;
  place-items: center;
  width: ${(props) =>
    props.$embedded ? '100%' : 'calc(100% + var(--dialog-gutter, 48px) + var(--dialog-gutter, 48px))'};
  height: auto;
  aspect-ratio: 700 / 320;
  margin: ${(props) => (props.$embedded ? '0 auto' : '-90px var(--dialog-gutter-negative, -48px) -16px')};
  transition: width 240ms ease;

  @media (max-width: 680px) {
    margin: ${(props) => (props.$embedded ? '0 auto' : '-48px var(--dialog-gutter-negative, -24px) -10px')};
  }
`;

export const RaceTrack = styled.svg`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
`;

export const RaceLane = styled.rect<{ $laneWidth: number }>`
  fill: none;
  stroke: ${(props) => props.theme.colors.border.primary};
  stroke-width: ${(props) => props.$laneWidth};
`;

export const RaceSegment = styled.rect<{ $laneWidth: number } & RaceTrustProps>`
  fill: none;
  stroke: ${completedLaneTrustColor};
  stroke-width: ${(props) => props.$laneWidth};
  stroke-linecap: round;
  pointer-events: none;
  transition:
    stroke-dasharray 160ms linear,
    stroke-dashoffset 160ms linear;
`;

export const RaceActiveTip = styled.circle<RaceTrustProps>`
  fill: ${completedLaneTrustColor};
  stroke: ${(props) => props.theme.colors.container.primary.background};
  stroke-width: 1px;
  pointer-events: none;
  transition:
    cx 160ms linear,
    cy 160ms linear;
  animation: ${activeTipPulse} 1.4s ease-in-out infinite;
`;

export const RaceEventMarker = styled.circle<RaceTrustProps & { $confirmation: boolean }>`
  fill: ${(props) =>
    props.$state === 'not-found' ? props.theme.colors.container.primary.background : completedLaneTrustColor(props)};
  stroke: ${(props) =>
    props.$state === 'not-found' ? completedLaneTrustColor(props) : props.theme.colors.container.primary.background};
  stroke-width: ${(props) =>
    props.$confirmation ? '2px' : props.$state === 'not-found' || props.$state === 'pending' ? '1.75px' : '1.25px'};
  cursor: help;
  transition: r 160ms ease;
`;

export const RaceEventHit = styled.circle`
  fill: transparent;
  pointer-events: all;
  cursor: help;
`;

export const RaceHitArea = styled.rect<{ $hitWidth: number; $active: boolean }>`
  fill: none;
  stroke: ${(props) => props.theme.colors.font.primary};
  stroke-width: ${(props) => props.$hitWidth};
  opacity: ${(props) => (props.$active ? 0.18 : 0)};
  pointer-events: stroke;
  cursor: help;
  transition: opacity 120ms ease;
`;

export const LaneNumber = styled.text<{ $dense: boolean }>`
  fill: ${(props) => props.theme.colors.font.alt1};
  font-size: ${(props) => (props.$dense ? '7px' : '8px')};
  font-family: ${(props) => props.theme.typography.family.primary};
`;

export const StartLine = styled.line`
  stroke: ${(props) => props.theme.colors.font.primary};
  stroke-width: 1.25px;
  stroke-dasharray: 2 2;
`;

export const PaymentStartLine = styled(StartLine)`
  stroke: ${(props) => props.theme.colors.font.alt1};
  stroke-dasharray: 3 2;
`;

export const PhaseLabelBackground = styled.rect`
  fill: ${(props) => props.theme.colors.container.primary.background};
  stroke: ${(props) => props.theme.colors.border.primary};
  stroke-width: 0.75px;
`;

export const PhaseLabel = styled.text`
  fill: ${(props) => props.theme.colors.font.alt1};
  font-family: ${(props) => props.theme.typography.family.primary};
  font-size: 9px;
  font-weight: ${(props) => props.theme.typography.weight.medium};
`;

export const RaceInfield = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: min(62%, 520px);
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;

  strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${(props) => props.theme.typography.size.lg};
    font-weight: ${(props) => props.theme.typography.weight.medium};
    white-space: nowrap;
  }
`;

export const RaceTooltip = styled.span<{
  $left: number;
  $top: number;
  $below: boolean;
}>`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 200;
  display: grid;
  min-width: min(260px, calc(100% - 24px));
  max-width: min(340px, calc(100% - 24px));
  gap: 8px;
  padding: 11px 12px;
  transform: translate3d(
      var(--race-tooltip-x, ${(props) => props.$left}px),
      var(--race-tooltip-y, ${(props) => props.$top}px),
      0
    )
    ${(props) => (props.$below ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))')};
  will-change: transform;
  background: ${(props) => props.theme.colors.container.primary.background};
  border: 1px solid ${(props) => props.theme.colors.border.alt1};
  border-radius: 10px;
  box-shadow: 0 14px 36px rgba(28, 25, 22, 0.1);
  color: ${(props) => props.theme.colors.font.primary};
  font-family: ${(props) => props.theme.typography.family.primary};
  font-size: ${(props) => props.theme.typography.size.xxxxSmall};
  line-height: 1.35;
  text-align: left;
  white-space: normal;
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    width: 7px;
    height: 7px;
    transform: translateX(-50%) rotate(45deg);
    background: ${(props) => props.theme.colors.container.primary.background};
    border: solid ${(props) => props.theme.colors.border.alt1};
    border-width: ${(props) => (props.$below ? '1px 0 0 1px' : '0 1px 1px 0')};
    ${(props) => (props.$below ? 'top: -5px;' : 'bottom: -5px;')}
  }
`;

export const RaceTooltipObserver = styled.strong`
  overflow: hidden;
  color: ${(props) => props.theme.colors.font.primary};
  font-size: ${(props) => props.theme.typography.size.xxSmall};
  font-weight: ${(props) => props.theme.typography.weight.medium};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const RaceTooltipStages = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const RaceTooltipStage = styled.span`
  display: grid;
  grid-template-columns: 8px auto auto;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  background: ${(props) => props.theme.colors.container.alt1.background};
  border: 1px solid ${(props) => props.theme.colors.border.primary};
  border-radius: 5px;
  color: ${(props) => props.theme.colors.font.primary};
  white-space: nowrap;

  strong {
    color: ${(props) => props.theme.colors.font.primary};
    font-weight: ${(props) => props.theme.typography.weight.medium};
  }
`;

export const RaceTooltipStageDot = styled.i<LaneTrustProps>`
  display: block;
  width: 8px;
  height: 8px;
  background: ${laneTrustColor};
  border: 1px solid rgba(0, 0, 0, 0.22);
  border-radius: 50%;
`;

export const RaceTooltipDetail = styled.span`
  color: ${(props) => props.theme.colors.font.alt1};
  font-size: 10px;
`;

export const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 16px;
  padding: 13px;
  border: 1px solid ${(props) => props.theme.colors.warning.primary};
  border-radius: 10px;
  background: color-mix(in srgb, ${(props) => props.theme.colors.warning.primary} 6%, white);
  color: ${(props) => props.theme.colors.warning.primary};
  font-size: ${(props) => props.theme.typography.size.xxSmall};
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
`;
