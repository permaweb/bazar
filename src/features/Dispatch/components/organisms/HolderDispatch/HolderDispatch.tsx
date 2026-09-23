import React from 'react';
import { useParams } from 'react-router-dom';

import { Eyebrow } from 'components/atoms/Eyebrow';
import { isArweaveId } from 'helpers/arweave-id';

import { TokenDispatch } from '../TokenDispatch';

export default function HolderDispatch() {
	const params = useParams();
	const processId = params.processId ?? '';

	if (!isArweaveId(processId)) {
		return (
			<section className="create-page dispatch-page">
				<div className="create-heading">
					<div>
						<Eyebrow>Dispatch</Eyebrow>
						<h1>Unknown token</h1>
					</div>
					<p>The address in the URL is not a 43-character Arweave process ID.</p>
				</div>
			</section>
		);
	}

	// A different token in the URL starts a fresh dispatch: its saved plan, state reads, and run never mix.
	return <TokenDispatch key={processId} processId={processId} />;
}
