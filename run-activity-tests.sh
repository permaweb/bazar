#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Starting activity tests..."

# Run the TypeScript tests
npx ts-node test/test-graphql-activity.ts

# Check if the tests were successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}All tests passed successfully!${NC}"
else
    echo -e "${RED}Tests failed. Please check the output above for errors.${NC}"
    exit 1
fi 