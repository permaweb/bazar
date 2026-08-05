import type { DefaultTheme } from 'styled-components';

export const theme: DefaultTheme = {
  colors: {
    border: { primary: '#f0f0f0', alt1: '#d4d4d4' },
    container: {
      primary: { background: '#ffffff' },
      alt1: { background: '#fafafa' },
      alt2: { background: '#f0f0f0' },
    },
    font: { primary: '#1c1916', alt1: '#5c554d' },
    indicator: { primary: '#13ab8f' },
    nasaGraphic: { green1: '#13ab8f' },
    stats: { alt7: '#d97706', alt8: '#eeca00', alt10: '#13ab8f' },
    status: { draft: '#756e65' },
    warning: { primary: '#c94b62' },
  },
  typography: {
    family: { primary: '"DM Sans", ui-sans-serif, system-ui, sans-serif' },
    weight: { regular: 400 },
    size: { display: '1.875rem', body: '0.8125rem', small: '0.6875rem' },
  },
};
