#!/usr/bin/env bash
set -u

TARGET="${1:?Firebase deploy target is required}"
LOG_FILE="${2:?Log file path is required}"
PROJECT_ID="${FIREBASE_PROJECT_ID:?FIREBASE_PROJECT_ID is required}"
ATTEMPTS="${FIREBASE_DEPLOY_ATTEMPTS:-3}"

: > "$LOG_FILE"

for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "[$TARGET] deploy attempt $attempt/$ATTEMPTS" | tee -a "$LOG_FILE"
  set +e
  npx firebase-tools deploy \
    --project "$PROJECT_ID" \
    --only "$TARGET" \
    --force \
    --non-interactive 2>&1 | tee -a "$LOG_FILE"
  code=${PIPESTATUS[0]}
  set -e

  if [ "$code" -eq 0 ]; then
    echo "[$TARGET] deploy succeeded" | tee -a "$LOG_FILE"
    exit 0
  fi

  echo "[$TARGET] deploy failed with exit code $code" | tee -a "$LOG_FILE"
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    sleep $((attempt * 8))
  fi
done

exit 1
