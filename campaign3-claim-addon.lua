-- I Survived AO Testnet - 1984 Campaign Claim Handler
-- ADD THIS TO THE BOTTOM OF YOUR ATOMIC ASSET PROCESS
-- Process ID: rSehf8qeKDDDnrnOiwKT_NWSCFED_q5PouLpXMNHxl8

-- Load dependencies
-- Note: Your main process has these as 'local', so we need to require them again here
local json = require('json')

-- bint should be available from the main process blueprint
-- Try to use it from global scope first, otherwise require it
local bint
if type(_G.bint) == 'function' then
	bint = _G.bint
else
	local bintSuccess, bintResult = pcall(function() return require('.bint')(256) end)
	if bintSuccess and bintResult then
		bint = bintResult
	else
		print('WARNING: bint not available, some functions may not work')
		bint = nil
	end
end

-- Utility functions (define if not already available)
-- Note: The standard blueprint defines these as 'local', so we need to define them globally
-- for our handlers to access them. If they already exist globally, we won't override them.
if not _G.decodeMessageData then
	_G.decodeMessageData = function(data)
		if not data or data == '' then
			return false, nil
		end
		local status, decodedData = pcall(json.decode, data)
		if not status or type(decodedData) ~= 'table' then
			return false, nil
		end
		return true, decodedData
	end
end

if not _G.checkValidAddress then
	_G.checkValidAddress = function(address)
		if not address or type(address) ~= 'string' then
			return false
		end
		return string.match(address, '^[%w%-_]+$') ~= nil and #address == 43
	end
end

if not _G.checkValidAmount then
	_G.checkValidAmount = function(data)
		if not data then
			return false
		end
		-- Match the standard blueprint's checkValidAmount implementation
		return (math.type(tonumber(data)) == 'integer' or math.type(tonumber(data)) == 'float') and bint(data) > bint(0)
	end
end

if not _G.syncState then
	_G.syncState = function()
		-- Try to use the standard blueprint's syncState pattern if available
		-- The standard blueprint uses: Send({ device = 'patch@1.0', asset = json.encode(getState()) })
		if type(Send) == 'function' and Token and json then
			local state = {
				Name = Token.Name,
				Ticker = Token.Ticker,
				Denomination = tostring(Token.Denomination),
				Balances = Token.Balances,
				TotalSupply = Token.TotalSupply,
				Transferable = Token.Transferable,
				Creator = Token.Creator,
				Metadata = Metadata or {},
				AuthUsers = AuthUsers or {},
				IndexRecipients = IndexRecipients or {},
				DateCreated = DateCreated and tostring(DateCreated) or nil,
				LastUpdate = LastUpdate and tostring(LastUpdate) or nil,
			}
			Send({ device = 'patch@1.0', asset = json.encode(state) })
		else
			-- If Send is not available, the blueprint's syncState might handle it
			-- This is a no-op fallback
			print('State sync called (Send function not available)')
		end
	end
end

-- Make functions available without _G prefix for easier access
decodeMessageData = _G.decodeMessageData
checkValidAddress = _G.checkValidAddress
checkValidAmount = _G.checkValidAmount
syncState = _G.syncState

-- Campaign State
if not CampaignConfig then
	CampaignConfig = {
		TotalSupply = 1984,
		RequiredCount = 2, -- Must meet at least 2 requirements
		Name = 'I Survived AO Testnet',
	}
end

if not Claims then Claims = {} end

-- Campaign Utils (define these first, before ensureOwnerBalance)
local function countMetRequirements(requirements)
	local count = 0
	if requirements.bazarTransaction then count = count + 1 end
	if requirements.botegaSwap then count = count + 1 end
	if requirements.permaswapTransaction then count = count + 1 end
	if requirements.aoProcess then count = count + 1 end
	return count
end

local function hasAlreadyClaimed(address)
	return Claims[address] ~= nil
end

