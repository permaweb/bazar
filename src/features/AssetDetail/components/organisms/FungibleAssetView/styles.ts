import styled from 'styled-components';

import { TabPanel } from '../../../styles/panels';

export {
	CommerceColumn,
	FungiblePage,
	Layout,
	MarketNote,
	TokenBalance,
	TokenHeader,
	TokenIdentity,
	TokenMeta,
	TokenName,
	TokenTitle,
} from '../../../styles/asset-page';
export { TabPanel } from '../../../styles/panels';

// The market tab is both a tab panel and the stacked `.fungible-market-panel` grid.
export const MarketTabPanel = styled(TabPanel)`
	display: grid;
	gap: 16px;
`;
