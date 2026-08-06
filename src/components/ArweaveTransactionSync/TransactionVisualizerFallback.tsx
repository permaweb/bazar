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

export function TransactionRendererFallback({ lanes }: { lanes: Infinity3DLane[] }) {
  return (
    <RendererFallback>
      <div className="renderer-fallback-announcement" aria-atomic="true" aria-live="polite" role="status">
        <strong>3D network view unavailable</strong>
        <span>Transaction tracking continues with live observer status.</span>
      </div>
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
  position: absolute;
  inset: 18px;
  z-index: 4;
  padding: 18px;
  display: grid;
  align-content: center;
  gap: 6px;
  overflow: auto;
  border: 1px solid ${(props) => props.theme.colors.border.primary};
  border-radius: 14px;
  background: color-mix(in srgb, ${(props) => props.theme.colors.container.primary.background} 94%, transparent);
  color: ${(props) => props.theme.colors.font.alt1};

  .renderer-fallback-announcement {
    display: grid;
    gap: 6px;
  }

  .renderer-fallback-announcement > strong {
    color: ${(props) => props.theme.colors.font.primary};
  }

  .renderer-fallback-announcement > span,
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
    inset: 10px;
    padding: 12px;

    ul {
      grid-template-columns: 1fr;
    }
  }
`;
