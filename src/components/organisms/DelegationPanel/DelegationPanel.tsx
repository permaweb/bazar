import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { Notification } from 'components/atoms/Notification';
import { Panel } from 'components/molecules/Panel';
import { DELEGATION } from 'helpers/config';
import {
	adjustOtherDelegations,
	calculateDelegationLimits,
	DelegationLimits,
	DelegationPreference,
	getDelegations,
	getProcessInfo,
	ProcessInfo,
	setPixlDelegation,
} from 'helpers/delegationUtils';
import { getTxEndpoint } from 'helpers/endpoints';

interface DelegationPanelProps {
	walletAddress?: string;
	isOpen: boolean;
	onClose: () => void;
}

interface DelegationPanelState {
	loading: boolean;
	currentDelegations: DelegationPreference[];
	currentLimits: DelegationLimits | null;
	selectedPercentage: number;
	adjustOthers: boolean;
	error: string | null;
	success: string | null;
	processNames: Record<string, string>;
	processInfo: Record<string, ProcessInfo>;
	transactionId: string | null;
	verifying: boolean;
	isEligible: boolean;
}

const PanelContent = styled.div`
	padding: 20px;
`;

const Title = styled.h2`
	margin: 0 0 20px 0;
	color: ${({ theme }) => theme.colors.text};
	font-size: 24px;
	font-weight: 600;
`;

const PercentageSlider = styled.input`
	width: 100%;
	margin: 20px 0;
`;

const PercentageDisplay = styled.div`
	text-align: center;
	font-size: 32px;
	font-weight: bold;
	color: ${({ theme }) => theme.colors.primary};
	margin: 10px 0;
`;

const QuickButtons = styled.div`
	display: flex;
	gap: 10px;
	margin: 20px 0;
	flex-wrap: wrap;
	justify-content: center;
`;

const QuickButton = styled.button<{ active: boolean }>`
	padding: 8px 16px;
	border: 2px solid ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.border.primary)};
	background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
	color: ${({ theme, active }) => (active ? 'green' : theme.colors.font.primary)};
	border-radius: 5px;
	cursor: pointer;
	transition: all 0.2s ease;
	font-weight: ${({ active }) => (active ? '600' : '400')};
	box-shadow: ${({ active }) => (active ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')};

	&:hover {
		background: ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.border.primary)};
		color: ${({ theme, active }) => (active ? 'white' : theme.colors.font.primary)};
		transform: ${({ active }) => (active ? 'none' : 'translateY(-1px)')};
	}
`;

const MaxButton = styled.button<{ active?: boolean }>`
	padding: 8px 16px;
	border: 2px solid ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.border.primary)};
	background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
	color: ${({ theme, active }) => (active ? 'green' : theme.colors.font.primary)};
	border-radius: 5px;
	cursor: pointer;
	font-size: 12px;
	font-weight: ${({ active }) => (active ? '600' : '400')};
	transition: all 0.2s ease;
	box-shadow: ${({ active }) => (active ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')};

	&:hover {
		background: ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.primary)};
		color: white;
		border-color: ${({ theme }) => theme.colors.primary};
		transform: ${({ active }) => (active ? 'none' : 'translateY(-1px)')};
	}
`;

const TransactionInfo = styled.div`
	background: ${({ theme }) => theme.colors.container.primary.background};
	border: 1px solid ${({ theme }) => theme.colors.border.primary};
	border-radius: 8px;
	padding: 15px;
	margin: 15px 0;
	font-size: 14px;
	color: ${({ theme }) => theme.colors.font.primary};

	small {
		color: ${({ theme }) => theme.colors.font.secondary};
		font-size: 12px;
	}
`;

const WarningBox = styled.div`
	background: ${({ theme }) => theme.colors.warning}20;
	border: 1px solid ${({ theme }) => theme.colors.warning};
	border-radius: 5px;
	padding: 15px;
	margin: 20px 0;
	color: ${({ theme }) => theme.colors.warning};
`;

