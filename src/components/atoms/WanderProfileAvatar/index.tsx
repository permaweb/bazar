import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { WANDER_PROFILE_RINGS } from 'helpers/wanderTier';

import * as S from './styles';

// Tier to color mapping for Wander tiers (matching official Wander badges)
const TIER_COLORS = {
	Core: '#8b5cf6', // Purple from official Wander
	Select: '#06b6d4', // Cyan/teal from official Wander
	Reserve: '#10b981', // Green from official Wander
	Edge: '#6b7280', // Gray from official Wander
	Prime: '#f59e0b', // Amber/gold from official Wander
};

interface WanderProfileAvatarProps {
	src: string;
	alt?: string;
	size?: number;
	ringId?: string | null;
	wanderTier?: string | null; // Core, Select, Reserve, Edge, Prime
	className?: string;
	isGlowing?: boolean;
	onClick?: () => void;
	style?: React.CSSProperties;
}

export default function WanderProfileAvatar({
	src,
	alt = 'Profile Avatar',
	size = 50,
	ringId,
	wanderTier,
	className,
	isGlowing = false,
	onClick,
	style,
}: WanderProfileAvatarProps) {
	const [hasError, setHasError] = React.useState(false);

	// Use ringId first (quest-earned), then fallback to wanderTier
	const ring = ringId ? WANDER_PROFILE_RINGS[ringId as keyof typeof WANDER_PROFILE_RINGS] : null;
	const tierColor = wanderTier ? TIER_COLORS[wanderTier as keyof typeof TIER_COLORS] : null;

	const ringColor = ring?.color || tierColor;

	// Handle image with fallback to default user icon
	const avatar = React.useMemo(() => {
		if (!hasError && src && src !== ASSETS.user) {
			return <S.Avatar src={src} alt={alt} onError={() => setHasError(true)} />;
		} else {
			return (
				<S.DefaultAvatar size={size}>
					<ReactSVG src={ASSETS.user} />
				</S.DefaultAvatar>
			);
		}
	}, [src, alt, hasError, size]);

	return (
		<S.AvatarContainer size={size} className={className} onClick={onClick} style={style}>
			{ringColor && <S.RingBorder color={ringColor} size={size} isGlowing={isGlowing} />}
			<S.AvatarInner>{avatar}</S.AvatarInner>
		</S.AvatarContainer>
	);
}
