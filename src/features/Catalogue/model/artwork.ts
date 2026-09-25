import { audioFormatLabel } from 'helpers/asset-media';
import { formatMessage } from 'helpers/i18n';

import type { CatalogueMessages } from '../messages';

/** The accessible name of an audio asset's artwork placeholder; the shared atom cannot read the language provider. */
export function audioArtworkLabel(asset: { contentType?: string; name: string }, messages: CatalogueMessages): string {
	return formatMessage(messages.catalogueAudioArtworkLabel, {
		format: audioFormatLabel(asset.contentType),
		name: asset.name,
	});
}
