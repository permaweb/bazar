import { DefaultTheme } from 'styled-components';

export const lightTheme = {
	positive1: '#64B686',
	positive2: '#4EA673',
	indicatorNeutral1: '#F39D1F',
	negative1: '#E94278',
	negative2: '#E52461',
	neutral1: '#FFFFFF',
	neutral2: '#F4F4F4',
	neutral3: '#C6C6C6',
	neutral4: '#C9C9C9',
	neutral5: '#CCCCCC',
	neutral6: '#F7F7F7',
	neutral7: '#FAFAFA',
	neutral8: '#C8D4D4',
	neutralA1: '#0A0A0A',
	neutralA2: '#5F5F5F',
	neutralA3: '#5C5C5C',
	neutralA4: '#3E3E3E',
	neutralA5: '#A4A4A4',
	neutralA6: '#A9A9A9',
	neutralA7: '#C3C3C3',
	overlay1: 'rgb(130, 130, 130, .25)',
	primary1: '#F96E46',
	primary2: '#E6562C',
	semiTransparent1: 'rgba(255, 255, 255, 0.575)',
	semiTransparent2: 'rgba(0, 0, 0, 0.65)',
	semiTransparent3: 'rgba(0, 0, 0, 0.55)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgb(250, 250, 250, 0)',
	scheme: 'light',
	light1: '#FFFFFF',
	light2: '#DADADA',
	dark1: '#151515',
	stats: {
		primary: '#FF999A',
		alt1: '#C1E6EB',
		alt2: '#D9D8EF',
		alt3: '#A5CFE1',
		alt4: '#87D2F0',
		alt5: '#A09EEE',
		alt6: '#FFD9C5',
		alt7: '#C6E8EF',
		alt8: '#FBC5E5',
		alt9: '#88A9B9',
		alt10: '#DADADA',
	},
};

export const darkTheme = {
	positive1: '#38BD80',
	positive2: '#2F9D6A',
	indicatorNeutral1: '#F39D1F',
	labelAlt1: `#FFFFFF`,
	negative1: '#D81E5B',
	negative2: '#E43A72',
	neutral1: '#171717',
	neutral2: '#202020',
	neutral3: '#333333',
	neutral4: '#5C5C5C',
	neutral5: '#A4A4A4',
	neutral6: '#A9A9A9',
	neutral7: '#CCCCCC',
	neutral8: '#272727',
	neutralA1: '#FFFFFF',
	neutralA2: '#F1F1F1',
	neutralA3: '#E0E0E0',
	neutralA4: '#CECECE',
	neutralA5: '#F7F7F7',
	neutralA6: '#FAFAFA',
	neutralA7: '#101010',
	overlay1: 'rgba(0, 0, 0, 0.5)',
	primary1: '#F96E46',
	primary2: '#E6562C',
	semiTransparent1: 'rgba(0, 0, 0, 0.15)',
	semiTransparent2: 'rgba(0, 0, 0, 0.65)',
	semiTransparent3: 'rgba(20, 20, 20, 0.75)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgba(0, 0, 0, 0.5)',
	scheme: 'dark',
	light1: '#FFFFFF',
	light2: '#DADADA',
	dark1: '#151515',
	stats: {
		primary: '#FF8F90',
		alt1: '#9BD4E0',
		alt2: '#C2C1E6',
		alt3: '#7AB3D0',
		alt4: '#6AC3E7',
		alt5: '#A1A0E6',
		alt6: '#FFC1A1',
		alt7: '#A5E0E8',
		alt8: '#F29CC8',
		alt9: '#6794AA',
		alt10: '#444444',
	},
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
					background: currentTheme.primary1,
					border: currentTheme.primary2,
					color: currentTheme.light1,
				},
				disabled: {
					background: currentTheme.neutral4,
					border: currentTheme.neutral5,
					color: currentTheme.neutralA5,
				},
			},
			alt1: {
				background: currentTheme.primary1,
				border: currentTheme.primary2,
				color: currentTheme.light1,
				active: {
					background: currentTheme.primary2,
					border: currentTheme.primary2,
					color: currentTheme.light1,
				},
				disabled: {
					background: currentTheme.neutral4,
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
					background: currentTheme.neutral4,
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
				background: currentTheme.primary1,
			},
			alt10: {
				background: currentTheme.primary2,
			},
		},
		font: {
			primary: currentTheme.neutralA1,
			alt1: currentTheme.neutralA4,
			alt2: currentTheme.neutralA4,
			alt3: currentTheme.neutral5,
			alt4: currentTheme.neutral1,
			alt5: currentTheme.primary1,
			light1: currentTheme.light1,
			light2: currentTheme.light2,
			dark1: currentTheme.dark1,
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
			middle: currentTheme.primary1,
			end: currentTheme.primary2,
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
			active: currentTheme.positive1,
			neutral: currentTheme.indicatorNeutral1,
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
			alt1: currentTheme.neutral4,
			alt2: currentTheme.neutralA7,
		},
		stats: {
			primary: currentTheme.stats.primary,
			alt1: currentTheme.stats.alt1,
			alt2: currentTheme.stats.alt2,
			alt3: currentTheme.stats.alt3,
			alt4: currentTheme.stats.alt4,
			alt5: currentTheme.stats.alt5,
			alt6: currentTheme.stats.alt6,
			alt7: currentTheme.stats.alt7,
			alt8: currentTheme.stats.alt8,
			alt9: currentTheme.stats.alt9,
			alt10: currentTheme.stats.alt10,
		},
		tabs: {
			color: currentTheme.neutralA4,
			active: {
				background: currentTheme.primary1,
				color: currentTheme.neutralA1,
			},
		},
		view: {
			background: currentTheme.neutral1,
		},
		warning: {
			primary: currentTheme.negative1,
			alt1: currentTheme.negative2,
		},
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
			h4: 'clamp(28px, 2.5vw, 36px)',
		},
		weight: {
			medium: '500',
			bold: '600',
			xBold: '700',
			xxBold: '800',
		},
	},
});