const CheckboxWrapper = styled.label<{ isHighlighted?: boolean }>`
	display: flex;
	align-items: center;
	gap: 10px;
	margin: 10px 0;
	cursor: pointer;
	font-size: 14px;
	color: ${({ theme, isHighlighted }) =>
		isHighlighted ? theme.colors.warning?.text || '#856404' : theme.colors.font.primary};
	padding: 8px;
	border-radius: 6px;
	background: ${({ theme, isHighlighted }) =>
		isHighlighted ? theme.colors.warning?.background || '#fff3cd' : 'transparent'};
	border: 1px solid
		${({ theme, isHighlighted }) => (isHighlighted ? theme.colors.warning?.border || '#ffeaa7' : 'transparent')};
	transition: all 0.2s ease;

	&:hover {
		background: ${({ theme, isHighlighted }) =>
			isHighlighted ? theme.colors.warning?.background || '#fff3cd' : theme.colors.border.primary};
		opacity: 0.8;
	}
`;

const Checkbox = styled.input`
	margin: 0;
	width: 18px;
	height: 18px;
	cursor: pointer;
	accent-color: ${({ theme }) => theme.colors.primary};
`;

// New styled components for Load Network style UI
const PieChartContainer = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 20px 0;
`;

const PieChart = styled.div`
	width: 120px;
	height: 120px;
	border-radius: 50%;
	position: relative;
	margin-bottom: 15px;
`;

const PieSlice = styled.div<{ percentage: number; color: string; startAngle?: number }>`
	position: absolute;
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background: conic-gradient(
		${({ color, startAngle = 0, percentage }) =>
			`${color} ${startAngle}deg ${startAngle + percentage * 3.6}deg, transparent ${
				startAngle + percentage * 3.6
			}deg 360deg`}
	);

	/* Fallback for browsers that don't support conic-gradient */
	@supports not (background: conic-gradient(from 0deg, red, blue)) {
		background: ${({ color }) => color};
		clip-path: ${({ startAngle = 0, percentage }) => {
			const endAngle = startAngle + percentage * 3.6;
			const x1 = 50 + 50 * Math.cos(((startAngle - 90) * Math.PI) / 180);
			const y1 = 50 + 50 * Math.sin(((startAngle - 90) * Math.PI) / 180);
			const x2 = 50 + 50 * Math.cos(((endAngle - 90) * Math.PI) / 180);
			const y2 = 50 + 50 * Math.sin(((endAngle - 90) * Math.PI) / 180);
			const largeArcFlag = percentage > 50 ? 1 : 0;
			return `path('M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z')`;
		}};
	}
`;

const PieChartLegend = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

const LegendItem = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
`;

const LegendColor = styled.div<{ color: string }>`
	width: 12px;
	height: 12px;
	border-radius: 2px;
	background: ${({ color }) => color};
`;

const ColorDot = styled.div<{ color: string }>`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${({ color }) => color};
	margin-left: 6px;
	display: inline-block;
`;

const HeaderWithLink = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;

	span {
		font-weight: 600;
	}

	a {
		color: ${({ theme }) => theme.colors.primary};
		text-decoration: none;
		font-size: 12px;
		font-weight: 500;
		transition: color 0.2s ease;
		margin-left: 10px;

		&:hover {
			color: ${({ theme }) => theme.colors.primary};
			text-decoration: underline;
		}
	}
`;

const StatusSection = styled.div`
	margin: 20px 0;
	padding: 15px;
	background: ${({ theme }) => theme.colors.container.primary.background};
	border-radius: 8px;
`;

const StatusText = styled.div`
	font-size: 16px;
	color: ${({ theme }) => theme.colors.font.primary};
`;

const ControlSection = styled.div`
	margin: 20px 0;
`;

const ControlLabel = styled.div`
	margin-bottom: 10px;
	font-weight: 600;
	color: ${({ theme }) => theme.colors.font.primary};
	position: relative;
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const StyledSlider = styled.input`
	width: 100%;
	height: 6px;
	border-radius: 3px;
	background: ${({ theme }) => theme.colors.border.primary};
	outline: none;
	margin: 10px 0;

	&::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: ${({ theme }) => theme.colors.primary};
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	&::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: ${({ theme }) => theme.colors.primary};
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	&::-webkit-slider-track {
		background: ${({ theme }) => theme.colors.border.primary};
		border-radius: 3px;
		height: 6px;
	}

	&::-moz-range-track {
		background: ${({ theme }) => theme.colors.border.primary};
		border-radius: 3px;
		height: 6px;
		border: none;
	}
`;

