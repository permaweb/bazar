import styled, { DefaultTheme } from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	margin: 22.5px 0 0 0;
	scroll-margin-top: 100px;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 10px 0;
	h4 {
		font-size: ${(props) => props.theme.typography.size.xLg};
	}
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;

	.filter-listings {
		svg {
			height: 17.5px;
			width: 17.5px;
			color: ${(props) => props.theme.colors.font.light1};
			margin: 3.5px 0 0 10px;
		}
	}
`;

export const HeaderPaginator = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;

	.table-previous {
		transform: rotate(180deg);
		svg {
			margin: -2.5px 0 0 0;
		}
	}

	.table-next {
		svg {
			margin: 0 0 0 1.5px;
		}
	}
`;

export const SubHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 15px;
	margin: 0 0 10px 0;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const EmptyWrapper = styled.div`
	padding: 20px;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const TableWrapper = styled.div`
	display: flex;
	flex-direction: column;
	overflow-x: auto;
	background: ${(props) => props.theme.colors.container.primary.active};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const TableHeader = styled.div`
	height: 50px;
	min-width: 100%;
	width: fit-content;
	display: flex;
	align-items: center;
	padding: 0 15px;
	> * {
		flex: 1;
		margin: 0 10px;
	}
	> :first-child {
		justify-content: flex-start;
		margin: 0 10px 0 0;
		p {
			text-align: left;
		}
	}
	> :last-child {
		justify-content: flex-end;
		margin: 0 0 0 10px;
		p {
			text-align: right;
		}
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
`;

export const TableHeaderValue = styled.div`
	min-width: 130px;
	p {
		font-size: ${(props) => props.theme.typography.size.base} !important;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.primary} !important;
	}
`;

export const TableBody = styled.div`
	min-width: 100%;
	width: fit-content;
	display: flex;
	flex-direction: column;
	> :not(:last-child) {
		border-bottom: 1px solid ${(props) => props.theme.colors.border.alt4};
	}
	> :first-child {
		border-top: 1px solid ${(props) => props.theme.colors.border.alt4};
	}
`;

export const TableRow = styled.div`
	height: 50px;
	display: flex;
	align-items: center;
	padding: 0 15px;
	background: ${(props) => props.theme.colors.container.primary.background};
	> * {
		flex: 1;
		margin: 0 10px;
	}
	> :first-child {
		justify-content: flex-start;
		margin: 0 10px 0 0;
		p {
			text-align: left;
		}
	}
	> :last-child {
		justify-content: flex-end;
		margin: 0 0 0 10px;
		p {
			text-align: right;
		}
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
`;

export const TableRowLoader = styled(TableRow)`
	background: ${(props) => props.theme.colors.container.primary.active};
`;

export const TableRowValue = styled.div`
	display: flex;
	align-items: center;
	min-width: 130px;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
		max-width: 90%;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
`;

export const OwnerWrapper = styled(TableRowValue)`
	min-width: 175px;
`;

export const SenderWrapper = styled(OwnerWrapper)`
	min-width: 185px;
`;

export const ReceiverWrapper = styled(OwnerWrapper)`
	min-width: 185px;
`;

export const QuantityWrapper = styled(TableRowValue)`
	flex: 0;
	p {
		font-family: ${(props) => props.theme.typography.family.alt1};
	}
	.header {
		font-family: ${(props) => props.theme.typography.family.primary} !important;
	}
`;

export const PriceWrapper = styled(TableRowValue)`
	min-width: 85px;
`;

export const AssetWrapper = styled(TableRowValue)`
	flex: 0;
	min-width: 200px;
	width: 200px;
	gap: 10px;
	margin: 0 20px 0 0;
	overflow: hidden;
	a {
		width: fit-content;
		max-width: calc(100% - 42.5px);
	}
	p {
		max-width: 100%;
		white-space: nowrap;
		text-overflow: ellipsis;
		display: block;
		overflow: hidden;
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
`;

export const AssetDataWrapper = styled.div`
	min-height: 32.5px;
	min-width: 32.5px;
	height: 32.5px;
	width: 32.5px;
	position: relative;
	overflow: hidden;
	transition: all 100ms;
	a {
		width: 100%;
		position: relative;

		::after {
			content: '';
			position: absolute;
			height: 100%;
			width: 100%;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: ${(props) => props.theme.colors.overlay.alt1};
			border-radius: ${STYLING.dimensions.radius.alt2};
			opacity: 0;
			transition: all 100ms;
		}
		&:hover::after {
			opacity: 1;
		}
		&:focus::after {
			opacity: 1;
		}
		&:hover {
			cursor: pointer;
		}
	}
	div {
		border-radius: ${STYLING.dimensions.radius.alt2} !important;
		img {
			border-radius: 0 !important;
		}
	}
`;

export const EventWrapper = styled(TableRowValue)`
	flex: none;
	min-width: 0;
	width: 150px;
	margin: 0 20px;
`;

