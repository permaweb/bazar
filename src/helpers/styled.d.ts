import 'styled-components';

declare module 'styled-components' {
	export interface DefaultTheme {
		colors: {
			border: { primary: string; alt1: string };
			container: {
				primary: { background: string };
				alt1: { background: string };
				alt2: { background: string };
			};
			font: { primary: string; alt1: string };
			indicator: { primary: string };
			nasaGraphic: { green1: string };
			stats: { alt7: string; alt8: string; alt10: string };
			status: { draft: string };
			warning: { primary: string };
		};
		typography: {
			family: { primary: string };
			weight: { medium: number };
			size: { lg: string; small: string; xxSmall: string; xxxxSmall: string };
		};
	}
}
