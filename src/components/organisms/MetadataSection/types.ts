export interface IProps {
	metadata?: {
		Topics?: string[];
		// Support various casings of OriginalMetadata
		OriginalMetadata?: {
			attributes?: Array<{
				trait_type: string;
				value: string;
			}>;
		};
		Originalmetadata?: {
			attributes?: Array<{
				trait_type: string;
				value: string;
			}>;
		};
		originalMetadata?: {
			attributes?: Array<{
				trait_type: string;
				value: string;
			}>;
		};
		originalmetadata?: {
			attributes?: Array<{
				trait_type: string;
				value: string;
			}>;
		};
		[key: string]: any;
	};
}
