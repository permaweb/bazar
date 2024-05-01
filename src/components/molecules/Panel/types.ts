import React from 'react';

export interface IProps {
	header: string | null | undefined;
	handleClose: () => void | null;
	children: React.ReactNode;
	open: boolean;
}
