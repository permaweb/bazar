import React from 'react';
import { useParams } from 'react-router-dom';

import { Eyebrow } from 'components/atoms/Eyebrow';
import { isArweaveId } from 'helpers/arweave-id';
import { useMessages } from 'providers/LanguageProvider';

import { DISPATCH_MESSAGES } from '../../../messages';
import { TokenDispatch } from '../TokenDispatch';

import * as S from './styles';

export default function HolderDispatch() {
	const messages = useMessages(DISPATCH_MESSAGES);
	const params = useParams();
	const processId = params.processId ?? '';

	if (!isArweaveId(processId)) {
		return (
			<S.Page className="create-page dispatch-page">
				<S.Heading className="create-heading">
					<div>
						<Eyebrow>{messages.dispatchEyebrow}</Eyebrow>
						<h1>{messages.dispatchUnknownTokenTitle}</h1>
					</div>
					<p>{messages.dispatchUnknownTokenDetail}</p>
				</S.Heading>
			</S.Page>
		);
	}

	// A different token in the URL starts a fresh dispatch: its saved plan, state reads, and run never mix.
	return <TokenDispatch key={processId} processId={processId} />;
}
