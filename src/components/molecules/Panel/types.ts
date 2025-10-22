import React from 'react';

export interface IProps {
	header: string | React.ReactNode | null | undefined;
	handleClose: () => void | null;
	children: React.ReactNode;
	open: boolean;
	width?: number;
	closeHandlerDisabled?: boolean;
}
