import styled from 'styled-components';

import { Dialog } from 'components/organisms/Dialog';

export { Balance, Disclosure, Fields, Form, FormFooter, Guidance, Quote } from '../../../styles/trade-form';

// The panel keeps its `fungible-dialog` / `purchase-dialog` class names; the Dialog organism owns the modal chrome.
export const Panel = styled(Dialog)`
	width: min(1180px, 100%);

	.dialog-heading h2 {
		font-size: clamp(1.35rem, 3vw, 1.7rem);
		line-height: 1.12;
		letter-spacing: 0.005em;
	}

	.result.success .result-outcome h3 {
		font-size: clamp(1.4rem, 3vw, 1.65rem);
		line-height: 1.15;
		letter-spacing: 0.005em;
	}

	&.purchase-dialog {
		width: min(580px, 100%);
		padding: clamp(24px, 4vw, 38px);
	}

	&.purchase-dialog.dialog-form-phase .dialog-heading {
		margin-bottom: 22px;
	}

	&.purchase-dialog .dialog-heading h2 {
		font-size: 1.35rem;
		font-weight: 400;
		line-height: 1.2;
	}

	&.purchase-dialog.dialog-form-phase > .trade-form {
		gap: 18px;
	}

	&.purchase-dialog.dialog-form-phase > .trade-form > .dialog-form-scroll {
		gap: 0;
		padding: 0 2px;
	}

	@media (max-width: 480px) {
		width: 100%;
		max-height: 100%;
		padding: 22px 16px;
	}
`;
