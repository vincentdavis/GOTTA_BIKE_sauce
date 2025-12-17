#!/bin/bash

# Build script for GOTTA.BIKE sauce mod
# Uses date-based versioning: year.month.day.count
# - Automatically increments count if same day
# - Copies required files to build folder
# - Creates zip file for distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Generate date-based version (year.month.day.count)
TODAY=$(date +%Y.%-m.%-d)
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

# Extract date part and count from current version
CURRENT_DATE_PART=$(echo "$CURRENT_VERSION" | cut -d'.' -f1-3)
CURRENT_COUNT=$(echo "$CURRENT_VERSION" | cut -d'.' -f4)

# Determine new version
if [ "$CURRENT_DATE_PART" = "$TODAY" ]; then
    # Same day, increment count
    NEW_COUNT=$((CURRENT_COUNT + 1))
    NEW_VERSION="${TODAY}.${NEW_COUNT}"
else
    # New day, reset count to 1
    NEW_VERSION="${TODAY}.1"
fi

echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"

# Update version in manifest.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
echo "Updated manifest.json"

# Create build directory
BUILD_DIR="build"
FOLDER_NAME="GOTTA_BIKE_sauce"
OUTPUT_DIR="$BUILD_DIR/$FOLDER_NAME"

# Clean up previous build if exists
rm -rf "$OUTPUT_DIR"
rm -f "$BUILD_DIR/${FOLDER_NAME}_"*.zip

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Copy required files
cp manifest.json "$OUTPUT_DIR/"
cp -r pages "$OUTPUT_DIR/"

# Remove unnecessary files from the copy
find "$OUTPUT_DIR" -name '.DS_Store' -delete

echo "Copied files to $OUTPUT_DIR"

# Create zip file
cd "$BUILD_DIR"
zip -r "${FOLDER_NAME}_${NEW_VERSION}.zip" "$FOLDER_NAME"
cd "$SCRIPT_DIR"

# Copy mod to user mod folder
cp -r "$OUTPUT_DIR" ~/Documents/SauceMods/

echo ""
echo "Build complete!"
echo "  Version: $NEW_VERSION"
echo "  Folder: $OUTPUT_DIR"
echo "  Zip: $BUILD_DIR/${FOLDER_NAME}_${NEW_VERSION}.zip"
