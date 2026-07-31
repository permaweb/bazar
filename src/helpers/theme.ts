import type { DefaultTheme } from 'styled-components';

export const theme: DefaultTheme = {
	colors: {
		border: { primary: '#1d1b17', alt1: '#d9d2c5' },
		container: {
			primary: { background: '#fffdf8' },
			alt1: { background: '#f5f0e6' },
			alt2: { background: '#ebe4d8' },
		},
		font: { primary: '#171510', alt1: '#6f685d' },
		indicator: { primary: '#ff5a1f' },
		nasaGraphic: { green1: '#00a66a' },
		stats: { alt7: '#ff8b45', alt8: '#ffbd46', alt10: '#18b976' },
		status: { draft: '#8d8171' },
		warning: { primary: '#d94718' },
	},
	typography: {
		family: { primary: 'Inter, ui-sans-serif, system-ui, sans-serif' },
		weight: { medium: 600 },
		size: { lg: '1.15rem', small: '.88rem', xxSmall: '.72rem', xxxxSmall: '.62rem' },
	},
};