const SliderLabels = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 12px;
	color: ${({ theme }) => theme.colors.font.secondary};
	position: relative;

	/* Adjust 50% position to align with slider thumb */
	span:nth-child(2) {
		margin-left: 22px;
	}
`;

const MaxIndicator = styled.div`
	font-size: 12px;
	color: ${({ theme }) => theme.colors.primary};
	font-weight: 600;
	background: ${({ theme }) => theme.colors.container.primary.background};
	padding: 2px 6px;
	border-radius: 4px;
	border: 1px solid ${({ theme }) => theme.colors.primary};
`;

const OtherDelegationsBox = styled.div`
	background: ${({ theme }) => theme.colors.container.primary.background};
	border: 1px solid ${({ theme }) => theme.colors.border.primary};
	border-radius: 8px;
	padding: 15px;
	margin: 20px 0;
`;

const OtherDelegationsTitle = styled.div`
	font-weight: 600;
	margin-bottom: 8px;
	color: ${({ theme }) => theme.colors.font.primary};
`;

const OtherDelegationsText = styled.div`
	font-size: 14px;
	color: ${({ theme }) => theme.colors.font.secondary};
	margin-bottom: 10px;
`;

const DelegationsListSection = styled.div`
	margin: 20px 0;
`;

const DelegationsListTitle = styled.h3`
	margin: 0 0 15px 0;
	font-size: 18px;
	font-weight: 600;
	color: ${({ theme }) => theme.colors.font.primary};
`;

const DelegationsList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 10px;
`;

const DelegationItem = styled.div`
	display: flex;
	align-items: center;
	padding: 12px;
	background: ${({ theme }) => theme.colors.container.primary.background};
	border-radius: 6px;
	border: 1px solid ${({ theme }) => theme.colors.border.primary};
`;

const DelegationIcon = styled.div<{ isPixl: boolean }>`
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: ${({ isPixl }) => (isPixl ? '#80f154' : '#666')};
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	font-weight: bold;
	margin-right: 12px;
	overflow: hidden;
`;

const TokenLogo = styled.img`
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: 50%;
`;

const DelegationName = styled.div`
	flex: 1;
	font-weight: 500;
	color: ${({ theme }) => theme.colors.font.primary};
`;

const DelegationPercentage = styled.div`
	font-weight: 600;
	color: ${({ theme }) => theme.colors.font.primary};
`;

const WarningMessage = styled.div`
	background: ${({ theme }) => theme.colors.warning.background || '#fff3cd'};
	border: 1px solid ${({ theme }) => theme.colors.warning.border || '#ffeaa7'};
	color: ${({ theme }) => theme.colors.warning.text || '#856404'};
	padding: 8px 12px;
	border-radius: 6px;
	margin: 10px 0;
	font-size: 13px;
	line-height: 1.3;
	text-align: center;
`;

const ConfirmButton = styled(Button)`
	margin-top: 20px;
	width: 100%;
`;

const KNOWN_TOKEN_COLORS = {
	PIXL: '#80f154',
	AO: '#4A90E2',
};

const RANDOM_COLORS = [
	'#FF6B6B',
	'#4ECDC4',
	'#45B7D1',
	'#96CEB4',
	'#FFEAA7',
	'#DDA0DD',
	'#98D8C8',
	'#F7DC6F',
	'#BB8FCE',
	'#85C1E9',
	'#F8C471',
	'#82E0AA',
	'#F1948A',
	'#85C1E9',
	'#D7BDE2',
	'#FAD7A0',
	'#A9DFBF',
	'#F9E79F',
	'#D5A6BD',
	'#A3E4D7',
];