export const Event = styled.a<{ type: string }>`
	display: flex;
	align-items: center;
	justify-content: center;
	text-decoration: none;
	color: ${(props) => {
		const type = props.type.toLowerCase();
		// Explicitly override the text color at the top level
		if (type === 'sale' || type === 'sold') {
			return 'var(--color-success)';
		}
		return 'inherit';
	}};
	padding: 3px 10px;
	border-radius: 5px;
	min-width: 90px;
	font-weight: bold;
	text-align: center;
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	background: ${(props) => {
		const type = props.type.toLowerCase();

		// Direct checks for the exact text shown in the UI
		if (type === 'sent') return props.theme.colors.stats.alt10;
		if (type === 'listed') return props.theme.colors.stats.alt9;

		// Other event checks
		if (type === 'purchase' || type === 'purchased' || type === 'received') {
			return 'var(--color-success-bg)';
		}
		if (type === 'sale' || type === 'sold') {
			return 'var(--color-success-bg)';
		}
		if (type === 'listing') {
			return props.theme.colors.stats.primary;
		}
		if (type === 'unlisted' || type === 'cancelled') {
			return 'var(--color-error-bg)';
		}
		if (type.includes('transfer') || type === 'direct transfer' || type === 'wallet transfer') {
			return 'var(--color-primary-bg)';
		}

		// Default fallback - use the same style as UCM label
		return props.theme.colors.stats.alt3;
	}};

	svg {
		width: 17.5px;
		height: 17.5px;
		margin-right: 7.5px;

		path {
			fill: ${(props) => {
				const type = props.type.toLowerCase();
				// Purchase events
				if (type === 'purchase' || type === 'purchased' || type === 'received') {
					return 'var(--color-success)';
				}
				// Sale events
				if (type === 'sale' || type === 'sold') {
					return 'var(--color-success)';
				}
				// Sent events
				if (type === 'sent') {
					return 'var(--color-warning)';
				}
				// Listing events
				if (type === 'listing' || type === 'listed' || type === 'listed to ucm') {
					return 'var(--color-info)';
				}
				// Unlisting events
				if (type === 'unlisted' || type === 'cancelled' || type === 'unlisted from ucm') {
					return 'var(--color-error)';
				}
				// Transfer events
				if (type.includes('transfer') || type === 'direct transfer' || type === 'wallet transfer') {
					return 'var(--color-primary)';
				}
				// Default fallback
				return 'var(--color-text)';
			}};
		}
	}

	p {
		font-size: 14px;
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => {
			const type = props.type.toLowerCase();
			// Purchase events
			if (type === 'purchase' || type === 'purchased' || type === 'received') {
				return 'var(--color-success)';
			}
			// Sale events
			if (type === 'sale' || type === 'sold') {
				return 'var(--color-success)';
			}
			// Sent events
			if (type === 'sent') {
				return 'var(--color-warning)';
			}
			// Listing events
			if (type === 'listing' || type === 'listed' || type === 'listed to ucm') {
				return 'var(--color-info)';
			}
			// Unlisting events
			if (type === 'unlisted' || type === 'cancelled' || type === 'unlisted from ucm' || type === 'listing cancelled') {
				return 'var(--color-error)';
			}
			// Transfer events
			if (type.includes('transfer') || type === 'direct transfer' || type === 'wallet transfer') {
				return 'var(--color-primary)';
			}
			// Default fallback
			return 'var(--color-text)';
		}};
	}

	&:hover {
		opacity: 0.85;
	}
`;

export const Entity = styled.div<{ type: 'UCM' | 'User' }>`
	width: 110px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${(props) => (props.type === 'UCM' ? props.theme.colors.stats.primary : props.theme.colors.stats.alt5)};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.alt2};
	padding: 1.5px 7.5px;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		max-width: 100%;
	}
`;

export const Footer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 20px 0 0 0;
`;

export const LoadingWrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12.5px;
`;

export const SelectWrapper = styled.div``;

export const DateValueWrapper = styled(TableRowValue)`
	gap: 10px;
	min-width: 150px;
`;

export const DateValueTooltip = styled.div`
	position: relative;
	.date-tooltip {
		display: none;
		position: absolute;
		top: -22.5px;
		right: 10px;
		padding: 2.5px 10px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		p {
			max-width: 100%;
			font-size: ${(props) => props.theme.typography.size.xxSmall};
			font-family: ${(props) => props.theme.typography.family.primary};
			font-weight: ${(props) => props.theme.typography.weight.bold};
		}
	}
	svg {
		width: 15px;
		fill: ${(props) => props.theme.colors.font.alt1};
		color: ${(props) => props.theme.colors.font.alt1};
		margin: 6.5px 0 0 0;
		position: relative;
		transition: all 100ms;
	}

	&:hover {
		svg {
			fill: ${(props) => props.theme.colors.font.primary};
			color: ${(props) => props.theme.colors.font.primary};
		}
		.date-tooltip {
			display: block;
		}
	}
`;

export const RelatedTxs = styled.span`
	font-size: 0.8em;
	color: var(--color-text-alt2);
	margin-left: 8px;
	padding: 2px 6px;
	background: var(--color-bg-alt1);
	border-radius: 4px;
`;
