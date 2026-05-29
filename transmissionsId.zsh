#!/usr/bin/env zsh
set -e

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Create the dialog
bru run Dialogporten/ServiceOwner/Dialogs/Create\ dialog.bru \
  --env "Local Development" --insecure \
  --reporter-json "$TMP" > /dev/null

ID=$(jq -r '.[].results[].response.data' "$TMP")
echo "Created dialog: $ID"

# Fetch it back and pull out the transmission IDs
bru run Dialogporten/ServiceOwner/Dialogs/Get\ Single\ dialog.bru \
  --env "Local Development" --insecure \
  --env-var "dialogId=$ID" \
  --reporter-json "$TMP" > /dev/null

jq -r '.[].results[].response.data.transmissions[].id' "$TMP"