-- Check if profile has already claimed (additional safety check)
local function hasProfileClaimed(profileId)
	if not Claims or not profileId then
		return false, nil
	end
	for walletAddr, claimData in pairs(Claims) do
		if claimData and claimData.ProfileId == profileId then
			return true, walletAddr
		end
	end
	return false, nil
end

local function getRemainingSupply()
	local claimedCount = 0
	for _ in pairs(Claims) do
		claimedCount = claimedCount + 1
	end
	return CampaignConfig.TotalSupply - claimedCount
end

local function getOwnerBalance()
	-- The Creator holds all unclaimed assets (standard blueprint initializes Creator with TotalSupply)
	-- Owner might not be set, so we use Creator as the source
	local owner = Owner or Token.Creator
	if not owner then
		return '0'
	end
	return Token.Balances[owner] or '0'
end

-- Initialize Owner balance if missing (fix for processes that weren't initialized correctly)
local function ensureOwnerBalance()
	-- Safety check: ensure Token exists
	if not Token then
		print('WARNING: Token not initialized yet, skipping balance check')
		return false
	end
	
	local owner = Owner or Token.Creator
	if not owner then
		print('WARNING: No Owner or Creator found, cannot initialize balance')
		return false
	end
	
	-- Check if owner has balance
	local ownerBalance = getOwnerBalance()
	
	-- Safety check: ensure bint is available
	if not bint then
		-- Try to use the global bint if available
		if type(_G.bint) == 'function' then
			bint = _G.bint
		else
			print('WARNING: bint not available, skipping balance initialization')
			return false
		end
	end
	
	local ownerBalanceBint = bint(ownerBalance)
	
	if ownerBalanceBint <= bint(0) then
		print('WARNING: Owner balance is 0, initializing with TotalSupply...')
		print('Owner: ' .. tostring(owner))
		print('TotalSupply: ' .. tostring(CampaignConfig.TotalSupply))
		
		-- Initialize balances if needed
		if not Token.Balances then
			Token.Balances = {}
		end
		
		-- Set owner balance to TotalSupply
		Token.Balances[owner] = tostring(CampaignConfig.TotalSupply)
		Token.TotalSupply = tostring(CampaignConfig.TotalSupply)
		
		-- Ensure Token.Creator is set
		if not Token.Creator then
			Token.Creator = owner
		end
		
		print('Owner balance initialized to: ' .. tostring(Token.Balances[owner]))
		-- Try to sync state, but don't fail if it doesn't work
		local syncSuccess, syncErr = pcall(syncState)
		if not syncSuccess then
			print('WARNING: State sync failed during initialization: ' .. tostring(syncErr))
		end
		return true
	end
	
	return false
end

-- Run initialization check on load (with error handling)
-- Defer initialization to avoid errors during module load
local function runInitialization()
	local initSuccess, initErr = pcall(ensureOwnerBalance)
	if not initSuccess then
		print('WARNING: Balance initialization check failed: ' .. tostring(initErr))
	end
end

-- Run initialization safely
local initSuccess, initErr = pcall(runInitialization)
if not initSuccess then
	print('WARNING: Failed to run initialization: ' .. tostring(initErr))
end

-- Handler: Get claim status
Handlers.add(
	'Get-Claim-Status',
	Handlers.utils.hasMatchingTag('Action', 'Get-Claim-Status'),
	function(msg)
		local address = msg.From
		if msg.Tags['Wallet-Address'] then
			address = msg.Tags['Wallet-Address']
		end

		-- Check if already claimed
		if hasAlreadyClaimed(address) then
			msg.reply({
				Action = 'Claim-Status-Response',
				Tags = {
					Status = 'Already-Claimed',
					ClaimedAt = tostring(Claims[address].Timestamp)
				}
			})
			return
		end

		-- Check remaining supply
		local remaining = getRemainingSupply()
		if remaining <= 0 then
			msg.reply({
				Action = 'Claim-Status-Response',
				Tags = {
					Status = 'Sold-Out',
					Message = 'All 1984 assets have been claimed'
				}
			})
			return
		end

		msg.reply({
			Action = 'Claim-Status-Response',
			Tags = {
				Status = 'Available',
				Remaining = tostring(remaining),
				Total = tostring(CampaignConfig.TotalSupply)
			}
		})
	end
)

-- Handler: Get campaign stats
Handlers.add(
	'Get-Campaign-Stats',
	Handlers.utils.hasMatchingTag('Action', 'Get-Campaign-Stats'),
	function(msg)
		local claimedCount = 0
		for _ in pairs(Claims) do
			claimedCount = claimedCount + 1
		end

		msg.reply({
			Action = 'Campaign-Stats-Response',
			Data = json.encode({
				TotalSupply = CampaignConfig.TotalSupply,
				Claimed = claimedCount,
				Remaining = CampaignConfig.TotalSupply - claimedCount,
				OwnerBalance = getOwnerBalance()
			})
		})
	end
)

-- Handler: Process campaign claim
Handlers.add(
	'Claim',
	Handlers.utils.hasMatchingTag('Action', 'Claim'),
	function(msg)
		print('=== CLAIM HANDLER TRIGGERED ===')
		print('Processing campaign claim from: ' .. msg.From)
		print('Message Data: ' .. tostring(msg.Data))
		print('Message Tags:')
		for k, v in pairs(msg.Tags) do
			print('  ' .. k .. ' = ' .. tostring(v))
		end
		
		-- Use xpcall to catch errors and ensure we always reply
		local function claimHandler()
			-- Ensure Claims table exists
			if not Claims then
				print('WARNING: Claims table is nil at handler start, initializing...')
				Claims = {}
			end
			
			-- Parse requirements data
			local decodeSuccess, data = decodeMessageData(msg.Data)
			if not decodeSuccess or not data or not data.requirements then
				print('Invalid claim data')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'Invalid claim data'
					}
				})
				return
			end

			local walletAddress = msg.Tags['Wallet-Address'] or msg.From
			local recipient = data.recipient or msg.Tags.Recipient
			
			print('=== DUPLICATE CHECK START ===')
			print('Wallet Address: ' .. tostring(walletAddress))
			print('Recipient/Profile: ' .. tostring(recipient))
			print('Message From: ' .. tostring(msg.From))

			if not recipient then
				print('No recipient specified')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'No recipient profile specified'
					}
				})
				return
			end

			-- Validate recipient address
			if not checkValidAddress(recipient) then
				print('Invalid recipient address')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'Invalid recipient address'
					}
				})
				return
			end

			-- Check if already claimed by wallet address
			print('=== DUPLICATE CHECK ===')
			print('Checking duplicate claim for wallet: ' .. walletAddress)
			if not Claims then
				print('WARNING: Claims table is nil, initializing...')
				Claims = {}
			end
			local claimsCount = 0
			for k, v in pairs(Claims) do 
				claimsCount = claimsCount + 1
				local encodeSuccess, encoded = pcall(json.encode, v)
				if encodeSuccess then
					print('  Claims[' .. tostring(k) .. '] = ' .. encoded)
				else
					print('  Claims[' .. tostring(k) .. '] = [unable to encode]')
				end
			end
			print('Current Claims table size: ' .. tostring(claimsCount))
			print('Checking if wallet exists in Claims: ' .. tostring(Claims[walletAddress] ~= nil))
			print('Wallet address type: ' .. type(walletAddress))
			print('Wallet address value: "' .. tostring(walletAddress) .. '"')
			
			-- Check all keys in Claims to see if there's a match
			for key, _ in pairs(Claims) do
				print('  Comparing: "' .. tostring(key) .. '" == "' .. tostring(walletAddress) .. '" = ' .. tostring(key == walletAddress))
			end
			
			if hasAlreadyClaimed(walletAddress) then
				print('*** ALREADY CLAIMED by wallet: ' .. walletAddress .. ' ***')
				local encodeSuccess, encoded = pcall(json.encode, Claims[walletAddress])
				if encodeSuccess then
					print('Existing claim data: ' .. encoded)
				else
					print('Existing claim data: [unable to encode]')
				end
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Already-Claimed',
						Message = 'You have already claimed your asset'
					}
				})
				return
			end
			print('Wallet NOT found in Claims, proceeding...')
			
			-- Additional check: prevent same profile from claiming multiple times
			local profileAlreadyClaimed, existingWallet = hasProfileClaimed(recipient)
			if profileAlreadyClaimed then
				print('ALREADY CLAIMED by profile: ' .. recipient .. ' (by wallet: ' .. existingWallet .. ')')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Already-Claimed',
						Message = 'This profile has already claimed an asset'
					}
				})
				return
			end
			
			print('No duplicate found, proceeding with claim...')

			-- Check supply
			local remaining = getRemainingSupply()
			if remaining <= 0 then
				print('Supply exhausted')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Sold-Out',
						Message = 'All 1984 assets have been claimed'
					}
				})
				return
			end

		-- Ensure owner balance is initialized (fix for processes that weren't initialized correctly)
		ensureOwnerBalance()
		
		-- Check owner has balance (this check is done again in the transfer section, but we check early here)
		local ownerBalance = getOwnerBalance()
		local ownerBalanceBint = bint(ownerBalance)
		if ownerBalanceBint <= bint(0) then
			print('Owner has no balance to distribute. Balance: ' .. tostring(ownerBalance))
			print('Owner address: ' .. tostring(Owner or Token.Creator))
			print('Token.Balances: ' .. json.encode(Token.Balances))
			msg.reply({
				Action = 'Claim-Error',
				Tags = {
					Status = 'Error',
					Message = 'No assets available to claim'
				}
			})
			return
		end

			-- Verify requirements
			local metCount = countMetRequirements(data.requirements)
			print('Requirements met: ' .. tostring(metCount) .. '/' .. tostring(CampaignConfig.RequiredCount))

			if metCount < CampaignConfig.RequiredCount then
				print('Insufficient requirements')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Requirements-Not-Met',
						Message = 'You must meet at least ' .. tostring(CampaignConfig.RequiredCount) .. ' requirements to claim'
					}
				})
				return
			end

			-- Process the claim - Transfer from Owner/Creator to recipient
			print('Claim approved for: ' .. walletAddress .. ' -> ' .. recipient)

			-- Determine the owner (Owner or Creator)
			local owner = Owner or Token.Creator
			if not owner then
				print('ERROR: No Owner or Creator found')
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'Asset configuration error: No owner found'
					}
				})
				return
			end

			-- Initialize balances if needed
			if not Token.Balances[owner] then
				Token.Balances[owner] = '0'
			end
			if not Token.Balances[recipient] then
				Token.Balances[recipient] = '0'
			end

			-- Check owner has sufficient balance
			local ownerBalance = bint(Token.Balances[owner])
			if ownerBalance <= bint(0) then
				print('Owner has insufficient balance: ' .. tostring(Token.Balances[owner]))
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'No assets available to claim'
					}
				})
				return
			end

			-- Transfer 1 token from owner to recipient
			Token.Balances[owner] = tostring(ownerBalance - bint(1))
			Token.Balances[recipient] = tostring(bint(Token.Balances[recipient]) + bint(1))

			-- Clean up zero balances
			if bint(Token.Balances[owner]) <= bint(0) then
				Token.Balances[owner] = nil
			end
			if bint(Token.Balances[recipient]) <= bint(0) then
				Token.Balances[recipient] = nil
			end

			-- Record claim
			Claims[walletAddress] = {
				Timestamp = msg.Timestamp,
				WalletAddress = walletAddress,
				ProfileId = recipient,
				Requirements = data.requirements,
				MetCount = metCount
			}
			
			print('Claim recorded in Claims table for wallet: ' .. walletAddress)
			local claimsCount = 0
			for _ in pairs(Claims) do claimsCount = claimsCount + 1 end
			print('Claims table now has ' .. tostring(claimsCount) .. ' entries')

			-- Send credit notice to recipient
			ao.send({
				Target = recipient,
				Action = 'Credit-Notice',
				Tags = {
					Status = 'Success',
					Message = 'I Survived AO Testnet asset claimed!',
					Sender = ao.id,
					Quantity = '1',
					['X-Claim-Campaign'] = 'I-Survived-AO-Testnet',
					['X-Claim-Wallet'] = walletAddress
				},
				Data = json.encode({
					Sender = ao.id,
					Quantity = '1'
				})
			})

			-- Send success response
			msg.reply({
				Action = 'Claim-Success',
				Data = json.encode({
					message = 'Successfully claimed your I Survived AO Testnet asset!',
					recipient = recipient,
					assetId = ao.id,
					remaining = remaining - 1,
					claimedAt = msg.Timestamp
				}),
				Tags = {
					Status = 'Claimed',
					Recipient = recipient,
					['Asset-ID'] = ao.id
				}
			})

			-- Sync state with HyperBEAM
			syncState()

			print('Claim processed successfully')
		end
		
		-- Error handler for xpcall
		local function errorHandler(err)
			print('ERROR in claim handler: ' .. tostring(err))
			if debug and debug.traceback then
				print(debug.traceback())
			end
			-- Ensure we always reply, even on error
			local replySuccess, replyErr = pcall(function()
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Error',
						Message = 'Internal error: ' .. tostring(err)
					}
				})
			end)
			if not replySuccess then
				print('Failed to send error reply: ' .. tostring(replyErr))
			end
		end
		
		-- Execute handler with error catching
		local success, result = xpcall(claimHandler, errorHandler)
		if not success then
			-- Error handler should have replied, but double-check
			print('Claim handler failed, error response should have been sent')
		end
	end
)

