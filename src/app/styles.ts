import styled, { createGlobalStyle } from 'styled-components';

import { fadeIn1, fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const GlobalStyle = createGlobalStyle`
  html, body, div, span, applet, object, iframe,
  h1, h2, h3, h4, h5, h6, p, blockquote, pre,
  a, abbr, acronym, address, big, cite, code,
  del, dfn, em, img, ins, kbd, q, s, samp,
  small, strike, strong, sub, sup, tt, var,
  b, u, i, center,
  dl, dt, dd, ol, ul, li,
  fieldset, form, label, legend,
  caption, tbody, tfoot, thead, tr, th, td,
  article, aside, canvas, details, embed,
  figure, figcaption, footer, header, hgroup,
  menu, nav, output, ruby, section, summary,
  time, mark, audio, video {
    margin: 0;
    padding: 0;
    border: 0;
    font: inherit;
    vertical-align: baseline;
  }

  article, aside, details, figcaption, figure,
  footer, header, hgroup, menu, nav, section {
    display: block;
  }

  body {
		overflow-x: hidden !important;
    background: ${(props) => props.theme.colors.view.background};
  }

  ol, ul {
    list-style: none;
  }

  blockquote, q {
    quotes: none;
  }

  blockquote:before, blockquote:after,
  q:before, q:after {
    content: none;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
			margin: 0;
			color-scheme: ${(props) => props.theme.scheme};
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
			"Ubuntu",
			sans-serif;
			font-family: ${(props) => props.theme.typography.family.primary};
			font-weight: ${(props) => props.theme.typography.weight.medium};
			color: ${(props) => props.theme.colors.font.primary};
			line-height: 1.5;
			-webkit-font-smoothing: antialiased;
			-moz-osx-font-smoothing: grayscale;
			box-sizing: border-box;
			
			scrollbar-color: ${(props) => props.theme.colors.scrollbar.thumb} ${(props) => props.theme.colors.scrollbar.track};

			::-webkit-scrollbar-track {
				background: ${(props) => props.theme.colors.scrollbar.track};
			}
			::-webkit-scrollbar {
				width: 15px;
				border-left: 1px solid ${(props) => props.theme.colors.border.primary};
			}
			::-webkit-scrollbar-thumb {
				background-color: ${(props) => props.theme.colors.scrollbar.thumb};
				border-radius: 36px;
				border: 3.5px solid transparent;
				background-clip: padding-box;
			} 
	}

  h1, h2, h3, h4, h5, h6 {
    font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-shadow: 1px 1px 0px ${(props) => props.theme.colors.font.alt3};
    color: ${(props) => props.theme.colors.font.primary};
		overflow-wrap: anywhere;
  }

	h1 {
    font-size: ${(props) => props.theme.typography.size.h1};
  }

  h2 {
    font-size: ${(props) => props.theme.typography.size.h2};
  }

  h4 {
    font-size: ${(props) => props.theme.typography.size.h4};
  }

  a, button {
    transition: all 100ms;
  }
  
  button {
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    &:hover {
      cursor: pointer;
    }

    &:disabled {
      cursor: default;
    }
  }

  a {
    color: ${(props) => props.theme.colors.link.color};
    text-decoration: none;
    &:hover {
      color: ${(props) => props.theme.colors.link.active};
    }
  }

  input, textarea {
    box-shadow: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: transparent;
    margin: 0;
    padding: 10px;
    &:focus {
      outline: 0;
    }
    &:disabled {
      cursor: default;
    }
  }
  
  textarea {
    resize: none;
  }

  label {
    cursor: text;
  }

  b, strong {
    font-weight: ${(props) => props.theme.typography.weight.bold};
  }

  .border-wrapper-primary {
    background: ${(props) => props.theme.colors.container.primary.background};
    border: 1px solid ${(props) => props.theme.colors.border.primary};
    border-radius: ${STYLING.dimensions.radius.primary};
  }

  .border-wrapper-alt1 {
    background: ${(props) => props.theme.colors.container.primary.active};
    border: 1px solid ${(props) => props.theme.colors.border.alt4};
    border-radius: ${STYLING.dimensions.radius.primary};
  }

  .border-wrapper-alt2 {
    background: ${(props) => props.theme.colors.container.primary.background};
    box-shadow: 0 1px 2px 0.5px ${(props) => props.theme.colors.shadow.primary};
    border: 1px solid ${(props) => props.theme.colors.border.alt4};
    border-radius: ${STYLING.dimensions.radius.primary};
  }

  .border-wrapper-alt3 {
    background: ${(props) => props.theme.colors.container.primary.background};
		box-shadow: 0px 3.5px 5px 0px ${(props) => props.theme.colors.shadow.alt2};
		border: 1px solid ${(props) => props.theme.colors.border.alt4};
    border-radius: ${STYLING.dimensions.radius.primary};
  }

  .max-view-wrapper {
    width: 100%;
    max-width: ${STYLING.cutoffs.max};
    margin: 0 auto;
    padding: 0 20px;
  }

  .modal-wrapper {
	padding: 0 20px 20px 20px !important;
  }

	.info {
    padding: 0 5px 0.5px 5px;
    background: ${(props) => props.theme.colors.contrast.background};
    border-radius: ${STYLING.dimensions.radius.alt2};
    animation: ${open} ${fadeIn2};
    span {
      color: ${(props) => props.theme.colors.contrast.color};
      font-size: ${(props) => props.theme.typography.size.xxxSmall};
      font-weight: ${(props) => props.theme.typography.weight.bold};
      white-space: nowrap;
	  }
  }

  .info-text {
    padding: 0 4.25px;
    background: ${(props) => props.theme.colors.container.primary.background};
    border: 1px solid ${(props) => props.theme.colors.border.primary};
    border-radius: ${STYLING.dimensions.radius.alt2};
    animation: ${open} ${fadeIn1};
    span {
      color: ${(props) => props.theme.colors.font.primary};
      font-size: ${(props) => props.theme.typography.size.xxxSmall};
      font-weight: ${(props) => props.theme.typography.weight.medium};
      white-space: nowrap;
	}
  }

  .message {
    span {
      color: ${(props) => props.theme.colors.font.primary};
      font-size: ${(props) => props.theme.typography.size.xxSmall};
      font-weight: ${(props) => props.theme.typography.weight.bold};
	  font-family: ${(props) => props.theme.typography.family.alt1};
      white-space: nowrap;
	}
  }

  .update-wrapper {
		width: 100%;
		padding: 2.5px 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: ${(props) => props.theme.colors.container.alt11.background};
		border: 1px solid ${(props) => props.theme.colors.border.alt3};
		border-radius: ${STYLING.dimensions.radius.alt1};
		span {
			font-size: ${(props) => props.theme.typography.size.xSmall} !important;
			font-family: ${(props) => props.theme.typography.family.alt1} !important;
			font-weight: ${(props) => props.theme.typography.weight.bold} !important;
			color: ${(props) => props.theme.colors.font.light1} !important;
			text-align: center;
		}
  }

  .overlay {
    min-height: 100vh;
    height: 100%;
    width: 100%;
    position: fixed;
    z-index: 11;
    top: 0;
    left: 0;
    background: ${(props) => props.theme.colors.overlay.primary};
    backdrop-filter: blur(2.5px);
    animation: ${open} ${fadeIn1};
  }

  .page-overlay {
    min-height: 100vh;
    height: 100%;
    width: 100%;
    position: fixed;
    z-index: 11;
    top: 0;
    left: 0;
    background: ${(props) => props.theme.colors.view.background};
    backdrop-filter: blur(2.5px);
    animation: ${open} ${fadeIn1};
  }

	.app-loader {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: ${open} ${fadeIn1};
    svg {
      height: auto;
      width: 50px;
			fill: ${(props) => props.theme.colors.font.primary};
    }
  }
	
   .fade-in {
		animation: ${open} ${fadeIn1};
	}
	
	#nprogress .bar {
		background: ${(props) => props.theme.colors.loader.alt1} !important;
		height: 3.15px !important;

		.peg {
			box-shadow: none !important;
		}
	}

	.scroll-wrapper {
    overflow: auto;
    
    scrollbar-color: transparent transparent;
    ::-webkit-scrollbar {
      width: 12.5px;
    }

    ::-webkit-scrollbar-thumb {
      background-color: transparent;
    }

    &:hover {
      scrollbar-color: ${(props) => props.theme.colors.scrollbar.thumb} transparent;

      ::-webkit-scrollbar-thumb {
        background-color: ${(props) => props.theme.colors.scrollbar.thumb};
      }
    }
  }

	.scroll-wrapper-hidden {
    overflow: auto;

    &::-webkit-scrollbar {
      display: none;
    }

    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

export const AppWrapper = styled.div`
	min-height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	position: relative;
`;

export const View = styled.main`
	min-height: calc(100vh - ${STYLING.dimensions.nav.height});
	width: 100%;
	padding: 0 20px 20px 20px;
	/* Add padding bottom to account for fixed global music player */
	margin-bottom: 100px;
`;

export const DrawerWrapper = styled.div`
	width: 100%;
	margin: 20px 0 0 0;
`;

export const DrawerContent = styled.div<{ transparent?: boolean }>`
	width: 100%;
	padding: ${(props) => (props.transparent ? `0` : `20px`)};
	background: ${(props) =>
		props.transparent ? props.theme.colors.transparent : props.theme.colors.container.primary.background};
	border-bottom-left-radius: ${(props) => (props.transparent ? `0` : STYLING.dimensions.radius.primary)};
	border-bottom-right-radius: ${(props) => (props.transparent ? `0` : STYLING.dimensions.radius.primary)};
	> * {
		&:not(:last-child) {
			margin: 0 0 15px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const DrawerHeaderWrapper = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 0 7.5px 0;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	width: 100%;
	> * {
		&:not(:first-child) {
			text-align: right;
		}
	}
`;

export const DrawerHeader = styled.p`
	font-size: ${(props) => props.theme.typography.size.lg};
	font-family: ${(props) => props.theme.typography.family.alt1};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary.primary};
	line-height: 1.75;
	word-wrap: break-word;
`;

export const DrawerContentLine = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	position: relative;
	width: 100%;
	> * {
		&:not(:first-child) {
			text-align: right;
			display: flex;
			justify-content: flex-end;
		}
	}
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		flex-direction: column;
		align-items: flex-start;
		> * {
			&:not(:first-child) {
				text-align: left;
				display: flex;
				justify-content: flex-start;
			}
		}
	}
`;

export const DrawerContentHeader = styled.p`
	flex: 1;
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.alt1};
	word-wrap: break-word;
`;

export const DrawerContentFlex = styled.div`
	display: flex;
	align-items: center;
	flex: 1.5;
`;

export const DrawerContentFlexEnd = styled.div`
	display: flex;
	align-items: center;
	flex: 1;
`;

export const DrawerContentDetail = styled.p`
	flex: 1;
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	word-wrap: break-word;
	white-space: nowrap;
	a {
		text-decoration: underline;
	}
	img {
		height: 20px;
		width: 17.5px;
	}
`;

export const DrawerContentDescription = styled(DrawerContentDetail)`
	white-space: normal;
	line-height: 1.65;
`;

export const DrawerContentLink = styled.a`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	text-decoration: underline;
	&:hover {
		color: ${(props) => props.theme.colors.font.alt1};
	}
	word-wrap: break-word;
`;

export const DrawerContentDetailAlt = styled(DrawerContentDetail)`
	font-family: ${(props) => props.theme.typography.family.alt1};
`;

export const FullMessageWrapper = styled.div`
	height: 150px;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	p {
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
		text-align: center;
	}
`;
