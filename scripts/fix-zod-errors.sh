#!/bin/bash

# Fix all ZodError.errors references
echo "Fixing ZodError.errors references..."

# Find and replace error.errors with error.format()
find app/api -name "*.ts" -type f -exec sed -i '' 's/error\.errors/error.format()/g' {} \;

# Fix log.error calls with object syntax
echo "Fixing log.error calls..."
find app/api -name "*.ts" -type f -exec sed -i '' 's/log\.error(\(.*\), { error })/log.error(\1, error as Error)/g' {} \;
find app/api -name "*.ts" -type f -exec sed -i '' 's/logger\.error(\(.*\), { error })/logger.error(\1, error as Error)/g' {} \;

echo "Done!"