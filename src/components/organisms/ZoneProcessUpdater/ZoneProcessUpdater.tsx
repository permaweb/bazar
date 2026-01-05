import React from 'react';
import { Button } from 'components/atoms/Button';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { updateZoneProcessForwardActions, getZoneProcessId } from 'helpers/updateZoneProcess';

export default function ZoneProcessUpdater() {
	const arProvider = useArweaveProvider();
	const permawebProvider = usePermawebProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [zoneProcessId, setZoneProcessId] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [status, setStatus] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

	React.useEffect(() => {
		(async () => {
			if (arProvider.walletAddress && permawebProvider.libs) {
				try {
					const zoneId = await getZoneProcessId({
						walletAddress: arProvider.walletAddress,
						libs: permawebProvider.libs,
					});
					setZoneProcessId(zoneId);
				} catch (error) {
					console.error('Error fetching zone process ID:', error);
				}
			}
		})();
	}, [arProvider.walletAddress, permawebProvider.libs]);

	async function handleUpdate() {
		if (!zoneProcessId || !arProvider.wallet) {
			setStatus({
				message: 'Zone process ID not found or wallet not connected',
				type: 'error',
			});
			return;
		}

		setLoading(true);
		setStatus(null);

		try {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'ZoneProcessUpdater.tsx:handleUpdate',
					message: 'User initiated zone process update',
					data: {
						zoneProcessId,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run8',
					hypothesisId: 'W',
				}),
			}).catch(() => {});
			// #endregion

			const messageId = await updateZoneProcessForwardActions({
				zoneProcessId: zoneProcessId,
				wallet: arProvider.wallet,
			});

			setStatus({
				message: `Update message sent successfully! Message ID: ${messageId}. Wait 5-10 seconds and verify.`,
				type: 'success',
			});

			// Verify after 10 seconds
			setTimeout(async () => {
				try {
					const zoneState = await permawebProvider.libs.readProcess({
						processId: zoneProcessId,
						path: 'zone',
						fallbackAction: 'Info',
					});

					const hasUpdateAssets = zoneState?.Permissions?.['Run-Action']?.ForwardActions?.['Update-Assets'];

					if (hasUpdateAssets) {
						setStatus({
							message: '✅ SUCCESS! Update-Assets has been added to ForwardActions.',
							type: 'success',
						});
					} else {
						setStatus({
							message: '⚠️ Update may not have applied. Check zone process state manually.',
							type: 'error',
						});
					}
				} catch (verifyError) {
					console.error('Verification error:', verifyError);
					setStatus({
						message: 'Update sent but verification failed. Check zone process manually.',
						type: 'info',
					});
				}
			}, 10000);
		} catch (error: any) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'ZoneProcessUpdater.tsx:handleUpdate',
					message: 'Zone process update error',
					data: {
						zoneProcessId,
						error: error.message,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run8',
					hypothesisId: 'W',
				}),
			}).catch(() => {});
			// #endregion

			setStatus({
				message: `Error: ${error.message}`,
				type: 'error',
			});
		} finally {
			setLoading(false);
		}
	}

	if (!arProvider.walletAddress) {
		return <div>Please connect your wallet first.</div>;
	}

	return (
		<div style={{ padding: '20px', maxWidth: '600px' }}>
			<h2>Update Zone Process - Add Update-Assets to ForwardActions</h2>

			{zoneProcessId ? (
				<>
					<p>
						<strong>Zone Process ID:</strong> {zoneProcessId}
					</p>
					<p style={{ fontSize: '14px', color: '#666' }}>
						This will add `Update-Assets` to the ForwardActions list in your zone process, allowing collection asset
						updates to work via zone forwarding.
					</p>

					<Button
						type="primary"
						label={loading ? 'Updating...' : 'Update Zone Process'}
						handlePress={handleUpdate}
						disabled={loading}
						loading={loading}
					/>

					{status && (
						<div
							style={{
								marginTop: '20px',
								padding: '10px',
								backgroundColor:
									status.type === 'success' ? '#d4edda' : status.type === 'error' ? '#f8d7da' : '#d1ecf1',
								border: `1px solid ${
									status.type === 'success' ? '#c3e6cb' : status.type === 'error' ? '#f5c6cb' : '#bee5eb'
								}`,
								borderRadius: '4px',
							}}
						>
							{status.message}
						</div>
					)}
				</>
			) : (
				<p>Loading zone process ID...</p>
			)}
		</div>
	);
}
