import React, { useState } from 'react';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';

import { calculateRoyaltySplit, RoyaltyInfo } from '../../services/royaltyService';

import * as S from './styles';

export default function RoyaltyTest() {
	const [saleAmount, setSaleAmount] = useState<string>('1000');
	const [royaltyPercentage, setRoyaltyPercentage] = useState<string>('5');
	const [hasRoyalties, setHasRoyalties] = useState<boolean>(true);
	const [testResults, setTestResults] = useState<any>(null);

	const runTest = () => {
		const royaltyInfo: RoyaltyInfo = {
			hasRoyalties,
			royaltyPercentage: Number(royaltyPercentage),
			creatorAddress: 'test-creator-address',
		};

		const result = calculateRoyaltySplit(Number(saleAmount), royaltyInfo);
		setTestResults({ input: { saleAmount, royaltyPercentage, hasRoyalties }, output: result });
	};

	const runMultipleTests = () => {
		const tests = [
			{ saleAmount: 1000, royaltyPercentage: 5, hasRoyalties: true },
			{ saleAmount: 1000, royaltyPercentage: 10, hasRoyalties: true },
			{ saleAmount: 1000, royaltyPercentage: 50, hasRoyalties: true },
			{ saleAmount: 1000, royaltyPercentage: 0, hasRoyalties: false },
			{ saleAmount: 100, royaltyPercentage: 7, hasRoyalties: true },
		];

		const results = tests.map((test) => {
			const royaltyInfo: RoyaltyInfo = {
				hasRoyalties: test.hasRoyalties,
				royaltyPercentage: test.royaltyPercentage,
				creatorAddress: 'test-creator-address',
			};
			return {
				test,
				result: calculateRoyaltySplit(test.saleAmount, royaltyInfo),
			};
		});

		setTestResults({ multipleTests: results });
	};

	return (
		<S.Wrapper>
			<S.Header>
				<h1>Royalty System Test Page</h1>
				<p>Test the royalty calculation functionality</p>
			</S.Header>

			<S.TestSection>
				<h2>Single Test</h2>
				<S.Form>
					<FormField
						type="number"
						label="Sale Amount"
						value={saleAmount}
						onChange={(e: any) => setSaleAmount(e.target.value)}
						required
					/>
					<FormField
						type="number"
						label="Royalty Percentage"
						value={royaltyPercentage}
						onChange={(e: any) => setRoyaltyPercentage(e.target.value)}
						required
					/>
					<S.CheckboxWrapper>
						<label>
							<input type="checkbox" checked={hasRoyalties} onChange={(e) => setHasRoyalties(e.target.checked)} />
							Enable Royalties
						</label>
					</S.CheckboxWrapper>
					<Button type="primary" label="Run Single Test" handlePress={runTest} loading={false} height={40} />
				</S.Form>
			</S.TestSection>

			<S.TestSection>
				<h2>Multiple Tests</h2>
				<Button type="alt1" label="Run Multiple Tests" handlePress={runMultipleTests} loading={false} height={40} />
			</S.TestSection>

			{testResults && (
				<S.ResultsSection>
					<h2>Test Results</h2>
					<S.ResultsContent>
						{testResults.multipleTests ? (
							<div>
								{testResults.multipleTests.map((test: any, index: number) => (
									<S.TestResult key={index}>
										<h3>Test {index + 1}</h3>
										<p>
											<strong>Input:</strong> Sale: {test.test.saleAmount}, Royalty: {test.test.royaltyPercentage}%,
											Enabled: {test.test.hasRoyalties.toString()}
										</p>
										<p>
											<strong>Creator Amount:</strong> {test.result.creatorAmount}
										</p>
										<p>
											<strong>Seller Amount:</strong> {test.result.sellerAmount}
										</p>
										<p>
											<strong>Total:</strong> {test.result.totalAmount}
										</p>
										<p>
											<strong>Royalty %:</strong> {test.result.royaltyPercentage}%
										</p>
									</S.TestResult>
								))}
							</div>
						) : (
							<S.TestResult>
								<h3>Single Test Result</h3>
								<p>
									<strong>Input:</strong> Sale: {testResults.input.saleAmount}, Royalty:{' '}
									{testResults.input.royaltyPercentage}%, Enabled: {testResults.input.hasRoyalties.toString()}
								</p>
								<p>
									<strong>Creator Amount:</strong> {testResults.output.creatorAmount}
								</p>
								<p>
									<strong>Seller Amount:</strong> {testResults.output.sellerAmount}
								</p>
								<p>
									<strong>Total:</strong> {testResults.output.totalAmount}
								</p>
								<p>
									<strong>Royalty %:</strong> {testResults.output.royaltyPercentage}%
								</p>
							</S.TestResult>
						)}
					</S.ResultsContent>
				</S.ResultsSection>
			)}

			<S.InfoSection>
				<h2>How to Test</h2>
				<ol>
					<li>Set a sale amount and royalty percentage</li>
					<li>Toggle the "Enable Royalties" checkbox to test with/without royalties</li>
					<li>Click "Run Single Test" to see the calculation</li>
					<li>Click "Run Multiple Tests" to see various scenarios</li>
					<li>Verify that the creator and seller amounts add up to the total</li>
					<li>Check that royalties are only applied when enabled</li>
				</ol>
			</S.InfoSection>
		</S.Wrapper>
	);
}
