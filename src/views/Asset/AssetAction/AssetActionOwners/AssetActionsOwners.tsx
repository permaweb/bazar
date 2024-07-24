import React from 'react';
import { Pie } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { useTheme } from 'styled-components';

import { OwnerLine } from 'components/molecules/OwnerLine';
import { AO } from 'helpers/config';
import { OwnerType } from 'helpers/types';
import { formatAddress, formatPercentage } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

ChartJS.register(ArcElement, Tooltip, Legend);

const MAX_OWNER_LENGTH = 10;

export default function AssetActionsOwners(props: IProps) {
	const theme = useTheme();

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const keys = React.useMemo(() => {
		return [
			theme.colors.stats.primary,
			theme.colors.stats.alt1,
			theme.colors.stats.alt2,
			theme.colors.stats.alt3,
			theme.colors.stats.alt4,
			theme.colors.stats.alt5,
			theme.colors.stats.alt6,
			theme.colors.stats.alt7,
			theme.colors.stats.alt8,
			theme.colors.stats.alt9,
			theme.colors.stats.alt10,
		];
	}, [theme]);

	const [data, setData] = React.useState<any>(null);
	const [sortedOwners, setSortedOwners] = React.useState<OwnerType[] | null>(null);

	React.useEffect(() => {
		if (props.owners) {
			const updatedOwners = [...props.owners].sort((a: any, b: any) => {
				return b.ownerQuantity - a.ownerQuantity;
			});

			if (updatedOwners.length > MAX_OWNER_LENGTH) {
				const others: any = updatedOwners.splice(-(updatedOwners.length - MAX_OWNER_LENGTH));

				const combined = others.reduce(
					(acc: any, cur: any) => {
						acc.ownerQuantity += cur.ownerQuantity;
						acc.ownerPercentage += cur.ownerPercentage;
						return acc;
					},
					{ address: language.other, handle: language.other, avatar: null, ownerQuantity: 0, ownerPercentage: 0 }
				);

				setSortedOwners([...updatedOwners, combined]);
			} else {
				setSortedOwners(updatedOwners);
			}
		}
	}, [props.owners, arProvider.profile]);

	React.useEffect(() => {
		if (sortedOwners) {
			const pieData: any = {
				labels: sortedOwners.map((owner: OwnerType) =>
					owner.address === AO.ucm
						? language.totalSalesPercentage
						: owner.profile
						? owner.profile.username
						: formatAddress(owner.address, true)
				),
				datasets: [],
			};

			pieData.datasets.push({
				data: sortedOwners.map((owner: OwnerType) => owner.ownerPercentage),
				backgroundColor: keys,
				borderColor: [theme.colors.border.alt4],
				borderWidth: 1,
			});

			setData(pieData);
		}
	}, [sortedOwners, theme]);

	return props.asset && data ? (
		<S.Wrapper className={'border-wrapper-alt2'}>
			{sortedOwners && sortedOwners.length > 0 ? (
				<>
					<S.InfoLine>
						<span>
							{`Ownership distribution of ${
								props.asset.data.title || 'asset'
							}. Each section represents a percentage of the asset owned by a
					particular user.`}
						</span>
					</S.InfoLine>
					<S.ChartWrapper>
						<S.ChartKeyWrapper>
							{sortedOwners.map((owner: OwnerType, index: number) => {
								return (
									<S.ChartKeyLine key={index} first={index === 0 && owner.address === AO.ucm}>
										<S.ChartKey background={keys[index] ? keys[index] : theme.colors.stats.alt10} />
										{owner.address !== AO.ucm && owner.address !== language.other ? (
											<>
												<OwnerLine owner={owner} callback={null} />
												<S.Percentage>{formatPercentage(owner.ownerPercentage)}</S.Percentage>
											</>
										) : (
											<>
												<S.ChartKeyText>{`${
													owner.address === AO.ucm ? language.totalSalesPercentage : language.other
												}`}</S.ChartKeyText>
												<S.Percentage>{`(${formatPercentage(owner.ownerPercentage)})`}</S.Percentage>
											</>
										)}
									</S.ChartKeyLine>
								);
							})}
						</S.ChartKeyWrapper>
						<S.Chart>
							<Pie
								data={data}
								options={{
									plugins: {
										legend: {
											display: false,
										},
										tooltip: {
											callbacks: {
												label: (tooltipItem) => {
													const owner = sortedOwners[tooltipItem.dataIndex];
													return `${formatPercentage(owner.ownerPercentage)}`;
												},
											},
										},
									},
								}}
							/>
						</S.Chart>
					</S.ChartWrapper>
				</>
			) : (
				<S.InfoLine>
					<span>{`This asset is currently listed for sale.`}</span>
				</S.InfoLine>
			)}
		</S.Wrapper>
	) : null;
}
