import React from 'react';
import type { ObserverView } from 'weave-wrangler';

import * as S from './styles';

export type ObserverTooltipStage = {
	label: string;
	count: number;
	target: number;
	state: ObserverView['state'];
	hasError: boolean;
};

type Props = {
	observerLabel: string;
	stages: ObserverTooltipStage[];
	detail: string;
};

export function ObserverTooltipCard({ observerLabel, stages, detail }: Props) {
	return (
		<>
			<S.RaceTooltipObserver>{observerLabel}</S.RaceTooltipObserver>
			<S.RaceTooltipStages>
				{stages.map((stage) => (
					<S.RaceTooltipStage key={stage.label}>
						<S.RaceTooltipStageDot
							$state={stage.state}
							$confirmations={stage.count}
							$hasError={stage.hasError}
						/>
						<span>{stage.label}</span>
						<strong>
							{stage.count}/{stage.target}
						</strong>
					</S.RaceTooltipStage>
				))}
			</S.RaceTooltipStages>
			<S.RaceTooltipDetail>{detail}</S.RaceTooltipDetail>
		</>
	);
}
