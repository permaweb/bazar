import React from 'react';

import { FormFieldType, ValidationType } from 'helpers/types';

export interface IProps {
	label?: string;
	value: number | string;
	type?: FormFieldType;
	step?: '1';
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	invalid: ValidationType;
	disabled: boolean;
	placeholder?: string;
	endText?: string;
	error?: string | null;
	sm?: boolean;
	testingCtx?: string;
	tooltip?: string;
	tooltipLabel?: string;
	autoFocus?: boolean;
	hideErrorMessage?: boolean;
	required?: boolean;
}
