import { DefaultTheme } from 'styled-components';

export const lightTheme = {
	accent1: '#454FA8',
	accent2: '#7A81B8',
	negative1: '#DF4657',
	negative2: '#EF6C82',
	neutral1: '#FFFFFF',
	neutral2: '#F1F1F1',
	neutral3: '#8D8D8D',
	neutral4: '#C9C9C9',
	neutral5: '#CCCCCC',
	neutral6: '#F7F7F7',
	neutral7: '#FAFAFA',
	neutral8: '#B1B1B1',
	neutralA1: '#0A0A0A',
	neutralA2: '#5F5F5F',
	neutralA3: '#5C5C5C',
	neutralA4: '#4D4D4D',
	neutralA5: '#A4A4A4',
	neutralA6: '#A9A9A9',
	overlay1: 'rgb(130, 130, 130, .25)',
	primary1: '#FF7500',
	primary2: '#F57200',
	semiTransparent1: 'rgba(255, 255, 255, 0.575)',
	semiTransparent2: 'rgba(0, 0, 0, 0.45)',
	semiTransparent3: 'rgba(0, 0, 0, 0.65)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgba(0, 0, 0, 0.075)',
	scheme: 'light',
	light1: '#FFFFFF',
	dark1: '#151515',
	indicator1: '#26B426',
};

export const darkTheme = {
	accent1: '#454FA8',
	accent2: '#7A81B8',
	labelAlt1: `#FFFFFF`,
	negative1: '#DF4657',
	negative2: '#EF6C82',
	neutral1: '#131416',
	neutral2: '#1C1E21',
	neutral3: '#606060',
	neutral4: '#5C5C5C',
	neutral5: '#A4A4A4',
	neutral6: '#A9A9A9',
	neutral7: '#CCCCCC',
	neutral8: '#272727',
	neutralA1: '#FFFFFF',
	neutralA2: '#F1F1F1',
	neutralA3: '#E0E0E0',
	neutralA4: '#C9C9C9',
	neutralA5: '#F7F7F7',
	neutralA6: '#FAFAFA',
	overlay1: 'rgba(0, 0, 0, 0.5)',
	primary1: '#FF7500',
	primary2: '#F57200',
	semiTransparent1: 'rgba(0, 0, 0, 0.15)',
	semiTransparent2: 'rgba(0, 0, 0, 0.45)',
	semiTransparent3: 'rgba(0, 0, 0, 0.65)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgba(0, 0, 0, 0.5)',
	scheme: 'dark',
	light1: '#FFFFFF',
	dark1: '#151515',
	indicator1: '#12D912',
};

