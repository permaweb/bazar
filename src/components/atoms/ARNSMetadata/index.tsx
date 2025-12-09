import React from 'react';

interface ARNSMetadataProps {
	metadata: any;
}

const ARNSMetadata: React.FC<ARNSMetadataProps> = ({ metadata }) => {
	console.log('ARNSMetadata received metadata:', metadata);

	// Render metadata fields, e.g. Name, Ticker, etc.
	return (
		<div>
			<h3>{metadata?.Name || 'No Name'}</h3>
			<p>{metadata?.Description || 'No Description'}</p>
			{/* Add more fields as needed */}
		</div>
	);
};

export default ARNSMetadata;