-- Handler: Admin - Initialize Owner Balance (fix for processes that weren't initialized correctly)
Handlers.add(
	'Initialize-Owner-Balance',
	Handlers.utils.hasMatchingTag('Action', 'Initialize-Owner-Balance'),
	function(msg)
		-- Only owner can initialize balance
		local owner = Owner or Token.Creator
		if msg.From ~= owner then
			msg.reply({
				Action = 'Authorization-Error',
				Tags = {
					Status = 'Error',
					Message = 'Only the process owner can initialize balance'
				}
			})
			return
		end

		local wasInitialized = ensureOwnerBalance()
		local currentBalance = getOwnerBalance()
		
		msg.reply({
			Action = 'Initialize-Balance-Response',
			Data = json.encode({
				initialized = wasInitialized,
				ownerBalance = currentBalance,
				totalSupply = CampaignConfig.TotalSupply,
				owner = owner
			}),
			Tags = {
				Status = wasInitialized and 'Initialized' or 'Already-Initialized',
				Message = wasInitialized and 'Owner balance initialized' or 'Owner balance already set'
			}
		})
	end
)

-- Handler: Admin - Get all claims
Handlers.add(
	'Get-All-Claims',
	Handlers.utils.hasMatchingTag('Action', 'Get-All-Claims'),
	function(msg)
		-- Only owner can view all claims
		if msg.From ~= Owner then
			msg.reply({
				Action = 'Authorization-Error',
				Tags = {
					Status = 'Error',
					Message = 'Only the process owner can view all claims'
				}
			})
			return
		end

		msg.reply({
			Action = 'All-Claims-Response',
			Data = json.encode(Claims)
		})
	end
)

print('Campaign Claim Handlers Loaded!')
print('Total Supply: ' .. tostring(CampaignConfig.TotalSupply))
print('Required Met Count: ' .. tostring(CampaignConfig.RequiredCount))

