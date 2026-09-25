import styled from 'styled-components';

import { Page as CreatePage } from '../../../styles/create-form';

export {
	Field,
	Form,
	Heading,
	Layout,
	Notice,
	Recovery,
	SubmitButton,
	Success,
	SuccessActions,
	Summary,
} from '../../../styles/create-form';

/**
 * The mode tabs are a shared `SegmentedTabs`, so their two rules stay here as contextual rules on the
 * `.create-mode` class the creator passes down; the breakpoint override keeps the same weight as the base rule.
 */
export const Page = styled(CreatePage)`
	.create-mode {
		margin: -20px 0 30px;
	}

	@media (max-width: 1050px) {
		.create-mode {
			margin-top: -8px;
		}
	}
`;

export const CostNote = styled.section`
	padding: 11px 12px;
	display: flex;
	align-items: flex-start;
	gap: 10px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);
	color: var(--muted-subtle);

	> svg {
		margin-top: 1px;
		flex: none;
	}

	> div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	strong,
	span {
		line-height: 1.35;
	}

	strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 500;
	}

	span {
		font-size: var(--type-small);
	}
`;
