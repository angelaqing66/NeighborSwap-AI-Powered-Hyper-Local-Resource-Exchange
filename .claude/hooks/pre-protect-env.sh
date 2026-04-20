#!/usr/bin/env bash
# PreToolUse — block direct edits to .env files (secrets protection)
# Exit 2 to block the tool call and show the error to Claude.

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null || echo "")

case "$FILE" in
  *.env | .env | .env.* | */.env | */.env.*)
    echo "BLOCKED: Direct edits to '$FILE' are not allowed."
    echo "Use 'vercel env' commands to manage environment variables, or edit '.env.example' to document new vars."
    exit 2
    ;;
esac

exit 0
