# Wander Team Quest System Integration with Wander Tier API

This document outlines the integration of the Wander team's quest system into the Bazar marketplace, enhanced with Wander tier-based rewards.

## Overview

The quest system provides users with gamified tasks to complete in exchange for WNDR and PIXL token rewards. The system tracks user progress across different activities and automatically updates quest completion status. The integration with the Wander tier API provides tier-based reward multipliers, enhancing the user experience for higher-tier Wander users.

### Wander Tier Integration

The quest system integrates with the Wander tier API to provide enhanced rewards based on the user's Wander tier:

- **Prime Tier**: 2.0x reward multiplier
- **Edge Tier**: 1.5x reward multiplier
- **Reserve Tier**: 1.25x reward multiplier
- **Select Tier**: 1.1x reward multiplier
- **Core Tier**: 1.0x reward multiplier (base rewards)

## Quest Types

### Bronze Tier

- **Create Profile**: Create your Bazar profile to start your journey
  - Base Reward: 10 WNDR + 50 PIXL
  - Prime Tier: 20 WNDR + 100 PIXL (2.0x)
  - Edge Tier: 15 WNDR + 75 PIXL (1.5x)
  - Reserve Tier: 12.5 WNDR + 62.5 PIXL (1.25x)
  - Select Tier: 11 WNDR + 55 PIXL (1.1x)

### Silver Tier

- **Create Your First Asset**: Upload and create your first atomic asset
  - Base Reward: 25 WNDR + 100 PIXL
  - Prime Tier: 50 WNDR + 200 PIXL (2.0x)
  - Edge Tier: 37.5 WNDR + 150 PIXL (1.5x)
  - Reserve Tier: 31.25 WNDR + 125 PIXL (1.25x)
  - Select Tier: 27.5 WNDR + 110 PIXL (1.1x)
- **Create Your First Collection**: Create a collection to organize your assets
  - Base Reward: 25 WNDR + 100 PIXL
  - Prime Tier: 50 WNDR + 200 PIXL (2.0x)
  - Edge Tier: 37.5 WNDR + 150 PIXL (1.5x)
  - Reserve Tier: 31.25 WNDR + 125 PIXL (1.25x)
  - Select Tier: 27.5 WNDR + 110 PIXL (1.1x)

### Gold Tier

- **Make Your First Purchase**: Buy your first atomic asset from the marketplace
  - Base Reward: 50 WNDR + 200 PIXL
  - Prime Tier: 100 WNDR + 400 PIXL (2.0x)
  - Edge Tier: 75 WNDR + 300 PIXL (1.5x)
  - Reserve Tier: 62.5 WNDR + 250 PIXL (1.25x)
  - Select Tier: 55 WNDR + 220 PIXL (1.1x)

### Platinum Tier

- **Stake Pixel**: Stake your PIXL tokens to earn rewards
  - Base Reward: 100 WNDR + 500 PIXL
  - Prime Tier: 200 WNDR + 1000 PIXL (2.0x)
  - Edge Tier: 150 WNDR + 750 PIXL (1.5x)
  - Reserve Tier: 125 WNDR + 625 PIXL (1.25x)
  - Select Tier: 110 WNDR + 550 PIXL (1.1x)

## Implementation Details

### Store Structure

The quest system uses Redux for state management with the following structure:

```
store/quests/
├── actions.ts      # Action creators
├── constants.ts    # Action types
├── reducers.ts     # State reducers
├── types.ts        # TypeScript interfaces
└── index.ts        # Exports
```

### Key Components

1. **Quest View** (`src/views/Quests/`)

   - Main quest interface showing all available quests
   - Progress tracking and reward claiming
   - Modern, responsive design
   - Tier-based reward display

2. **Quest Tracker** (`src/helpers/questTracker.ts`)

   - Singleton service for tracking user actions
   - Integrates with existing purchase and asset creation flows
   - Automatic quest completion detection
   - Wander tier integration

3. **Quest Notification** (`src/components/organisms/QuestNotification/`)

   - Header component showing quest progress
   - Notification badge for available rewards
   - Quick access to quest interface
   - Tier information display

4. **Wander Tier Helper** (`src/helpers/wanderTier.ts`)
   - Integration with Wander tier API
   - Tier-based reward calculations
   - Fallback mechanisms for API failures

### Integration Points

#### Purchase Tracking

Quest progress is automatically updated when users make purchases:

```typescript
// In AssetActionMarketOrders.tsx
if (props.type === 'buy') {
	// Existing PIXL streak tracking
	const streaks = await readHandler({
		processId: AO.pixl,
		action: 'Get-Streaks',
	});
	dispatch(streakActions.setStreaks(streaks.Streaks));

	// New quest tracking
	if (permawebProvider.profile?.id) {
		await questTracker.trackPurchase(
			props.asset.data.id,
			permawebProvider.profile.id,
			getTransferQuantity().toString()
		);
	}
}
```

#### Wander Tier Integration

The quest system automatically fetches and integrates Wander tier information:

```typescript
// In questTracker.ts
const progress = await questTracker.getQuestProgress(profileId, walletAddress);

// Get Wander tier information if wallet address is provided
if (walletAddress) {
	// Try injected API first, then fallback to dryrun
	let tierInfo = await getWanderTierInfoInjected();
	if (!tierInfo) {
		tierInfo = await getWanderTierInfo(walletAddress);
	}

	if (tierInfo) {
		progress.wanderTier = tierInfo.tier;
		progress.wanderBalance = tierInfo.balance;
		progress.wanderRank = tierInfo.rank;
	}
}
```

#### Profile Creation

Quest progress is updated when users create profiles:

```typescript
// In ProfileManage component (to be implemented)
await questTracker.trackProfileCreation(profileId);
```

#### Asset Creation

Quest progress is updated when users create assets:

```typescript
// In asset creation flow (to be implemented)
await questTracker.trackAssetCreation(assetId, profileId);
```

## Navigation

The quest system is accessible through:

1. **Header Navigation**: "Quests" link in the main navigation
2. **Quest Notification**: Star icon in header with progress indicator
3. **Direct URL**: `/quest` route

## Reward Distribution

### Current Implementation

- Rewards are simulated for demonstration purposes
- Claim process shows success notification
- No actual token distribution implemented

### Future Integration

To integrate with the Wander team's reward distribution system:

1. **API Integration**: Connect to Wander's reward distribution API
2. **Token Distribution**: Implement actual WNDR and PIXL token transfers
3. **Verification**: Add verification steps for quest completion
4. **Rate Limiting**: Implement rate limiting for reward claims

## Configuration

### Quest Configuration

Quests are configured in `src/views/Quests/index.tsx`:

```typescript
const QUEST_CONFIG = {
	createProfile: {
		id: 'create-profile',
		title: 'Create Profile',
		description: 'Create your Bazar profile to start your journey',
		icon: ASSETS.user,
		required: 1,
		tier: 'bronze',
		reward: { wndr: 10, pixel: 50, description: '10 WNDR + 50 PIXL' },
	},
	// ... other quests
};
```

### Wander Tier Configuration

Tier multipliers and configurations are defined in `src/helpers/wanderTier.ts`:

```typescript
const TIER_MULTIPLIERS = {
	Prime: 2.0,
	Edge: 1.5,
	Reserve: 1.25,
	Select: 1.1,
	Core: 1.0,
} as const;
```

### Reward Tiers

Rewards increase by tier:

- Bronze: 10-50 WNDR + 50-100 PIXL
- Silver: 25-50 WNDR + 100-200 PIXL
- Gold: 50-100 WNDR + 200-500 PIXL
- Platinum: 100+ WNDR + 500+ PIXL

## TODO Items

### High Priority

1. **Collection Tracking**: Implement collection creation detection
2. **Purchase History**: Track purchase history for accurate counting
3. **PIXL Staking**: Integrate with staking contracts
4. **Wander API**: Connect to Wander team's reward distribution system
5. **Wander API Permissions**: Request ACCESS_ADDRESS permission for tier info

### Medium Priority

1. **Quest Persistence**: Store quest progress in user profiles
2. **Advanced Tracking**: Track additional metrics (time spent, assets viewed, etc.)
3. **Social Features**: Add social quests (follow users, share assets, etc.)
4. **Seasonal Quests**: Implement time-limited quest events

### Low Priority

1. **Quest Analytics**: Add analytics for quest completion rates
2. **Custom Quests**: Allow creators to create custom quests
3. **Quest Leaderboards**: Add competitive elements
4. **Quest Achievements**: Add achievement badges and milestones

## Testing

### Manual Testing

1. Create a new profile and verify "Create Profile" quest completion
2. Upload an asset and verify "Create Asset" quest completion
3. Make a purchase and verify "Make Purchase" quest completion
4. Claim rewards and verify notification display
5. Connect with Wander wallet and verify tier-based rewards
6. Test tier multiplier calculations for different Wander tiers

### Automated Testing

To be implemented:

- Unit tests for quest tracker
- Integration tests for quest completion
- E2E tests for quest flow

## Deployment

The quest system is ready for deployment with the following considerations:

1. **Environment Variables**: Configure Ario API endpoints
2. **Database**: Ensure quest progress persistence
3. **Monitoring**: Add monitoring for quest completion rates
4. **Backup**: Implement backup for quest progress data

## Support

For questions or issues with the quest system integration:

1. Check the quest tracker logs for errors
2. Verify quest configuration in the code
3. Test quest completion flows manually
4. Contact the Wander team for API integration assistance
5. Contact the development team for technical assistance

## Future Enhancements

### Phase 2 Features

- Multi-language support for quest descriptions
- Quest difficulty levels
- Team quests and collaborations
- Quest chains and storylines

### Phase 3 Features

- AI-powered quest recommendations
- Dynamic quest generation
- Cross-platform quest synchronization
- Advanced reward mechanisms
