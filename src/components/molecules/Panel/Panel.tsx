import React from 'react';

import { IconButton } from 'components/atoms/IconButton';
import { Portal } from 'components/atoms/Portal';
import { ASSETS, DOM } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';
import { IProps } from './types';

export default function Panel(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		hideDocumentBody();
		return () => {
			showDocumentBody();
		};
	}, []);

	const escFunction = React.useCallback(
		(e: any) => {
			if (e.key === 'Escape' && props.handleClose && !props.closeHandlerDisabled) {
				props.handleClose();
			}
		},
		[props]
	);

	React.useEffect(() => {
		document.addEventListener('keydown', escFunction, false);

		return () => {
			document.removeEventListener('keydown', escFunction, false);
		};
	}, [escFunction]);

	function getBody() {
		return (
			<>
				<S.Container noHeader={!props.header} width={props.width} type={props.type}>
					<CloseHandler
						active={props.open && !props.closeHandlerDisabled}
						disabled={!props.open || props.closeHandlerDisabled}
						callback={() => props.handleClose()}
					>
						{props.header && (
							<S.Header>
								<S.LT>
									<S.Title>{props.header}</S.Title>
								</S.LT>
								{props.handleClose && (
									<S.Close>
										<IconButton
											type={'primary'}
											warning
											src={ASSETS.close}
											handlePress={() => props.handleClose()}
											active={false}
											dimensions={{
												wrapper: 35,
												icon: 20,
											}}
											tooltip={language.close}
											useBottomToolTip
										/>
									</S.Close>
								)}
							</S.Header>
						)}
						<S.Body className={'scroll-wrapper-hidden'}>{props.children}</S.Body>
					</CloseHandler>
				</S.Container>
			</>
		);
	}

	return (
		<Portal node={DOM.overlay}>
			<S.Wrapper noHeader={!props.header} top={window ? (window as any).pageYOffset : 0}>
				{getBody()}
			</S.Wrapper>
		</Portal>
	);
}

let panelOpenCounter = 0;

const showDocumentBody = () => {
	panelOpenCounter -= 1;
	if (panelOpenCounter === 0) {
		document.body.style.overflow = 'auto';
	}
};

const hideDocumentBody = () => {
	panelOpenCounter += 1;
	document.body.style.overflow = 'hidden';
};
