import React from 'react';

import { IconButton } from 'components/atoms/IconButton';
import { Portal } from 'components/atoms/Portal';
import { ASSETS, DOM } from 'helpers/config';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';
import { IProps } from './types';

export default function Panel(props: IProps) {
	React.useEffect(() => {
		hideDocumentBody();
		return () => {
			showDocumentBody();
		};
	}, []);

	const escFunction = React.useCallback(
		(e: any) => {
			if (e.key === 'Escape' && props.handleClose) {
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
				<S.Container noHeader={!props.header} className={'border-wrapper-primary'}>
					<CloseHandler active={props.open} disabled={!props.open} callback={() => props.handleClose()}>
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
												wrapper: 32.5,
												icon: 12.5,
											}}
										/>
									</S.Close>
								)}
							</S.Header>
						)}
						<S.Body className={'scroll-wrapper'}>{props.children}</S.Body>
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

let modalOpenCounter = 0;

const showDocumentBody = () => {
	modalOpenCounter -= 1;
	if (modalOpenCounter === 0) {
		document.body.style.overflow = 'auto';
	}
};

const hideDocumentBody = () => {
	modalOpenCounter += 1;
	document.body.style.overflow = 'hidden';
};
