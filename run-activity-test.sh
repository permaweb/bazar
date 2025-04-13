#!/bin/bash

# Run the GraphQL activity test script
echo "Running GraphQL activity test..."
cd test && npx ts-node test-graphql-activity.ts

# Check if the test was successful
if [ $? -eq 0 ]; then
  echo "Test completed successfully!"
else
  echo "Test failed with an error."
  exit 1
fi 