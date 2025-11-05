-- I Survived AO Testnet - 1984 Campaign Claim Handler
-- ADD THIS TO THE BOTTOM OF YOUR ATOMIC ASSET PROCESS
-- Process ID: rSehf8qeKDDDnrnOiwKT_NWSCFED_q5PouLpXMNHxl8

-- Load dependencies
-- Note: Your main process has these as 'local', so we need to require them again here
local json = require('json')
local bint = require('.bint')(256)

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
	-- The Owner holds all unclaimed assets
	return Token.Balances[Owner] or '0'
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
		print('Processing campaign claim from: ' .. msg.From)

		-- Parse requirements data
		local success, data = decodeMessageData(msg.Data)
		if not success or not data or not data.requirements then
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

		-- Check owner has balance
		local ownerBalance = getOwnerBalance()
		if not checkValidAmount(ownerBalance) or bint(ownerBalance) <= bint(0) then
			print('Owner has no balance to distribute')
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

		-- Process the claim - Transfer from Owner to recipient
		print('Claim approved for: ' .. walletAddress .. ' -> ' .. recipient)

		-- Initialize recipient balance if needed
		if not Token.Balances[recipient] then
			Token.Balances[recipient] = '0'
		end

		-- Transfer 1 token from Owner to recipient
		Token.Balances[Owner] = tostring(bint(Token.Balances[Owner]) - bint(1))
		Token.Balances[recipient] = tostring(bint(Token.Balances[recipient]) + bint(1))

		-- Clean up zero balances
		if bint(Token.Balances[Owner]) <= bint(0) then
			Token.Balances[Owner] = nil
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

