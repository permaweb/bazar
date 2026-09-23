import React from 'react';
import { useParams } from 'react-router-dom';

import { Eyebrow } from 'components/atoms/Eyebrow';
import { isArweaveId } from 'helpers/arweave-id';
import { useMessages } from 'providers/LanguageProvider';

import { DISPATCH_MESSAGES } from '../../../messages';
import { TokenDispatch } from '../TokenDispatch';

export default function HolderDispatch() {
	const messages = useMessages(DISPATCH_MESSAGES);
	const params = useParams();
	const processId = params.processId ?? '';

	if (!isArweaveId(processId)) {
		return (
			<section className="create-page dispatch-page">
				<div className="create-heading">
					<div>
						<Eyebrow>{messages.dispatchEyebrow}</Eyebrow>
						<h1>{messages.dispatchUnknownTokenTitle}</h1>
					</div>
					<p>{messages.dispatchUnknownTokenDetail}</p>
				</div>
			</section>
		);
	}

	// A different token in the URL starts a fresh dispatch: its saved plan, state reads, and run never mix.
	return <TokenDispatch key={processId} processId={processId} />;
}
