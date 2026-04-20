#!/usr/bin/env bash
# PostToolUse — auto-lint TypeScript/TSX files after every Edit or Write.
# Runs ESLint with --fix so trivial style violations are auto-corrected.

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null || echo "")

if [[ "$FILE" =~ \.(ts|tsx)$ ]] && [[ -f "$FILE" ]]; then
  echo "ESLint: linting $FILE"
  npx eslint "$FILE" --fix --quiet 2>&1
  EXIT=$?
  if [ $EXIT -ne 0 ]; then
    echo "ESLint reported issues in $FILE — review and fix before committing."
  fi
fi

exit 0
