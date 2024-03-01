import 'styled-components';

declare module 'styled-components' {
	export interface DefaultTheme {
		scheme: 'dark' | 'light';
		colors: any;
		typography: any;
	}
}
