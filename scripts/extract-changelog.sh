#!/bin/bash

# This script extracts the release notes for a specific version from CHANGELOG.md
# Usage: ./scripts/extract-changelog.sh 0.1.0

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Error: No version provided."
    exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

# Use awk to extract the section starting with ## [VERSION] until the next ## [ heading
awk -v ver="[$VERSION]" '
    /^## \[/ {
        if (found) exit;
        if (index($0, ver)) {
            found=1;
            next;
        }
    }
    found {
        print $0;
    }
' CHANGELOG.md | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' # Remove trailing newlines
