#!/bin/bash
set -euo pipefail

IMAGE_NAME="targetshop-challenge"
CONTAINER_NAME="targetshop-challenge"
HOST_PORT="${HOST_PORT:-1337}"

cd "$(dirname "$0")"

echo "[+] Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "[+] Removing any existing container: $CONTAINER_NAME"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "[+] Starting container on port $HOST_PORT"
docker run -d --rm \
    --name "$CONTAINER_NAME" \
    -p "$HOST_PORT:1337" \
    "$IMAGE_NAME"

echo "[+] Container is up. Visit http://localhost:$HOST_PORT/"
