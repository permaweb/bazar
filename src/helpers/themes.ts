import { DefaultTheme } from 'styled-components';

const common = {
	positive1: '#64B686',
	positive2: '#4EA673',
	negative1: '#E94278',
	negative2: '#E52461',
	stats: {
		primary: '#FF8385',
		alt1: '#A3DEE2',
		alt2: '#B9B8D0',
		alt3: '#8FC2D3',
		alt4: '#6CB9D9',
		alt5: '#8886D9',
		alt6: '#FFBD9F',
		alt7: '#A8DDE2',
		alt8: '#F2A9D3',
		alt9: '#6D909E',
		alt10: '#8e8e8e',
	},
	events: {
		listing: '#b86ac2',
		bid: '#eb9330',
		sale: '#51af88',
		purchase: '#667eea',
		unlisted: '#d43b7a',
	},
};

export const lightTheme = {
	scheme: 'light',
	neutral1: '#FFFFFF',
	neutral2: '#F6F6F6',
	neutral3: '#D6D6D6',
	neutral4: '#C9C9C9',
	neutral5: '#CCCCCC',
	neutral6: '#F7F7F7',
	neutral7: '#FAFAFA',
	neutral8: '#EEEEEE',
	neutralA1: '#0A0A0A',
	neutralA2: '#5F5F5F',
	neutralA3: '#5C5C5C',
	neutralA4: '#313131',
	neutralA5: '#A4A4A4',
	neutralA6: '#A9A9A9',
	neutralA7: '#F0F0F0',
	overlay1: 'rgb(30, 30, 30, .65)',
	primary1: '#F96E46',
	primary2: '#E6562C',
	semiTransparent1: 'rgba(255, 255, 255, 0.575)',
	semiTransparent2: 'rgba(40, 40, 40, 0.575)',
	semiTransparent3: 'rgba(0, 0, 0, 0.55)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgb(250, 250, 250, 0)',
	light1: '#FFFFFF',
	light2: '#DADADA',
	dark1: '#151515',
	dark2: '#333333',
	...common,
};

export const dimmedTheme = {
	scheme: 'dark',
	neutral1: '#1A1A1A',
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
	neutralA4: '#DEDEDE',
	neutralA5: '#CCCCCC',
	neutralA6: '#FAFAFA',
	neutralA7: '#151515',
	overlay1: 'rgba(5, 5, 5, 0.75)',
	primary1: '#F96E46',
	primary2: '#E6562C',
	semiTransparent1: 'rgba(0, 0, 0, 0.25)',
	semiTransparent2: 'rgba(0, 0, 0, 0.75)',
	semiTransparent3: 'rgba(10, 10, 10, 0.85)',
	semiTransparent4: '#9A9A9A45',
	semiTransparent5: 'rgba(0, 0, 0, 0.65)',
	light1: '#FFFFFF',
	light2: '#DADADA',
	dark1: '#0A0A0A',
	dark2: '#1F1F1F',
	...common,
};

export const darkTheme = {
	scheme: 'dark',
	neutral1: '#090A0B',
	neutral2: '#16171A',
	neutral3: '#292A2D',
	neutral4: '#54565A',
	neutral5: '#70717D',
	neutral6: '#80818D',
	neutral7: '#A0A1AD',
	neutral8: '#1B1C20',
	neutralA1: '#FFFFFF',
	neutralA2: '#EAEAED',
	neutralA3: '#D9D9DC',
	neutralA4: '#D6D6D9',
	neutralA5: '#C5C5C8',
	neutralA6: '#F3F3F6',
	neutralA7: '#0E0F11',
	overlay1: 'rgba(10, 10, 10, 0.65)',
	primary1: '#F96E46',
	primary2: '#E6562C',
	semiTransparent1: 'rgba(0, 0, 0, 0.15)',
	semiTransparent2: 'rgba(0, 0, 0, 0.65)',
	semiTransparent3: 'rgba(20, 20, 20, 0.75)',
	semiTransparent4: '#AEAEAE45',
	semiTransparent5: 'rgba(0, 0, 0, 0.5)',
	light1: '#FFFFFF',
	light2: '#DADADA',
	dark1: '#151515',
	dark2: '#333333',
	...common,
};

export const theme = (currentTheme: any): DefaultTheme => {
	if (!currentTheme) {
		currentTheme = lightTheme;
	}
	return {
		scheme: currentTheme.scheme,
		colors: {
			border: {
				primary: currentTheme.neutral4,
				alt1: currentTheme.primary1,
				alt2: currentTheme.neutralA6,
				alt3: currentTheme.neutral5,
				alt4: currentTheme.neutral4,
			},
			button: {
				primary: {
					background: currentTheme.neutral3,
					border: currentTheme.neutral3,
					color: currentTheme.neutralA1,
					active: {
						background: currentTheme.neutral4,
						border: currentTheme.neutral4,
						color: currentTheme.neutralA1,
					},
					disabled: {
						background: currentTheme.neutral4,
						border: currentTheme.neutral5,
						color: currentTheme.neutralA2,
					},
				},
				alt1: {
					background: currentTheme.primary1,
					border: currentTheme.primary1,
					color: currentTheme.light1,
					active: {
						background: currentTheme.primary2,
						border: currentTheme.primary2,
						color: currentTheme.light1,
					},
					disabled: {
						background: currentTheme.neutral4,
						border: currentTheme.neutral5,
						color: currentTheme.neutralA5,
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
					background: currentTheme.neutral8,
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
				alt11: {
					background: currentTheme.dark2,
				},
			},
			contrast: {
				background: currentTheme.dark2,
				border: currentTheme.neutral9,
				color: currentTheme.light1,
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
				background: currentTheme.neutral2,
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
				primary: currentTheme.positive1,
				alt1: currentTheme.positive2,
			},
			link: {
				color: currentTheme.neutralA1,
				active: currentTheme.neutralA4,
			},
			loader: {
				primary: currentTheme.primary2,
				alt1: currentTheme.primary1,
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
				alt3: currentTheme.semiTransparent2,
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
			events: { ...currentTheme.events },
		},
		typography: {
			family: {
				primary: `'Inter', sans-serif`,
				alt1: `'Quantico', sans-serif`,
				alt2: `'Archivo', sans-serif`,
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
				h4: 'clamp(24px, 2.5vw, 34px)',
			},
			weight: {
				medium: '500',
				bold: '600',
				xBold: '700',
				xxBold: '800',
			},
		},
	};
};
