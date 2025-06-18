import React, { useRef, useState } from 'react';

interface RewardCardProps {
	video: string;
	fallbackImage: string;
	image: string;
	title: string;
	collected: string;
	bgColor: string;
	cardBgColor: string;
	connected: boolean;
	overlayStyle: React.CSSProperties;
	isLeft?: boolean;
	isRight?: boolean;
	requirements: Array<{
		text: string;
		met: boolean;
	}>;
	guide?: string[];
	onClaim?: () => Promise<void>;
}

export function RewardCard({
	video,
	fallbackImage,
	image,
	title,
	collected,
	bgColor,
	cardBgColor,
	connected,
	overlayStyle,
	isLeft,
	isRight,
	requirements,
	guide,
	onClaim,
}: RewardCardProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	const handleMouseEnter = () => {
		setIsHovered(true);
		if (videoRef.current) {
			videoRef.current.play().catch(console.error);
		}
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
		if (videoRef.current) {
			videoRef.current.pause();
			videoRef.current.currentTime = 0;
		}
	};

	const handleClaim = async () => {
		if (!onClaim) return;
		setIsLoading(true);
		setError(null);
		try {
			await onClaim();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to claim reward');
		} finally {
			setIsLoading(false);
		}
	};

	const atLeastOneRequirementMet = requirements.some((req) => req.met);

	// Adjust overlay style for seamless inner corners
	const customOverlayStyle = {
		...overlayStyle,
		borderTopRightRadius: isLeft ? 0 : overlayStyle.borderRadius,
		borderTopLeftRadius: isRight ? 0 : overlayStyle.borderRadius,
		borderBottomRightRadius: isLeft ? 0 : overlayStyle.borderRadius,
		borderBottomLeftRadius: isRight ? 0 : overlayStyle.borderRadius,
	};

	// Adjust cardBgColor container for seamless inner and bottom corners
	const cardBgRadius = `${isLeft ? '16px 0 0 16px' : isRight ? '0 16px 16px 0' : '16px'}`;

	return (
		<div
			className="reward-card"
			style={{
				width: 503.5,
				height: 438,
				position: 'relative',
				background: '#fff',
				borderRadius: 16,
				boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-start',
				alignItems: 'flex-start',
				padding: 0,
				overflow: 'hidden',
			}}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{!connected && <div style={customOverlayStyle} />}
			<div
				style={{
					background: '#F1F1F1',
					borderRadius: 12,
					margin: 8,
					padding: 16,
					height: 'calc(100% - 16px)',
					width: 'calc(100% - 16px)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					justifyContent: 'flex-start',
					gap: 16,
				}}
			>
				<div
					style={{
						width: '100%',
						height: 200,
						position: 'relative',
						overflow: 'hidden',
						borderRadius: 8,
					}}
				>
					<video
						ref={videoRef}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							position: 'absolute',
							opacity: isHovered ? 1 : 0,
							transition: 'opacity 0.3s',
						}}
						src={video}
						muted
						playsInline
						poster={fallbackImage}
					/>
					<img
						src={image}
						alt={title}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							opacity: isHovered ? 0 : 1,
							transition: 'opacity 0.3s',
						}}
					/>
				</div>

				<div
					style={{
						width: '100%',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					}}
				>
					<h2
						style={{
							margin: 0,
							fontSize: 16,
							fontWeight: 700,
							color: '#262A1A',
							fontFamily: 'Inter',
							lineHeight: 1.4,
							whiteSpace: 'nowrap',
						}}
					>
						{title}
					</h2>
					<span
						style={{
							fontSize: 13,
							color: '#262A1A',
							fontFamily: 'Inter',
							lineHeight: 1.4,
							whiteSpace: 'nowrap',
						}}
					>
						{collected}
					</span>
				</div>

				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 12,
						width: '100%',
					}}
				>
					{requirements.map((requirement, index) => (
						<div
							key={index}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 12,
								padding: '8px 12px',
								background: requirement.met ? 'rgba(90, 246, 80, 0.1)' : '#F5F5F5',
								borderRadius: 8,
							}}
						>
							<div
								style={{
									width: 20,
									height: 20,
									borderRadius: '50%',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									background: requirement.met ? '#5AF650' : 'transparent',
									border: requirement.met ? 'none' : '1px solid #262A1A',
									boxShadow: requirement.met ? '0 0 8px rgba(90, 246, 80, 0.5)' : 'none',
								}}
							>
								{requirement.met && (
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
										<path
											d="M10 3L4.5 8.5L2 6"
											stroke="white"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</div>
							<span
								style={{
									color: requirement.met ? '#262A1A' : '#666666',
									fontSize: 14,
									fontFamily: 'Inter',
								}}
							>
								{requirement.text}
							</span>
						</div>
					))}
				</div>

				{guide && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 12,
							width: '100%',
						}}
					>
						<h3
							style={{
								margin: 0,
								fontSize: 14,
								fontWeight: 700,
								color: '#262A1A',
								fontFamily: 'Inter',
							}}
						>
							Guide
						</h3>
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: 8,
							}}
						>
							{guide.map((step, index) => (
								<div
									key={index}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 8,
										padding: '8px 12px',
										background: '#F5F5F5',
										borderRadius: 8,
									}}
								>
									<span style={{ color: '#666666', minWidth: '20px', fontSize: 14 }}>{index + 1}.</span>
									<span style={{ color: '#666666', fontSize: 14 }}>{step}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{connected && atLeastOneRequirementMet && onClaim && (
					<button
						onClick={handleClaim}
						disabled={isLoading}
						style={{
							width: '100%',
							padding: '12px',
							border: 'none',
							borderRadius: 8,
							background: '#4299E1',
							color: '#FFFFFF',
							fontSize: 14,
							fontWeight: 700,
							cursor: isLoading ? 'wait' : 'pointer',
							opacity: isLoading ? 0.7 : 1,
							transition: 'all 0.2s ease',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 8,
							marginTop: 'auto',
						}}
					>
						{isLoading ? (
							<>
								<div
									style={{
										width: 16,
										height: 16,
										border: '2px solid #ffffff',
										borderTopColor: 'transparent',
										borderRadius: '50%',
										animation: 'spin 1s linear infinite',
									}}
								/>
								Claiming...
							</>
						) : (
							'Claim Reward'
						)}
					</button>
				)}

				{error && (
					<div
						style={{
							color: '#E53E3E',
							fontSize: 14,
							fontFamily: 'Inter',
							textAlign: 'center',
							marginTop: 8,
						}}
					>
						{error}
					</div>
				)}
			</div>
		</div>
	);
}
