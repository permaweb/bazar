-- I Survived AO Testnet - 1984 Campaign Claim Handler
-- ADD THIS TO THE BOTTOM OF YOUR ATOMIC ASSET PROCESS
-- Process ID: rSehf8qeKDDDnrnOiwKT_NWSCFED_q5PouLpXMNHxl8

-- Load dependencies
-- Note: Your main process has these as 'local', so we need to require them again here
local json = require('json')
local bint = require('.bint')(256)

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

-- Campaign Utils
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

			-- Check if already claimed
			if hasAlreadyClaimed(walletAddress) then
				print('Already claimed: ' .. walletAddress)
				msg.reply({
					Action = 'Claim-Error',
					Tags = {
						Status = 'Already-Claimed',
						Message = 'You have already claimed your asset'
					}
				})
				return
			end

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

