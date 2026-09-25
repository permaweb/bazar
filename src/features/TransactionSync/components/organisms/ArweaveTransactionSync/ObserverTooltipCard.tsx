import type { ObserverTooltipStage } from '../../../types';

import * as S from './styles';

export function ObserverTooltipCard(props: { observerLabel: string; stages: ObserverTooltipStage[]; detail: string }) {
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
