#!/usr/bin/env bash
# Stop hook — quality gate: TypeScript type check + unit tests.
# Non-zero exit feeds the output back to Claude as a correction signal.

echo "=== Quality gate ==="

echo "-- TypeScript type check --"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  echo "FAIL: TypeScript errors detected. Fix them before finishing."
  echo "$TSC_OUTPUT" | tail -30
  exit 1
fi
echo "PASS: No TypeScript errors."

echo "-- Unit tests --"
TEST_OUTPUT=$(npm test -- --run 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo "FAIL: Unit tests are failing. Fix them before finishing."
  echo "$TEST_OUTPUT" | tail -40
  exit 1
fi
echo "PASS: All unit tests pass."

echo "=== Quality gate passed ==="
exit 0
