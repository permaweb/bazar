import styled from 'styled-components';

export const Wrapper = styled.div`
	position: relative;
	display: flex;
	align-items: center;
`;

export const Button = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
	border-radius: 8px;
	transition: all 0.2s ease;
	position: relative;

	&:hover {
		background: var(--background-secondary);
	}
`;

export const IconWrapper = styled.div`
	position: relative;
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;

	img {
		width: 20px;
		height: 20px;
		filter: var(--icon-filter);
	}
`;

export const WanderButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	position: relative;
	padding: 6px;
	border-radius: 50%;
	transition: all 0.2s ease;
	width: 40px;
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		background-color: rgba(139, 92, 246, 0.1);
		transform: scale(1.05);
	}

	&:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
	}
`;

export const WanderIconWrapper = styled.div`
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 50%;
	}
`;

export const NotificationBadge = styled.div`
	position: absolute;
	top: -4px;
	right: -4px;
	background: linear-gradient(135deg, #10b981, #34d399);
	color: white;
	border-radius: 50%;
	width: 16px;
	height: 16px;
	font-size: 0.7rem;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2px solid var(--background-primary);
`;

export const Dropdown = styled.div`
	position: absolute;
	top: 100%;
	right: 0;
	background: var(--background-primary);
	border: 2px solid var(--border-color);
	border-radius: 12px;
	padding: 16px;
	min-width: 280px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
	z-index: 9999;
	margin-top: 8px;
	backdrop-filter: blur(8px);

	/* Ensure proper text contrast */
	color: var(--text-primary);
`;

export const DropdownHeader = styled.div`
	margin-bottom: 16px;

	h4 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}
`;

export const ProgressText = styled.div`
	font-size: 0.85rem;
	color: var(--text-secondary);
	font-weight: 500;
`;

export const TierBadge = styled.span<{ tierColor: string }>`
	display: inline-block;
	background: ${(props) => props.tierColor};
	color: white;
	padding: 4px 12px;
	border-radius: 16px;
	font-size: 0.8rem;
	font-weight: 600;
	text-transform: capitalize;
	letter-spacing: 0.02em;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	margin-top: 2px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

export const ProgressBar = styled.div`
	width: 100%;
	height: 6px;
	background: var(--background-secondary);
	border-radius: 3px;
	overflow: hidden;
	margin-bottom: 16px;
`;

export const ProgressFill = styled.div<{ progress: number }>`
	height: 100%;
	background: linear-gradient(90deg, #3b82f6, #60a5fa);
	width: ${(props) => Math.min(props.progress, 100)}%;
	transition: width 0.3s ease;
`;

export const RewardsSection = styled.div`
	margin-bottom: 16px;
`;

export const RewardsTitle = styled.div`
	font-size: 0.85rem;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 8px;
`;

export const RewardsList = styled.div`
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
`;

export const RewardItem = styled.div`
	padding: 6px 12px;
	background: linear-gradient(135deg, #ffd700, #ffed4e);
	border-radius: 8px;
	color: #b8860b;
	font-weight: 600;
	font-size: 0.8rem;
`;

export const ActionSection = styled.div`
	display: flex;
	justify-content: center;
`;

export const ViewQuestsButton = styled.div`
	padding: 8px 16px;
	background: #3b82f6;
	color: white;
	border-radius: 8px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;
	text-decoration: none;
	border: 1px solid #3b82f6;

	&:hover {
		background: #2563eb;
		border-color: #2563eb;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
	}
`;
