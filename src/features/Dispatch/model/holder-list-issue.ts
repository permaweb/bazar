import type { HolderListIssue, HolderListSource } from 'api/dispatch';

import { formatMessage } from 'helpers/i18n';

import type { DispatchMessages } from '../messages';
import type { PluralFormatter } from '../types';

function sourceLabel(source: HolderListSource, messages: DispatchMessages): string {
	return formatMessage(source.kind === 'entry' ? messages.holderListEntrySource : messages.holderListLineSource, {
		number: source.number,
	});
}

/** Copy for one holder-list parse or validation issue reported by the dispatch adapter. */
export function holderListIssueMessage(
	issue: HolderListIssue,
	messages: DispatchMessages,
	plural: PluralFormatter
): string {
	switch (issue.code) {
		case 'list-empty':
			return messages.holderListEmpty;
		case 'list-without-entries':
			return messages.holderListWithoutEntries;
		case 'duplicate-addresses':
			return plural(messages.holderListDuplicateAddresses, issue.addresses.length, {
				addresses: issue.addresses.join(', '),
			});
		case 'invalid-json':
			return messages.holderListInvalidJson;
		case 'invalid-json-root':
			return messages.holderListInvalidJsonRoot;
		case 'invalid-entry-shape':
			return formatMessage(messages.holderListInvalidEntryShape, {
				source: sourceLabel(issue.source, messages),
			});
		case 'invalid-line-shape':
			return formatMessage(messages.holderListInvalidLineShape, {
				source: sourceLabel(issue.source, messages),
			});
		case 'invalid-address':
			return formatMessage(messages.holderListInvalidAddress, {
				source: sourceLabel(issue.source, messages),
				value: issue.value,
			});
		case 'invalid-quantity':
			return formatMessage(
				issue.denomination
					? messages.holderListInvalidQuantityDecimals
					: messages.holderListInvalidQuantityWhole,
				{ source: sourceLabel(issue.source, messages), denomination: issue.denomination }
			);
	}
}
