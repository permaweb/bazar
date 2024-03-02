import React from 'react';

export interface IProps {
	active: boolean;
	callback: () => void;
	children: React.ReactNode;
	disabled: boolean;
}
