#!/bin/bash

# Build script for GOTTA.BIKE sauce mod
# 1. Increments minor version (e.g., 1.0.0 -> 1.1.0)
# 2. Copies required files to build folder
# 3. Creates zip file for distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read current version from manifest.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
echo "Current version: $CURRENT_VERSION"

# Parse version parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Increment minor version
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR.$PATCH"
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
rm -f "$BUILD_DIR/${FOLDER_NAME}_${NEW_VERSION}.zip"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Copy required files
cp manifest.json "$OUTPUT_DIR/"
cp -r pages "$OUTPUT_DIR/"

# Remove unnecessary files from the copy
rm -f "$OUTPUT_DIR/pages/.DS_Store"
rm -rf "$OUTPUT_DIR/pages/**/.DS_Store"

echo "Copied files to $OUTPUT_DIR"

# Create zip file
cd "$BUILD_DIR"
zip -r "${FOLDER_NAME}_${NEW_VERSION}.zip" "$FOLDER_NAME"
cd "$SCRIPT_DIR"

echo ""
echo "Build complete!"
echo "  Folder: $OUTPUT_DIR"
echo "  Zip: $BUILD_DIR/${FOLDER_NAME}_${NEW_VERSION}.zip"
