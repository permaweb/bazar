import { message } from '@permaweb/aoconnect';
import { createDataItemSigner } from 'helpers/aoconnect';

/**
 * Updates an existing zone process to add Update-Assets to ForwardActions
 * This injects the fix into the Permissions table via Eval
 *
 * @param args.zoneProcessId - The zone process ID (same as profile ID)
 * @param args.wallet - The owner wallet (must be the zone owner)
 * @returns Promise with the message ID
 */
export async function updateZoneProcessForwardActions(args: { zoneProcessId: string; wallet: any }): Promise<string> {
	try {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:updateZoneProcessForwardActions',
				message: 'Starting zone process update',
				data: {
					zoneProcessId: args.zoneProcessId,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'U',
			}),
		}).catch(() => {});
		// #endregion

		// Lua code to inject Update-Assets into ForwardActions
		const evalCode = `
-- Add Update-Assets to ForwardActions if not already present
if Permissions and Permissions['Run-Action'] and Permissions['Run-Action'].ForwardActions then
    local forwardActions = Permissions['Run-Action'].ForwardActions
    
    -- Check if Update-Assets already exists
    if not forwardActions['Update-Assets'] then
        -- Add Update-Assets with same roles as Update-Asset
        forwardActions['Update-Assets'] = {
            Zone.RoleOptions.Admin,
            Zone.RoleOptions.Moderator,
            Zone.RoleOptions.Contributor,
        }
        
        -- Sync state to HyperBEAM
        local json = require('json')
        SyncState(nil)
        
        -- Return success
        ao.send({
            Target = ao.id,
            Action = 'Zone-Update-Complete',
            Tags = {
                Status = 'Success',
                Message = 'Update-Assets added to ForwardActions'
            }
        })
    else
        -- Already exists
        ao.send({
            Target = ao.id,
            Action = 'Zone-Update-Complete',
            Tags = {
                Status = 'Info',
                Message = 'Update-Assets already in ForwardActions'
            }
        })
    end
else
    -- Permissions structure not found
    ao.send({
        Target = ao.id,
        Action = 'Zone-Update-Error',
        Tags = {
            Status = 'Error',
            Message = 'Permissions structure not found'
        }
    })
end
`;

		const signer = createDataItemSigner(args.wallet);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:updateZoneProcessForwardActions',
				message: 'Sending Eval message to zone process',
				data: {
					zoneProcessId: args.zoneProcessId,
					evalCodeLength: evalCode.length,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'U',
			}),
		}).catch(() => {});
		// #endregion

		const messageId = await message({
			process: args.zoneProcessId,
			signer: signer,
			tags: [{ name: 'Action', value: 'Eval' }],
			data: evalCode,
		});

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:updateZoneProcessForwardActions',
				message: 'Eval message sent successfully',
				data: {
					zoneProcessId: args.zoneProcessId,
					messageId,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'U',
			}),
		}).catch(() => {});
		// #endregion

		return messageId;
	} catch (error: any) {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:updateZoneProcessForwardActions',
				message: 'Error updating zone process',
				data: {
					zoneProcessId: args.zoneProcessId,
					error: error.message,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'U',
			}),
		}).catch(() => {});
		// #endregion
		throw error;
	}
}

/**
 * Gets the zone process ID for a wallet address
 * The zone process ID is the same as the profile ID
 *
 * @param args.walletAddress - The wallet address
 * @param args.libs - permaweb-libs instance
 * @returns Promise with the zone/profile ID or null
 */
export async function getZoneProcessId(args: { walletAddress: string; libs: any }): Promise<string | null> {
	try {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:getZoneProcessId',
				message: 'Fetching zone process ID',
				data: {
					walletAddress: args.walletAddress,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'V',
			}),
		}).catch(() => {});
		// #endregion

		const profile = await args.libs.getProfileByWalletAddress(args.walletAddress);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:getZoneProcessId',
				message: 'Zone process ID fetched',
				data: {
					walletAddress: args.walletAddress,
					profileId: profile?.id || null,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'V',
			}),
		}).catch(() => {});
		// #endregion

		return profile?.id || null;
	} catch (error: any) {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'updateZoneProcess.ts:getZoneProcessId',
				message: 'Error fetching zone process ID',
				data: {
					walletAddress: args.walletAddress,
					error: error.message,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run8',
				hypothesisId: 'V',
			}),
		}).catch(() => {});
		// #endregion
		throw error;
	}
}
