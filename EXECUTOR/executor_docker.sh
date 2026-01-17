#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "Usage: $0 <code_file> [output_zip_path]" >&2
  exit 1
fi

CODE_FILE="$1"
OUTPUT_ZIP="${2:-}"

if [ ! -f "$CODE_FILE" ]; then
  echo "Error: Code file not found: $CODE_FILE" >&2
  exit 1
fi

CODE_FILE_ABS="$(readlink -f "$CODE_FILE")"
CODE_BASENAME="$(basename "$CODE_FILE_ABS")"

IMAGE="${IMAGE:-executor-cpu}"

# Create temporary Docker volume if zip output is requested
if [ -n "$OUTPUT_ZIP" ]; then
  VOLUME_NAME="executor-work-$$-$(date +%s)"
  docker volume create "$VOLUME_NAME" >/dev/null
  trap "docker volume rm '$VOLUME_NAME' >/dev/null 2>&1" EXIT
  # This is stupid, but iam doing this for multitude of reasons
  # First we somehow need to write some files whichwill persist after the run of the container
  # So we create a temporary volume which will be deleted after this script exits
  # And since we run the main docker executor as nobody user, we need to use root user to setup so that atleast
  # some directory is owned by nobody
  # So here we run an alpine docker container which in the workdir create an output folder
  docker run --rm \
    --user 0:0 \
    -v "${VOLUME_NAME}:/workdir" \
    alpine:latest \
    sh -c '
      mkdir /workdir/output &&
      chown 65534:65534 /workdir/output &&
      chmod 700 /workdir/output
    '
else
  VOLUME_NAME=""
fi

# Build docker run command
# Add --gpus all back
DOCKER_CMD=(docker run --rm -i
  --entrypoint ""
  --name "py-sandbox-$$"
  --network=none
  --read-only
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m
  --tmpfs /run:rw,noexec,nosuid,nodev,size=16m
  --cap-drop=ALL
  --security-opt no-new-privileges:true
  --security-opt apparmor=docker-default
  --security-opt seccomp=unconfined
  --user 65534:65534)

# If volume was created, use it as the working directory
if [ -n "$VOLUME_NAME" ]; then
  DOCKER_CMD+=(--workdir /workdir/output
    -v "${VOLUME_NAME}:/workdir:rw"
    -v "${CODE_FILE_ABS}:/work/${CODE_BASENAME}:ro")
else
  # Original behavior: read-only work directory
  DOCKER_CMD+=(--workdir /work
    -v "${CODE_FILE_ABS}:/work/${CODE_BASENAME}:ro")
fi

DOCKER_CMD+=("$IMAGE" python3 "/work/${CODE_BASENAME}")

# Execute the docker command
"${DOCKER_CMD[@]}"
EXIT_CODE=$?

# If output zip was requested, create it from volume contents
if [ -n "$OUTPUT_ZIP" ] && [ -n "$VOLUME_NAME" ]; then
  # And here we also use alpine container to create from the temporary volume the zip file of out all
  # requested scripts output files
  docker run --rm \
    -v "${VOLUME_NAME}:/workdir:ro" \
    alpine:latest \
    sh -c "
      apk add --no-cache zip >/dev/null &&
      cd /workdir/output 2>/dev/null || exit 0
      zip -qr - . -x 2>/dev/null \"$CODE_BASENAME\"
    " >"$OUTPUT_ZIP"
fi

exit $EXIT_CODE
