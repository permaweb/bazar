import React from 'react';

const strings: Record<string, string> = {
	transaction: 'Transaction',
	transactionSyncRacePrototypeInfinityCable: 'Network synchronization',
	transactionSyncLaneConfirmed: 'confirmed',
	transactionSyncLaneConnecting: 'connecting',
	transactionSyncLanePending: 'pending',
	transactionSyncLaneRecovered: 'recovered',
	transactionSyncLaneReorged: 'reorganized',
	transactionSyncLaneUnavailable: 'unavailable',
	transactionSyncLaneWaiting: 'waiting',
	transactionSyncProtocolTelemetry: 'Network consensus',
	transactionSyncProtocolLive: 'Live',
	transactionSyncProtocolHttp: 'HTTP 404 {notFound} · 202 {pending} · 200 {confirmed} · errors {errors}',
	transactionSyncProtocolRecent: 'Recent network activity',
	transactionSyncProtocolAgreement: 'Network agreement',
	transactionSyncProtocolConfirmationEvents: 'Confirmation updates',
	transactionSyncProtocolDiscoveredBy: 'Discovered by {observer}',
	transactionSyncProtocolLatestResponse: 'Latest response',
	transactionSyncProtocolObserver: 'observer',
	transactionSyncProtocolObservers: 'Observers',
	transactionSyncProtocolPhase: 'Current phase',
	transactionSyncProtocolResponseRate: 'Responses / sec',
	transactionSyncProtocolResponses: 'Responses',
	transactionSyncProtocolSecondsAgo: '{seconds}s ago',
	transactionSyncProtocolStateChanges: 'State changes',
	transactionSyncProtocolUnknown: 'Unknown',
	transactionSyncActivityConfirmation: 'Confirmation',
	transactionSyncActivityError: 'Error',
	transactionSyncActivityProof: 'Block proof',
	transactionSyncActivityStatus: 'Status',
	transactionSyncForkDaily: 'At depth 2, forks occur approximately once per day.',
	transactionSyncForkMonthly: 'At depth 3, forks occur approximately once per month.',
	transactionSyncForkTwoYears: 'At depth 4+, forks occur approximately once every two years.',
	transactionSyncMiningAccepted: 'Accepted block proofs',
	transactionSyncMiningAgeDays: '{value} days',
	transactionSyncMiningAgeHours: '{value} hours',
	transactionSyncMiningAgeYears: '{value} years',
	transactionSyncMiningAverage: 'Average candidates / sec',
	transactionSyncMiningBlockLabel: 'Block {height}',
	transactionSyncMiningCandidateTotal: 'Candidates checked since start',
	transactionSyncMiningChecking: 'Sampling live mining activity',
	transactionSyncMiningContentData: 'Arweave data',
	transactionSyncMiningDataUnknown: 'Data details unavailable',
	transactionSyncMiningDiskRate: 'Average disk bytes checked / sec',
	transactionSyncMiningDiskTotal: 'Disk bytes checked since start',
	transactionSyncMiningPinOffset: 'Recall offset {offset}',
	transactionSyncMiningPinProofMeta: '{proofs} PoA · {proofBytes} · VDF {step}',
	transactionSyncMiningPinRecallMeta: '{age} · block {height}',
	transactionSyncMiningProofDetail: 'Block {height} · {proofs} proofs',
	transactionSyncMiningRecallDetail: 'Recall {index}: offset {offset}',
	transactionSyncMiningSource: 'source block',
	transactionSyncMiningTelemetry: 'Arweave protocol',
	transactionSyncMiningUnavailable: 'Mining activity unavailable',
	transactionSyncObserverLatency: '{latency} ms',
	transactionSyncProofBlockId: 'Block {id}',
	transactionSyncProofCheckedHeight: 'checked at {height}',
	transactionSyncProofHttpStatus: 'HTTP {status}',
	transactionSyncProofMinedAtHeight: 'mined at {height}',
	transactionSyncProofObserved: 'observed',
	transactionSyncProtocolActivity: 'activity',
};

const LanguageContext = React.createContext({ strings });

export function LanguageProvider({ children }: React.PropsWithChildren) {
	return <LanguageContext.Provider value={{ strings }}>{children}</LanguageContext.Provider>;
}

export function useLanguageProvider() {
	return React.useContext(LanguageContext);
}
