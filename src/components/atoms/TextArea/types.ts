import React from 'react';

import { ValidationType } from 'helpers/types';

export interface IProps {
	label?: string;
	value: number | string;
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	invalid: ValidationType;
	disabled: boolean;
	placeholder?: string;
	endText?: string;
	error?: string | null;
	testingCtx?: string;
	required?: boolean;
}
