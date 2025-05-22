import React from 'react';

import { DOM } from 'helpers/config';
import * as windowUtils from 'helpers/window';

import { Portal } from '../Portal';

import * as S from './styles';
import { IProps } from './types';

export default function Loader(props: IProps) {
	React.useEffect(() => {
		if (!props.sm && !props.xSm && !props.placeholder) {
			windowUtils.scrollTo(0, 0);
			windowUtils.hideDocumentBody();
			return () => {
				windowUtils.showDocumentBody();
			};
		}
	}, [props.sm, props.xSm]);

	function getLoader(size: number, height: number, width: number, useRelative?: boolean, noPosition?: boolean) {
		return (
			<S.Container relative={props.relative ? props.relative : useRelative ?? false} noPosition={noPosition}>
				<S.Spinner size={size} height={height} width={width} noPosition={noPosition}>
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
					<S.Blade noPosition={noPosition} />
				</S.Spinner>
			</S.Container>
		);
	}

	if (props.placeholder) {
		return <S.Placeholder />;
	} else if (props.message) {
		if (props.noOverlay) {
			return (
				<S.MessageWrapper className={'info'}>
					{getLoader(16.5, 5.5, 1.95, true, true)}
					<span>{props.message}</span>
				</S.MessageWrapper>
			);
		}
		return (
			<Portal node={DOM.overlay}>
				<div className={'overlay'}>
					<S.MessageWrapper className={'info'}>
						{getLoader(16.5, 5.5, 1.95, true, true)}
						<span>{props.message}</span>
					</S.MessageWrapper>
				</div>
			</Portal>
		);
	} else {
		if (props.sm) {
			return <>{getLoader(19.75, 6, 2)}</>;
		}

		if (props.xSm) {
			return <>{getLoader(16.5, 5.5, 1.95)}</>;
		}

		if (props.relative) {
			return <>{getLoader(27.5, 7.5, 2.65)}</>;
		}

		return (
			<Portal node={DOM.loader}>
				<S.Wrapper>{getLoader(27.5, 7.5, 2.65)}</S.Wrapper>
			</Portal>
		);
	}
}