export function DelegationPanel({ walletAddress, isOpen, onClose }: DelegationPanelProps) {
	const getTokenColor = (delegation: DelegationPreference, processInfo: Record<string, ProcessInfo>): string => {
		const isPixl = delegation.walletTo === DELEGATION.PIXL_PROCESS;
		const isAO = delegation.walletTo === '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc';
		const isOwnWallet = delegation.walletTo === walletAddress;

		// Special colors for known tokens
		if (isPixl) return KNOWN_TOKEN_COLORS.PIXL;
		if (isAO || isOwnWallet) return KNOWN_TOKEN_COLORS.AO;

		// Get token name for consistent color assignment
		let tokenName = 'Unknown';
		const info = processInfo[delegation.walletTo];
		if (info?.name) {
			tokenName = info.name;
		} else {
			// Use wallet address as fallback for consistent coloring
			tokenName = delegation.walletTo;
		}

		// Generate consistent color based on token name
		const hash = tokenName.split('').reduce((acc, char) => {
			return char.charCodeAt(0) + ((acc << 5) - acc);
		}, 0);

		const colorIndex = Math.abs(hash) % RANDOM_COLORS.length;
		return RANDOM_COLORS[colorIndex];
	};
	const [state, setState] = useState<DelegationPanelState>({
		loading: false,
		currentDelegations: [],
		currentLimits: null,
		selectedPercentage: 0,
		adjustOthers: false,
		error: null,
		success: null,
		processNames: {},
		processInfo: {},
		transactionId: null,
		verifying: false,
		isEligible: true,
	});

	useEffect(() => {
		if (walletAddress) {
			loadDelegations();
		}
	}, [walletAddress]);

	const loadDelegations = async () => {
		if (!walletAddress) return;

		setState((prev) => ({ ...prev, loading: true, error: null }));

		try {
			const delegations = await getDelegations(walletAddress);
			const limits = calculateDelegationLimits(delegations, DELEGATION.PIXL_PROCESS, walletAddress);

			const processInfo: Record<string, ProcessInfo> = {};
			// Fetch process info for both the delegation process and its Token-Process if present
			const processInfoPromises = delegations.map(async (delegation) => {
				try {
					const info = await getProcessInfo(delegation.walletTo);
					if (info) {
						processInfo[delegation.walletTo] = info;
						if (info['Token-Process']) {
							const tokenInfo = await getProcessInfo(info['Token-Process']);
							if (tokenInfo) {
								processInfo[info['Token-Process']] = tokenInfo;
							}
						}
					}
					return { processId: delegation.walletTo, info };
				} catch (error) {
					console.warn(`Failed to load process info for ${delegation.walletTo}:`, error);
					return { processId: delegation.walletTo, info: null };
				}
			});
			await Promise.all(processInfoPromises);

			const processNames: Record<string, string> = {};
			Object.entries(processInfo).forEach(([processId, info]) => {
				processNames[processId] = info.name;
			});

			const isEligible = delegations.length > 0 || limits.currentPixlDelegation > 0 || limits.totalOtherDelegations > 0;
			setState((prev) => ({
				...prev,
				currentDelegations: delegations,
				currentLimits: limits,
				selectedPercentage: limits.currentPixlDelegation,
				processNames,
				processInfo,
				loading: false,
				isEligible,
			}));
		} catch (error) {
			console.error('Failed to load delegations:', error);
			setState((prev) => ({
				...prev,
				error: 'Failed to load delegations',
				loading: false,
			}));
		}
	};

	const handlePercentageChange = (percentage: number) => {
		setState((prev) => ({ ...prev, selectedPercentage: percentage }));
	};

	const handleQuickButtonClick = (percentage: number) => {
		handlePercentageChange(percentage);
	};

	const handleMaxClick = () => {
		if (state.currentLimits) {
			handlePercentageChange(state.currentLimits.maxPossibleDelegation);
		}
	};

	const handleDelegationSubmit = async () => {
		if (!walletAddress) return;

		setState((prev) => ({ ...prev, loading: true, error: null, success: null, transactionId: null }));

		try {
			const needsAutoAdjust =
				state.currentLimits && state.selectedPercentage > state.currentLimits.maxPossibleDelegation;

			// If auto-adjust is needed and checked, adjust other delegations first
			if (needsAutoAdjust && state.adjustOthers) {
				await adjustOtherDelegations(walletAddress, state.selectedPercentage);
			}

			// Now set the PIXL delegation
			const transactionId = await setPixlDelegation(walletAddress, state.selectedPercentage);

			setState((prev) => ({
				...prev,
				transactionId,
				loading: false,
				verifying: true,
			}));

			await new Promise((resolve) => setTimeout(resolve, 2000));
			await loadDelegations();

			let successMessage = `Delegation submitted successfully! Transaction: ${transactionId.substring(0, 8)}...`;
			if (needsAutoAdjust && state.adjustOthers) {
				successMessage += ' Other delegations were automatically adjusted.';
			} else if (needsAutoAdjust && !state.adjustOthers) {
				successMessage += ' Note: You may need to manually adjust other delegations.';
			}

			setState((prev) => ({
				...prev,
				success: successMessage,
				verifying: false,
			}));
		} catch (error) {
			console.error('Delegation error:', error);
			setState((prev) => ({
				...prev,
				error: `Failed to update delegation: ${error instanceof Error ? error.message : 'Unknown error'}`,
				loading: false,
				verifying: false,
			}));
		}
	};

	const needsAdjustment = state.currentLimits && state.selectedPercentage > state.currentLimits.maxPossibleDelegation;

	if (!isOpen) {
		return null;
	}

	return (
		<Panel
			open={isOpen}
			header={
				<HeaderWithLink>
					<span>Delegate to PIXL</span>
					<a href="#/docs/overview/pixl-fair-launch" target="_blank" rel="noopener noreferrer">
						ℹ️ Learn More
					</a>
				</HeaderWithLink>
			}
			handleClose={onClose}
			width={500}
		>
			<PanelContent>
				{state.loading && <Loader />}

				{state.verifying && (
					<Notification type="success" message="Verifying transaction on AO network..." callback={() => {}} />
				)}

				{state.error && (
					<Notification
						type="warning"
						message={state.error}
						callback={() => setState((prev) => ({ ...prev, error: null }))}
					/>
				)}

				{state.success && (
					<Notification
						type="success"
						message={state.success}
						callback={() => setState((prev) => ({ ...prev, success: null }))}
					/>
				)}

				{state.transactionId && (
					<TransactionInfo>
						<strong>Transaction ID:</strong> {state.transactionId}
						<br />
						<small>This proves your delegation was submitted to the AO network</small>
						<br />
						<a
							href={`https://lunar.arweave.net/#/explorer/${state.transactionId}/info`}
							target="_blank"
							rel="noopener noreferrer"
							style={{ color: '#80f154', textDecoration: 'underline' }}
						>
							View transaction on Arweave →
						</a>
					</TransactionInfo>
				)}

				{state.currentLimits && (
					<>
						{/* Pie Chart Visualization */}
						<PieChartContainer>
							<PieChart>
								<svg width="120" height="120" viewBox="0 0 120 120">
									{(() => {
										// Only include delegations with factor > 0
										const filteredDelegations = state.currentDelegations.filter((d) => d.factor > 0);

										// If no delegations, show empty circle
										if (filteredDelegations.length === 0) {
											return <circle cx="60" cy="60" r="60" fill="transparent" stroke="#666" strokeWidth="2" />;
										}

										// Calculate total delegations (should be 100% for a full circle)
										const totalDelegations = filteredDelegations.reduce((sum, d) => sum + d.factor / 100, 0);

										// If total is 0, show empty circle
										if (totalDelegations === 0) {
											return <circle cx="60" cy="60" r="60" fill="transparent" stroke="#666" strokeWidth="2" />;
										}

										let currentAngle = -Math.PI / 2; // Start from top (12 o'clock position)
										return filteredDelegations.map((delegation, index) => {
											const percentage = delegation.factor / 100;
											// Calculate angle based on percentage of 100% (full circle)
											const angle = (percentage / 100) * 2 * Math.PI;
											if (percentage === 0) return null;

											const startAngle = currentAngle;
											const endAngle = currentAngle + angle;
											const x1 = 60 + 60 * Math.cos(startAngle);
											const y1 = 60 + 60 * Math.sin(startAngle);
											const x2 = 60 + 60 * Math.cos(endAngle);
											const y2 = 60 + 60 * Math.sin(endAngle);
											const largeArcFlag = angle > Math.PI ? 1 : 0;
											const path = `M 60 60 L ${x1} ${y1} A 60 60 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
											currentAngle = endAngle;
											const color = getTokenColor(delegation, state.processInfo);
											return <path key={`delegation-${index}`} d={path} fill={color} />;
										});
									})()}
								</svg>
							</PieChart>
							<PieChartLegend>
								{state.currentDelegations
									.filter((d) => d.factor > 0)
									.map((delegation, index) => {
										const percentage = delegation.factor / 100;
										if (percentage === 0) return null;
										const isPixl = delegation.walletTo === DELEGATION.PIXL_PROCESS;
										const isAO = delegation.walletTo === '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc';
										const isOwnWallet = delegation.walletTo === walletAddress;
										// Only show PIXL and AO in the legend
										if (!isPixl && !isAO && !isOwnWallet) return null;
										let name = 'Unknown';
										if (isPixl) {
											name = 'PIXL';
										} else if (isAO || isOwnWallet) {
											name = 'AO (Self)';
										}
										const color = getTokenColor(delegation, state.processInfo);
										return (
											<LegendItem key={`legend-${index}`}>
												<LegendColor color={color} />
												{isPixl ? (
													<a
														href="/#/asset/DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo"
														style={{ color, textDecoration: 'underline' }}
													>
														{name}: {percentage}%
													</a>
												) : (
													<span>
														{name}: {percentage}%
													</span>
												)}
											</LegendItem>
										);
									})}
							</PieChartLegend>
						</PieChartContainer>

						{/* Current Delegation Status */}
						<StatusSection>
							<StatusText>
								Current delegation: <strong>{state.currentLimits.currentPixlDelegation}% delegated to $PIXL</strong>
							</StatusText>
						</StatusSection>

						{/* Delegation Percentage Control */}
						<ControlSection>
							<ControlLabel>
								Delegation percentage: {state.selectedPercentage}%
								{state.currentLimits && state.currentLimits.maxPossibleDelegation < 100 && (
									<MaxIndicator>Max: {state.currentLimits.maxPossibleDelegation}%</MaxIndicator>
								)}
							</ControlLabel>
							<StyledSlider
								type="range"
								min="0"
								max="100"
								value={state.selectedPercentage}
								onChange={(e) => handlePercentageChange(Number(e.target.value))}
								step="1"
							/>
							<SliderLabels>
								<span>0%</span>
								<span>50%</span>
								<span>100%</span>
							</SliderLabels>
						</ControlSection>

						{/* Quick Buttons */}
						<QuickButtons>
							<QuickButton active={state.selectedPercentage === 25} onClick={() => handleQuickButtonClick(25)}>
								25%
							</QuickButton>
							<QuickButton active={state.selectedPercentage === 50} onClick={() => handleQuickButtonClick(50)}>
								50%
							</QuickButton>
							<QuickButton active={state.selectedPercentage === 75} onClick={() => handleQuickButtonClick(75)}>
								75%
							</QuickButton>
							<MaxButton
								onClick={handleMaxClick}
								active={state.currentLimits && state.selectedPercentage === state.currentLimits.maxPossibleDelegation}
							>
								Max
							</MaxButton>
						</QuickButtons>

						{/* Other Delegations Info */}
						<OtherDelegationsBox>
							<OtherDelegationsTitle>
								Other delegations: <strong>{state.currentLimits.totalOtherDelegations}%</strong>
							</OtherDelegationsTitle>
							<OtherDelegationsText>
								Maximum possible delegation to PIXL: <strong>{state.currentLimits.maxPossibleDelegation}%</strong>
							</OtherDelegationsText>
							{/* Only show adjust others checkbox if there are actual other token delegations */}
							{state.currentLimits.totalOtherDelegations > 0 && (
								<CheckboxWrapper isHighlighted={needsAdjustment && !state.adjustOthers}>
									<Checkbox
										type="checkbox"
										id="adjust-delegations"
										checked={state.adjustOthers}
										onChange={(e) => setState((prev) => ({ ...prev, adjustOthers: e.target.checked }))}
										style={{ display: 'none' }}
									/>
									<span>{state.adjustOthers ? '✅' : '🔳'} Automatically adjust other delegations if needed</span>
								</CheckboxWrapper>
							)}
						</OtherDelegationsBox>

						{/* Your Delegations List */}
						<DelegationsListSection>
							<DelegationsListTitle>Your Delegations</DelegationsListTitle>
							<DelegationsList>
								{state.currentDelegations.map((delegation, index) => {
									const percentage = delegation.factor / 100;
									const isPixl = delegation.walletTo === DELEGATION.PIXL_PROCESS;
									const isAO = delegation.walletTo === '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc';
									const isOwnWallet = delegation.walletTo === walletAddress;
									const processInfo = state.processInfo[delegation.walletTo];

									let name: string;
									let logoUrl: string | null = null;
									let fallbackText: string;

									if (isPixl) {
										name = 'PIXL Token';
										logoUrl = getTxEndpoint('czR2tJmSr7upPpReXu6IuOc2H7RuHRRAhI7DXAUlszU');
										fallbackText = 'P';
									} else if (isAO) {
										name = 'AO';
										logoUrl = getTxEndpoint('UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE');
										fallbackText = 'A';
									} else if (isOwnWallet) {
										name = 'AO (Self)';
										logoUrl = getTxEndpoint('UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE');
										fallbackText = 'A';
									} else {
										if (processInfo?.name) {
											name = processInfo.name;
											logoUrl = processInfo.logo ? getTxEndpoint(processInfo.logo) : null;
											fallbackText = processInfo.ticker?.[0] || name[0] || 'T';
										} else {
											name = `${delegation.walletTo.substring(0, 6)}...`;
											fallbackText = 'T';
										}
									}

									return (
										<DelegationItem key={index}>
											<DelegationIcon isPixl={isPixl}>
												{logoUrl ? (
													<TokenLogo
														src={logoUrl}
														alt={name}
														onError={(e) => {
															e.currentTarget.style.display = 'none';
															const fallback = e.currentTarget.parentElement?.querySelector('.fallback-text');
															if (fallback) {
																(fallback as HTMLElement).style.display = 'flex';
															}
														}}
													/>
												) : null}
												<span className="fallback-text" style={{ display: logoUrl ? 'none' : 'flex' }}>
													{fallbackText}
												</span>
											</DelegationIcon>
											<DelegationName>{name}</DelegationName>
											<DelegationPercentage>
												{percentage}%
												<ColorDot
													color={getTokenColor(delegation, state.processInfo)}
													title={`${name} delegation color`}
												/>
											</DelegationPercentage>
										</DelegationItem>
									);
								})}
							</DelegationsList>
						</DelegationsListSection>

						{/* Warning Message */}
						{needsAdjustment &&
							state.currentLimits &&
							state.currentLimits.totalOtherDelegations > 0 &&
							!state.adjustOthers && (
								<WarningMessage>
									⚠️ Over limit: {state.selectedPercentage}% &gt; {state.currentLimits.maxPossibleDelegation}%
								</WarningMessage>
							)}

						{/* Confirm Button */}
						{state.currentLimits && state.currentLimits.maxPossibleDelegation <= 0 && (
							<WarningMessage>You have no available balance to delegate.</WarningMessage>
						)}
						{!state.isEligible && (
							<WarningMessage>
								You are not eligible to delegate. You must have staked DAI, stETH, AR, or be participating in an AO
								yield pool to delegate to PIXL.
							</WarningMessage>
						)}
						<ConfirmButton
							type="primary"
							label="Confirm delegation"
							handlePress={handleDelegationSubmit}
							disabled={
								state.loading ||
								(needsAdjustment &&
									state.currentLimits &&
									state.currentLimits.totalOtherDelegations > 0 &&
									!state.adjustOthers) ||
								(state.currentLimits && state.currentLimits.maxPossibleDelegation <= 0) ||
								!state.isEligible
							}
						/>
					</>
				)}
			</PanelContent>
		</Panel>
	);
}
