# AOS Integration Commands Reference

This guide provides a comprehensive reference for AOS commands used in Bazar, particularly focusing on collection management.

## Collection Management Commands

### Remove Collection

Removes a collection from the registry. This action can only be performed by the collection creator.

```lua
Send({
  Target = "COLLECTIONS_REGISTRY",
  Action = "Remove-Collection",
  Tags = {
    CollectionId = "<collection-id>"
  }
})
```

**Parameters:**

- `CollectionId`: The unique identifier of the collection to remove

**Authorization:**

- Only the collection creator can remove their collection
- The process owner also has removal privileges

**Response:**

- Success: Returns `"Success"` message
- Error: Returns error message if:
  - Collection not found
  - Unauthorized (not the creator)
  - Other validation errors

### Add Collection

Creates a new collection in the registry.

```lua
Send({
  Target = "COLLECTIONS_REGISTRY",
  Action = "Add-Collection",
  Name = "<collection-name>",
  Description = "<collection-description>"
})
```

**Parameters:**

- `Name`: The name of the collection
- `Description`: A description of the collection

**Response:**

- Success: Returns collection ID and confirmation
- Error: Returns error message if validation fails

### Get Collections By User

Retrieves all collections owned by a specific user.

```lua
Send({
  Target = "COLLECTIONS_REGISTRY",
  Action = "Get-Collections-By-User",
  Creator = "<creator-address>"
})
```

**Parameters:**

- `Creator`: The address of the collection creator

**Response:**

- Returns a JSON object containing an array of collections

## Best Practices

1. **Error Handling**

   - Always check response messages for errors
   - Implement proper error handling in your integration

2. **Authorization**

   - Ensure proper wallet connection before sending commands
   - Verify user permissions before attempting operations

3. **Data Validation**
   - Validate all input parameters before sending commands
   - Follow proper data formatting guidelines

## Integration Examples

Here's a complete example of integrating collection management:

```javascript
// Remove a collection
async function removeCollection(collectionId) {
	try {
		const response = await aos.send({
			Target: 'COLLECTIONS_REGISTRY',
			Action: 'Remove-Collection',
			Tags: {
				CollectionId: collectionId,
			},
		});

		if (response.Output.data === 'Success') {
			console.log('Collection removed successfully');
		} else {
			console.error('Failed to remove collection:', response.Output.data);
		}
	} catch (error) {
		console.error('Error removing collection:', error);
	}
}
```

## Additional Resources

- [AOS Documentation](https://github.com/permaweb/aos)
- [AO Cookbook](https://cookbook_ao.arweave.net/welcome/getting-started.html)
- [What are Handlers?](https://cookbook_ao.arweave.net/guides/aos/inbox-and-handlers.html#what-are-handlers)
