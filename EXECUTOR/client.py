#!/usr/bin/env python3

import socket
import struct
import sys
import os

# The socket communication path
SOCKET_PATH = "/tmp/executor_daemon.sock"

class ExecutorClient:

    def __init__(self, socket_path=SOCKET_PATH):
        self.socket_path = socket_path

    # Send code to the executor daemon
    # Format type 1 for python
    # Code is a string
    # Returns a dict with status 0 good, 1 bad, stdout(bytes), stder(bytes), zip(bytes)
    def send_code(self, format_byte, code):
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.connect(self.socket_path)
            code_bytes = code.encode('utf-8')
            payload_size = len(code_bytes)
            # Pack: 1 byte format + 4 bytes size (big-endian) + code
            message = struct.pack('!BI', format_byte, payload_size) + code_bytes
            sock.sendall(message)
            # Read response header: status (4 bytes), stdout_size (4 bytes),
            # stderr_size (4 bytes), zip_size (4 bytes)
            header = self._recv_exact(sock, 16)
            if not header:
                sock.close()
                return None
            status, stdout_size, stderr_size, zip_size = struct.unpack('!IIII', header)
            # Read stdout
            stdout_data = b''
            if stdout_size > 0:
                stdout_data = self._recv_exact(sock, stdout_size)
                if not stdout_data:
                    sock.close()
                    return None
            # Read stderr
            stderr_data = b''
            if stderr_size > 0:
                stderr_data = self._recv_exact(sock, stderr_size)
                if not stderr_data:
                    sock.close()
                    return None
            # Read zip
            zip_data = b''
            if zip_size > 0:
                zip_data = self._recv_exact(sock, zip_size)
                if not zip_data:
                    sock.close()
                    return None
            sock.close()
            return {
                'status': status,
                'stdout': stdout_data,
                'stderr': stderr_data,
                'zip': zip_data
            }

        except ConnectionRefusedError:
            print("Error: Cannot connect to daemon. Is it running?")
            return None
        except FileNotFoundError:
            print(f"Error: Socket not found at {self.socket_path}")
            return None
        except Exception as e:
            print(f"Error: {e}")
            return None

    # Reveice from the socket num_bytes
    # Returns bytes received or none if error
    def _recv_exact(self, sock, num_bytes):
        data = b''
        while len(data) < num_bytes:
            chunk = sock.recv(num_bytes - len(data))
            if not chunk:
                return None
            data += chunk
        return data

    # Execute python code
    def execute_python(self, code):
        return self.send_code(1, code)

def print_help():
    # Priinnt help message
    print("\nExecutor Daemon REPL Client")
    print("=" * 60)
    print("Commands:")
    print("  .help          - Show this help message")
    print("  .exit          - Exit the REPL")
    print("  .quit          - Exit the REPL")
    print("  .clear         - Clear the screen")
    print("  .file <path>   - Execute Python code from a file")
    print("  .multiline     - Enter multiline mode (end with Ctrl+D)")
    print("\nTo execute Python code, simply type or paste it.")
    print("Single-line expressions are executed immediately.")
    print("=" * 60)

def clear_screen():
    # Clear screen
    os.system('clear' if os.name != 'nt' else 'cls')

def read_multiline():
    # Read multiline until Ctrl+D
    print("Entering multiline mode. Press Ctrl+D (Unix) or Ctrl+Z (Windows) when done.")
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    return '\n'.join(lines)

def execute_file(client, filepath):
    # Execute code form file
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        print(f"Executing code from {filepath}...")
        result = client.execute_python(code)
        if result is None:
            print("✗ No response from daemon")
        else:
            if result['stdout']:
                print(result['stdout'].decode('utf-8', errors='replace'), end='')
            if result['stderr']:
                print("\033[91m", end='')  # Red color
                print(result['stderr'].decode('utf-8', errors='replace'), end='')
                print("\033[0m", end='')  # Reset color
            if result['status'] == 0:
                print("✓ Execution successful")
            else:
                print("✗ Execution failed")
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
    except Exception as e:
        print(f"Error reading file: {e}")

def repl():
    client = ExecutorClient()
    print("Executor Daemon REPL Client")
    print("Type .help for help, .exit to quit")
    print()
    while True:
        try:
            # Show prompt
            line = input(">>> ").strip()
            # Skip empty lines
            if not line:
                continue
            # Handle commands
            if line.startswith('.'):
                parts = line.split(maxsplit=1)
                command = parts[0].lower()
                if command in ['.exit', '.quit']:
                    print("Goodbye!")
                    break
                elif command == '.help':
                    print_help()
                elif command == '.clear':
                    clear_screen()
                elif command == '.multiline':
                    code = read_multiline()
                    if code.strip():
                        result = client.execute_python(code)
                        if result is None:
                            print("✗ No response from daemon")
                        else:
                            # Print stdout
                            if result['stdout']:
                                print(result['stdout'].decode('utf-8', errors='replace'), end='')
                            # Print stderr in red if available
                            if result['stderr']:
                                print("\033[91m", end='')  # Red color
                                print(result['stderr'].decode('utf-8', errors='replace'), end='')
                                print("\033[0m", end='')  # Reset color
                            # Print status
                            if result['status'] == 0:
                                print("✓ Success")
                            else:
                                print("✗ Failed")
                elif command == '.file':
                    if len(parts) < 2:
                        print("Usage: .file <path>")
                    else:
                        execute_file(client, parts[1])
                else:
                    print(f"Unknown command: {command}")
                    print("Type .help for available commands")
            else:
                # Execute Python code
                result = client.execute_python(line)
                if result is None:
                    print("✗ No response")
                else:
                    # Print stdout
                    if result['stdout']:
                        print(result['stdout'].decode('utf-8', errors='replace'), end='')
                    # Print stderr in red if available
                    if result['stderr']:
                        print("\033[91m", end='')  # Red color
                        print(result['stderr'].decode('utf-8', errors='replace'), end='')
                        print("\033[0m", end='')  # Reset color
                    # Print status
                    if result['status'] == 0:
                        print("✓ Success")
                    else:
                        print("✗ Failed")

        except KeyboardInterrupt:
            print("\nUse .exit or .quit to exit")
            continue
        except EOFError:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    repl()
