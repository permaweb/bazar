import { calculateRoyaltySplit, RoyaltyInfo } from '../royaltyService';

describe('RoyaltyService', () => {
	describe('calculateRoyaltySplit', () => {
		it('should return no royalty when royalty info is null', () => {
			const result = calculateRoyaltySplit(1000, null);

			expect(result).toEqual({
				creatorAmount: 0,
				sellerAmount: 1000,
				totalAmount: 1000,
				royaltyPercentage: 0,
			});
		});

		it('should return no royalty when hasRoyalties is false', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: false,
				royaltyPercentage: 10,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(1000, royaltyInfo);

			expect(result).toEqual({
				creatorAmount: 0,
				sellerAmount: 1000,
				totalAmount: 1000,
				royaltyPercentage: 0,
			});
		});

		it('should calculate 5% royalty correctly', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: true,
				royaltyPercentage: 5,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(1000, royaltyInfo);

			expect(result).toEqual({
				creatorAmount: 50,
				sellerAmount: 950,
				totalAmount: 1000,
				royaltyPercentage: 5,
			});
		});

		it('should calculate 10% royalty correctly', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: true,
				royaltyPercentage: 10,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(1000, royaltyInfo);

			expect(result).toEqual({
				creatorAmount: 100,
				sellerAmount: 900,
				totalAmount: 1000,
				royaltyPercentage: 10,
			});
		});

		it('should calculate 50% royalty correctly', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: true,
				royaltyPercentage: 50,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(1000, royaltyInfo);

			expect(result).toEqual({
				creatorAmount: 500,
				sellerAmount: 500,
				totalAmount: 1000,
				royaltyPercentage: 50,
			});
		});

		it('should handle fractional amounts correctly', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: true,
				royaltyPercentage: 7,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(100, royaltyInfo);

			expect(result).toEqual({
				creatorAmount: 7,
				sellerAmount: 93,
				totalAmount: 100,
				royaltyPercentage: 7,
			});
		});

		it('should round down fractional amounts', () => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: true,
				royaltyPercentage: 3,
				creatorAddress: 'test-creator',
			};

			const result = calculateRoyaltySplit(100, royaltyInfo);

			// 3% of 100 = 3, should be exact
			expect(result.creatorAmount).toBe(3);
			expect(result.sellerAmount).toBe(97);
		});
	});
});
