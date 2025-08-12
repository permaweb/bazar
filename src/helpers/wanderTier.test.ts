import { calculateTierRewards, getTierMultiplier, getTierQuestDescription } from './wanderTier';

// Simple test functions for Wander tier integration
export function testWanderTierIntegration() {
	console.log('Testing Wander Tier Integration...');

	// Test tier multipliers
	console.log('Tier Multipliers:');
	console.log('Prime:', getTierMultiplier('Prime')); // Should be 2.0
	console.log('Edge:', getTierMultiplier('Edge')); // Should be 1.5
	console.log('Reserve:', getTierMultiplier('Reserve')); // Should be 1.25
	console.log('Select:', getTierMultiplier('Select')); // Should be 1.1
	console.log('Core:', getTierMultiplier('Core')); // Should be 1.0

	// Test reward calculations
	console.log('\nReward Calculations (Base: 10 WNDR, 50 PIXL):');
	const baseWndr = 10;
	const basePixel = 50;

	const tiers: Array<'Prime' | 'Edge' | 'Reserve' | 'Select' | 'Core'> = ['Prime', 'Edge', 'Reserve', 'Select', 'Core'];

	tiers.forEach((tier) => {
		const rewards = calculateTierRewards(baseWndr, basePixel, tier);
		console.log(`${tier}: ${rewards.wndr} WNDR + ${rewards.pixel} PIXL (${rewards.multiplier}x)`);
	});

	// Test quest descriptions
	console.log('\nQuest Descriptions:');
	const questId = 'create-profile';
	tiers.forEach((tier) => {
		const description = getTierQuestDescription(questId, tier);
		console.log(`${tier}: ${description}`);
	});

	console.log('\nWander Tier Integration Test Complete!');
}

// Export for manual testing
if (typeof window !== 'undefined') {
	(window as any).testWanderTierIntegration = testWanderTierIntegration;
}
