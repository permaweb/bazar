-- Handler code to be eval'd into existing collections for Banner/Thumbnail updates
-- Update Banner
Handlers.add('Banner', Handlers.utils.hasMatchingTag('Action', 'Banner'), function(msg)
	if msg.From ~= Creator and msg.From ~= ao.id then
		ao.send({
			Target = msg.From,
			Action = 'Authorization-Error',
			Tags = {
				Status = 'Error',
				Message = 'Unauthorized to access this handler'
			}
		})
		return
	end

	if msg.Data and checkValidAddress(msg.Data) then
		Banner = msg.Data
		LastUpdate = tostring(msg.Timestamp)

		ao.send({
			Target = msg.From,
			Action = 'Action-Response',
			Tags = {
				Status = 'Success',
				Message = 'Banner updated successfully'
			}
		})

		syncState()
	else
		ao.send({
			Target = msg.From,
			Action = 'Input-Error',
			Tags = {
				Status = 'Error',
				Message = 'Invalid Banner transaction ID'
			}
		})
	end
end)

-- Update Thumbnail
Handlers.add('Thumbnail', Handlers.utils.hasMatchingTag('Action', 'Thumbnail'), function(msg)
	if msg.From ~= Creator and msg.From ~= ao.id then
		ao.send({
			Target = msg.From,
			Action = 'Authorization-Error',
			Tags = {
				Status = 'Error',
				Message = 'Unauthorized to access this handler'
			}
		})
		return
	end

	if msg.Data and checkValidAddress(msg.Data) then
		Thumbnail = msg.Data
		LastUpdate = tostring(msg.Timestamp)

		ao.send({
			Target = msg.From,
			Action = 'Action-Response',
			Tags = {
				Status = 'Success',
				Message = 'Thumbnail updated successfully'
			}
		})

		syncState()
	else
		ao.send({
			Target = msg.From,
			Action = 'Input-Error',
			Tags = {
				Status = 'Error',
				Message = 'Invalid Thumbnail transaction ID'
			}
		})
	end
end)