export const theme = (currentTheme: any): DefaultTheme => ({
	scheme: currentTheme.scheme,
	colors: {
		accordion: {
			background: currentTheme.neutral1,
			hover: currentTheme.neutral2,
			color: currentTheme.neutralA1,
		},
		border: {
			primary: currentTheme.neutral3,
			alt1: currentTheme.primary1,
			alt2: currentTheme.neutralA6,
			alt3: currentTheme.neutral5,
			alt4: currentTheme.neutral8,
		},
		button: {
			primary: {
				background: currentTheme.neutral2,
				border: currentTheme.neutral3,
				color: currentTheme.neutralA1,
				active: {
					background: currentTheme.accent1,
					border: currentTheme.accent2,
					color: currentTheme.light1,
				},
				disabled: {
					background: currentTheme.neutral3,
					border: currentTheme.neutral5,
					color: currentTheme.neutral5,
				},
			},
			alt1: {
				background: currentTheme.primary1,
				border: currentTheme.primary2,
				color: currentTheme.light1,
				active: {
					background: currentTheme.accent1,
					border: currentTheme.accent2,
					color: currentTheme.light1,
				},
				disabled: {
					background: currentTheme.neutral3,
					border: currentTheme.neutral5,
					color: currentTheme.neutral5,
				},
			},
			alt2: {
				background: currentTheme.neutralA1,
				border: currentTheme.neutralA1,
				color: currentTheme.neutralA1,
				active: {
					background: currentTheme.neutralA4,
					border: currentTheme.neutralA4,
					color: currentTheme.neutralA4,
				},
				disabled: {
					background: currentTheme.neutral3,
					border: currentTheme.neutral3,
					color: currentTheme.neutralA2,
				},
			},
		},
		checkbox: {
			active: {
				background: currentTheme.primary2,
			},
			background: currentTheme.neutral1,
			hover: currentTheme.neutral3,
			disabled: currentTheme.neutral5,
		},
		container: {
			primary: {
				background: currentTheme.neutral1,
				active: currentTheme.neutral2,
			},
			alt1: {
				background: currentTheme.neutral3,
			},
			alt2: {
				background: currentTheme.neutral2,
			},
			alt3: {
				background: currentTheme.neutral2,
			},
			alt4: {
				background: currentTheme.neutral2,
			},
			alt5: {
				background: currentTheme.neutralA4,
			},
			alt6: {
				background: currentTheme.primary1,
			},
			alt7: {
				background: currentTheme.neutralA3,
			},
			alt8: {
				background: currentTheme.dark1,
			},
			alt9: {
				background: currentTheme.indicator1,
			},
			alt10: {
				background: currentTheme.accent1,
			},
		},
		font: {
			primary: currentTheme.neutralA1,
			alt1: currentTheme.neutralA4,
			alt2: currentTheme.neutralA4,
			alt3: currentTheme.neutral5,
			alt4: currentTheme.neutral1,
			alt5: currentTheme.primary2,
			light1: currentTheme.light1,
		},
		form: {
			background: currentTheme.neutral1,
			border: currentTheme.neutral4,
			invalid: {
				outline: currentTheme.negative1,
				shadow: currentTheme.negative2,
			},
			valid: {
				outline: currentTheme.neutralA4,
				shadow: currentTheme.neutral3,
			},
			disabled: {
				background: currentTheme.neutral2,
				border: currentTheme.neutral5,
				label: currentTheme.neutralA2,
			},
		},
		gradient: {
			start: currentTheme.primary1,
			middle: currentTheme.accent1,
			end: currentTheme.accent2,
		},
		icon: {
			primary: {
				fill: currentTheme.neutralA1,
				active: currentTheme.neutral4,
				disabled: currentTheme.neutralA3,
			},
			alt1: {
				fill: currentTheme.neutral4,
				active: currentTheme.semiTransparent4,
				disabled: currentTheme.neutral3,
			},
			alt2: {
				fill: currentTheme.neutralA1,
				active: currentTheme.neutralA4,
				disabled: currentTheme.neutral3,
			},
			alt3: {
				fill: currentTheme.neutralA2,
				active: currentTheme.neutral1,
				disabled: currentTheme.neutral3,
			},
		},
		indicator: {
			active: currentTheme.primary2,
		},
		link: {
			color: currentTheme.neutralA1,
			active: currentTheme.neutralA4,
		},
		loader: {
			primary: currentTheme.primary2,
		},
		overlay: {
			primary: currentTheme.overlay1,
			alt1: currentTheme.semiTransparent2,
			alt2: currentTheme.semiTransparent3,
			alt3: currentTheme.semiTransparent1,
		},
		row: {
			active: {
				background: currentTheme.neutral3,
				border: currentTheme.neutral2,
			},
			hover: {
				background: currentTheme.neutral2,
			},
		},
		scrollbar: {
			track: currentTheme.neutral2,
			thumb: currentTheme.neutral3,
		},
		shadow: {
			primary: currentTheme.semiTransparent5,
			alt1: currentTheme.neutralA1,
		},
		tabs: {
			color: currentTheme.neutralA4,
			active: {
				background: currentTheme.accent1,
				color: currentTheme.neutralA1,
			},
		},
		view: {
			background: currentTheme.neutral1,
		},
		video: {
			buffered: currentTheme.neutral4,
			unbuffered: currentTheme.semiTransparent4,
			watched: currentTheme.primary1,
		},
		warning: currentTheme.negative1,
	},
	typography: {
		family: {
			primary: `'Inter', sans-serif`,
			alt1: `'Quantico', sans-serif`,
		},
		size: {
			xxxSmall: '12px',
			xxSmall: '13px',
			xSmall: '14px',
			small: '15px',
			base: '16px',
			lg: '18px',
			xLg: '24px',
			h1: 'clamp(38px, 4.5vw, 62px)',
			h2: 'clamp(32px, 3.75vw, 44px)',
			h4: 'clamp(24px, 1.75vw, 32px)',
		},
		weight: {
			medium: '500',
			bold: '600',
			xBold: '700',
			xxBold: '800',
		},
	},
});
