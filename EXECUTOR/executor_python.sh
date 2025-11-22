#!/bin/bash
# Executor Python Script
# Called by executor_daemon to execute Python code
# I swear this will be more secure in the future!
# This will be replaced by proper docker calls in the future TODO
# But currently make it so that the file can be given
if [ $# -ne 1 ]; then
    echo "Usage: $0 <code_file>" >&2
    exit 1
fi
CODE_FILE="$1"
# Error if file does not exist
if [ ! -f "$CODE_FILE" ]; then
    echo "Error: Code file not found: $CODE_FILE" >&2
    exit 1
fi
# Execute the Python code
python3 "$CODE_FILE"
# Copy the exit code of the last program
EXIT_CODE=$?
# Return the exit code from Python
# Copy exit code of it
exit $EXIT_CODE
