#!/bin/bash

echo "Fixing rate limit configs..."

# Find all rate limit config declarations and add missing properties
find app/api -name "*.ts" -type f -exec grep -l "RateLimitConfig\|windowMs.*max:" {} \; | while read file; do
    echo "Checking $file"
    
    # Add standardHeaders and legacyHeaders to rate limit configs
    sed -i '' '/windowMs:.*\/\/ /,/max:/ {
        /max:/ a\
  standardHeaders: true,\
  legacyHeaders: false,
    }' "$file" 2>/dev/null || true
done

echo "Done!"