#!/bin/bash

# This script copies required files to the Sauce4Zwift mod folder for testing
DEST_PATH="/Users/vincentdavis/Documents/SauceMods/s4z_mode_gotta_bike"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_PATH"

# Copy required files
cp -r pages "$DEST_PATH/"
cp manifest.json "$DEST_PATH/"
cp mod.js "$DEST_PATH/"

echo "Files copied successfully to $DEST_PATH"
