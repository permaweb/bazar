export interface IProps {
	metadata?: {
		Topics?: string[];
		OriginalMetadata?: {
			attributes?: Array<{
				trait_type: string;
				value: string;
			}>;
		};
		[key: string]: any;
	};
}
