# Executor Daemon

A C++ systemd daemon that receives and executes code via a binary protocol over a Unix domain socket.

## Protocol Specification

The daemon accepts commands in the following binary format:

```
| 1 byte       | 4 bytes (big-endian) | N bytes    |
|--------------|----------------------|------------|
| Format Type  | Payload Size         | Code       |
```

- **Format Type**: Command type identifier
  - `1`: Execute Python code
- **Payload Size**: Size of the code payload in bytes (network byte order/big-endian)
- **Code**: The actual code to execute

The daemon responds with a single byte:
- `0`: Success
- `1`: Failure

## Components

- **executor_daemon.cpp**: Main C++ daemon that listens on a Unix socket
- **executor_python.sh**: Bash script that executes Python code
- **executor-daemon.service**: systemd service file
- **Makefile**: Build and installation configuration
- **client.py**: Interactive REPL client for communicating with the daemon

## Requirements

- C++ compiler with C++17 support (g++)
- Python 3
- systemd
- Root access for installation

## Building

```bash
cd EXECUTOR
make
```

## Installation

```bash
sudo make install
```

This will:
1. Install the daemon binary to `/usr/local/bin/executor_daemon`
2. Install the Python executor script to `/usr/local/bin/executor_python.sh`
3. Install the systemd service file to `/etc/systemd/system/executor-daemon.service`
4. Reload systemd configuration

## Starting the Service

```bash
# Start the daemon
sudo systemctl start executor-daemon

# Enable auto-start on boot
sudo systemctl enable executor-daemon

# Check status
sudo systemctl status executor-daemon

# View logs
sudo journalctl -u executor-daemon -f
```

## Using the Interactive Client

Start the REPL client to interactively send Python code:

```bash
./client.py
```

### REPL Commands

- `.help` - Show help message
- `.exit` or `.quit` - Exit the REPL
- `.clear` - Clear the screen
- `.file <path>` - Execute Python code from a file
- `.multiline` - Enter multiline mode (end with Ctrl+D)

### Examples

```python
>>> print("Hello World")
✓ Success

>>> .multiline
Entering multiline mode. Press Ctrl+D when done.
for i in range(5):
    print(f"Number: {i}")
✓ Execution successful

>>> .file my_script.py
Executing code from my_script.py...
✓ Execution successful
```

## Testing

Start the daemon in foreground mode for debugging:

```bash
./executor_daemon --foreground
```

## Uninstallation

```bash
sudo make uninstall
```

## Socket Location

The daemon listens on: `/tmp/executor_daemon.sock`

## TODO

- Come up with the idea how to combine it with the probable javascript code that will execute events upon blockchain contracts
- Dokcerize it using [Nvidia Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html). The hope here is that docker would allow to run code in a sandboxed safe environment also at the same time allowing access to the gpu.
- Actually test with some pytorch code
- Complete the TODO's around code
- Think about the deamon's security
- Create some tool which would allow to control the daemon
- Make it a daemon that belongs to the user which initiated it, currently no need for a root daemon.
- Implement zip tranfer(basically allow the program to write to some directory, zip that up and send back to the requestor)
- Low-prio Can this be done on windows?