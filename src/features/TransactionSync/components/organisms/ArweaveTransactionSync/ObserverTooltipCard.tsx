import type { ObserverView } from 'api/transactions';

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

export function ObserverTooltipCard(props: Props) {
	return (
		<>
			<S.RaceTooltipObserver>{props.observerLabel}</S.RaceTooltipObserver>
			<S.RaceTooltipStages>
				{props.stages.map((stage) => (
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
			<S.RaceTooltipDetail>{props.detail}</S.RaceTooltipDetail>
		</>
	);
}
