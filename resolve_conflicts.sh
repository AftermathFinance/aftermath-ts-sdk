#!/bin/bash

# Find files with conflicts containing "futures" in their path
futures_files=$(git ls-files -u | grep 'futures' | awk '{print $4}' | sort -u)

# Find package.json and package-lock.json if they have conflicts
package_files="package.json package-lock.json"

# Print the files being processed for debugging
echo "Resolving conflicts for futures files: $futures_files"
echo "Resolving conflicts for package.json and package-lock.json"

# Automatically resolve conflicts for files with "futures" in their path
if [ ! -z "$futures_files" ]; then
    echo "$futures_files" | xargs -I{} git restore --ours {}
    echo "$futures_files" | xargs git add
else
    echo "No 'futures' files with conflicts found."
fi

# Automatically resolve conflicts for package.json and package-lock.json
git restore --ours package.json package-lock.json
git add package.json package-lock.json

# Prompt to manually resolve other conflicts
echo "Automatic conflict resolution complete for 'futures' files and package files."
echo "Please manually resolve any other conflicts and run 'git rebase --continue'."
