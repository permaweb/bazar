import React, { useEffect, useState } from 'react';
import { ANT, getANTProcessesOwnedByWallet } from '@ar.io/sdk/web';

import * as S from './styles';

interface IProps {
	address: string;
}

const ProfileArNS: React.FC<IProps> = ({ address }) => {
	const [records, setRecords] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchArns() {
			setLoading(true);
			try {
				const processIds = await getANTProcessesOwnedByWallet({ address });
				const ants = await Promise.all(
					processIds.map(async (processId: string) => {
						try {
							const ant = ANT.init({ processId });
							const info = await ant.getInfo();
							return { ...info, processId };
						} catch (e) {
							return null;
						}
					})
				);
				setRecords(ants.filter(Boolean));
			} catch (e) {
				setRecords([]);
			}
			setLoading(false);
		}
		if (address) fetchArns();
	}, [address]);

	if (loading) return <S.Wrapper>Loading...</S.Wrapper>;
	if (!records.length) return <S.Wrapper>No ArNS found for this wallet.</S.Wrapper>;

	return (
		<S.Wrapper>
			{records.map((ant) => (
				<S.AntCard key={ant.processId}>
					<S.AntName>{ant.Name}</S.AntName>
					<S.AntTicker>{ant.Ticker}</S.AntTicker>
					{ant.Logo && <img src={`https://arweave.net/${ant.Logo}`} alt="logo" width={40} />}
					<S.AntDescription>{ant.Description}</S.AntDescription>
				</S.AntCard>
			))}
		</S.Wrapper>
	);
};

export default ProfileArNS;
