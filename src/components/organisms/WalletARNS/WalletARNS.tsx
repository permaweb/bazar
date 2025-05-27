import React from 'react';
import { useSelector } from 'react-redux';

import ARNSMetadata from 'components/atoms/ARNSMetadata';
import { Loader } from 'components/atoms/Loader';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';

interface ARNSMetadata {
	Name: string;
	Ticker: string;
	Owner: string;
	Description: string;
	Logo: string | null;
	Keywords: string[];
}

export default function WalletARNS() {
	const arweaveProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];
	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const [arnsData, setArnsData] = React.useState<ARNSMetadata[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		async function fetchARNSData() {
			if (!arweaveProvider.walletAddress) {
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				// TODO: Replace with actual ARNS data fetching
				// This is a placeholder for the actual implementation
				const response = await fetch(`https://arweave.net/graphql`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						query: `
              query {
                transactions(
                  owners: ["${arweaveProvider.walletAddress}"]
                  tags: [
                    { name: "Protocol-Name", values: ["ARNS"] }
                  ]
                ) {
                  edges {
                    node {
                      id
                      tags {
                        name
                        value
                      }
                    }
                  }
                }
              }
            `,
					}),
				});

				const data = await response.json();
				if (data.errors) {
					throw new Error(data.errors[0].message);
				}

				const arnsTokens = data.data.transactions.edges.map((edge: any) => {
					const tags = edge.node.tags.reduce((acc: any, tag: any) => {
						acc[tag.name] = tag.value;
						return acc;
					}, {});

					return {
						Name: tags['Name'] || 'Unknown',
						Ticker: tags['Ticker'] || 'UNKNOWN',
						Owner: arweaveProvider.walletAddress,
						Description: tags['Description'] || '',
						Logo: tags['Logo'] || null,
						Keywords: tags['Keywords'] ? tags['Keywords'].split(',') : [],
					};
				});

				setArnsData(arnsTokens);
			} catch (err: any) {
				console.error('Error fetching ARNS data:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchARNSData();
	}, [arweaveProvider.walletAddress]);

	if (!arweaveProvider.walletAddress) {
		return (
			<S.Wrapper>
				<S.Message>{language.connectWalletToViewARNS}</S.Message>
			</S.Wrapper>
		);
	}

	if (loading) {
		return (
			<S.Wrapper>
				<Loader sm relative />
			</S.Wrapper>
		);
	}

	if (error) {
		return (
			<S.Wrapper>
				<S.ErrorMessage>{error}</S.ErrorMessage>
			</S.Wrapper>
		);
	}

	if (arnsData.length === 0) {
		return (
			<S.Wrapper>
				<S.Message>{language.noARNSFound}</S.Message>
			</S.Wrapper>
		);
	}

	return (
		<S.Wrapper>
			<S.Header>
				<h2>{language.yourARNS}</h2>
			</S.Header>
			<S.Content>
				{arnsData.map((arns, index) => (
					<S.ARNSItem key={index}>
						<ARNSMetadata metadata={arns} />
					</S.ARNSItem>
				))}
			</S.Content>
		</S.Wrapper>
	);
}
