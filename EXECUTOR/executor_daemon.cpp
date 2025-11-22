#include <iostream>
#include <cstring>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <signal.h>
#include <fstream>
#include <vector>
#include <arpa/inet.h>
#include <syslog.h>
#include <cstdlib>
#include <fcntl.h>
#include <sys/wait.h>

// The socket for communication with the daemon
const char* SOCKET_PATH = "/tmp/executor_daemon.sock";
// The daemons pid
const char* PID_FILE = "/var/run/executor_daemon.pid";
// The python executor, which will be heavily sandboxed environment
const char* PYTHON_EXECUTOR_SCRIPT = "/usr/local/bin/executor_python.sh";

// Daemon running status
volatile sig_atomic_t running = 1;

// Respect daemon signals
void signal_handler(int signum) {
    syslog(LOG_INFO, "Received signal %d, shutting down", signum);
    running = 0;
}

// Basically standard unix code so the daemon behaves noramlly
void daemonize() {
    pid_t pid = fork();
    if (pid < 0) exit(EXIT_FAILURE);
    if (pid > 0) exit(EXIT_SUCCESS);
    // Basically create a child and make it the important one, clean of fd, move to / so the dir is not in use and so on
    if (setsid() < 0) exit(EXIT_FAILURE);
    signal(SIGCHLD, SIG_IGN);
    signal(SIGHUP, SIG_IGN);
    pid = fork();
    if (pid < 0) exit(EXIT_FAILURE);
    if (pid > 0) exit(EXIT_SUCCESS);
    umask(0);
    chdir("/");
    for (int fd = sysconf(_SC_OPEN_MAX); fd >= 0; fd--) {
        close(fd);
    }
    open("/dev/null", O_RDWR);
    dup(0);
    dup(0);
}

// Does pid creation
void write_pid_file() {
    std::ofstream pid_file(PID_FILE);
    if (pid_file.is_open()) {
        pid_file << getpid() << std::endl;
        pid_file.close();
    }
}

// Executes the given code using the following runner(script path), outputs stdout and stder
bool execute_via_script(const std::string& code, const char* script_path, std::string& stdout_output, std::string& stderr_output) {
    char temp_filename[] = "/tmp/executor_XXXXXX";
    // Create a temp file to copy code to
    int fd = mkstemp(temp_filename);
    if (fd == -1) {
        syslog(LOG_ERR, "Failed to create temporary file");
        return false;
    }
    write(fd, code.c_str(), code.length());
    close(fd);
    // Create pipes to capture stdout and stderr separately
    int stdout_pipe[2], stderr_pipe[2];
    if (pipe(stdout_pipe) == -1 || pipe(stderr_pipe) == -1) {
        syslog(LOG_ERR, "Failed to create pipes");
        unlink(temp_filename);
        return false;
    }
    pid_t pid = fork();
    // Basically does exectuion
    if (pid == 0) {
        // Child process
        close(stdout_pipe[0]); // Close read end of stdout pipe
        close(stderr_pipe[0]); // Close read end of stderr pipe
        dup2(stdout_pipe[1], STDOUT_FILENO); // Redirect stdout to pipe
        dup2(stderr_pipe[1], STDERR_FILENO); // Redirect stderr to pipe
        close(stdout_pipe[1]);
        close(stderr_pipe[1]);
        execl(script_path, script_path, temp_filename, nullptr);
        syslog(LOG_ERR, "Failed to exec script: %s", strerror(errno));
        exit(EXIT_FAILURE);
    } else if (pid > 0) {
        // Parent process
        close(stdout_pipe[1]); // Close write end of stdout pipe
        close(stderr_pipe[1]); // Close write end of stderr pipe
        // Set pipes to non-blocking mode
        fcntl(stdout_pipe[0], F_SETFL, O_NONBLOCK);
        fcntl(stderr_pipe[0], F_SETFL, O_NONBLOCK);
        stdout_output.clear();
        stderr_output.clear();
        // Read from both pipes until child exits
        char buffer[4096];
        bool stdout_open = true, stderr_open = true;
        while (stdout_open || stderr_open) {
            fd_set read_fds;
            FD_ZERO(&read_fds);
            int max_fd = -1;
            if (stdout_open) {
                FD_SET(stdout_pipe[0], &read_fds);
                max_fd = stdout_pipe[0];
            }
            if (stderr_open) {
                FD_SET(stderr_pipe[0], &read_fds);
                if (stderr_pipe[0] > max_fd) max_fd = stderr_pipe[0];
            }
            struct timeval timeout = {0, 100000}; // 100ms timeout
            int activity = select(max_fd + 1, &read_fds, nullptr, nullptr, &timeout);
            if (activity > 0) {
                if (stdout_open && FD_ISSET(stdout_pipe[0], &read_fds)) {
                    ssize_t bytes_read = read(stdout_pipe[0], buffer, sizeof(buffer));
                    if (bytes_read > 0) {
                        stdout_output.append(buffer, bytes_read);
                    } else {
                        stdout_open = false;
                    }
                }
                if (stderr_open && FD_ISSET(stderr_pipe[0], &read_fds)) {
                    ssize_t bytes_read = read(stderr_pipe[0], buffer, sizeof(buffer));
                    if (bytes_read > 0) {
                        stderr_output.append(buffer, bytes_read);
                    } else {
                        stderr_open = false;
                    }
                }
            }
            // Check if child has exited
            int status;
            pid_t result = waitpid(pid, &status, WNOHANG);
            if (result != 0) {
                // Child exited, do final reads
                ssize_t bytes_read;
                while ((bytes_read = read(stdout_pipe[0], buffer, sizeof(buffer))) > 0) {
                    stdout_output.append(buffer, bytes_read);
                }
                while ((bytes_read = read(stderr_pipe[0], buffer, sizeof(buffer))) > 0) {
                    stderr_output.append(buffer, bytes_read);
                }
                break;
            }
        }
        close(stdout_pipe[0]);
        close(stderr_pipe[0]);
        int status;
        waitpid(pid, &status, 0); // Final wait to clean up zombie
        unlink(temp_filename);
        if (WIFEXITED(status)) {
            int exit_code = WEXITSTATUS(status);
            syslog(LOG_INFO, "Script executed with exit code: %d, stdout: %zu bytes, stderr: %zu bytes",
                   exit_code, stdout_output.size(), stderr_output.size());
            return exit_code == 0;
        }
    } else {
        syslog(LOG_ERR, "Failed to fork for script execution");
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);
        close(stderr_pipe[0]);
        close(stderr_pipe[1]);
        unlink(temp_filename);
        return false;
    }
    return false;
}

// Handle incoming requests from the socket
bool handle_client(int client_fd) {
    // The payload is in the format, size and bytes to read
    uint8_t format_byte;
    uint32_t payload_size;
    ssize_t bytes_read = recv(client_fd, &format_byte, 1, MSG_WAITALL);
    if (bytes_read != 1) {
        syslog(LOG_WARNING, "Failed to read format byte");
        return false;
    }
    bytes_read = recv(client_fd, &payload_size, 4, MSG_WAITALL);
    if (bytes_read != 4) {
        syslog(LOG_WARNING, "Failed to read payload size");
        return false;
    }
    payload_size = ntohl(payload_size);
    if (payload_size > 10 * 1024 * 1024) {
        syslog(LOG_WARNING, "Payload size too large: %u bytes", payload_size);
        return false;
    }
    // Its arbritary size, just keep reading it
    std::vector<char> payload(payload_size);
    size_t total_read = 0;
    while (total_read < payload_size) {
        bytes_read = recv(client_fd, payload.data() + total_read,
                         payload_size - total_read, 0);
        if (bytes_read <= 0) {
            syslog(LOG_WARNING, "Failed to read complete payload");
            return false;
        }
        total_read += bytes_read;
    }
    std::string code(payload.begin(), payload.end());
    syslog(LOG_INFO, "Received command - Format: %d, Size: %u", format_byte, payload_size);
    bool success = false;
    // Prepare the output, stdout and stderr
    std::string stdout_output;
    std::string stderr_output;
    switch (format_byte) {
        case 1:
            syslog(LOG_INFO, "Executing Python code via script");
            success = execute_via_script(code, PYTHON_EXECUTOR_SCRIPT, stdout_output, stderr_output);
            break;
        default:
            syslog(LOG_WARNING, "Unknown format byte: %d", format_byte);
            break;
    }
    // Prepare response in new format:
    // - Status (4 bytes): 0 for success, 1 for failure
    // - Stdout size (4 bytes)
    // - Stderr size (4 bytes)
    // - Zip size (4 bytes): 0 for now
    // - Stdout bytes
    // - Stderr bytes
    // - Zip bytes (empty for now)
    uint32_t status = success ? 0 : 1;
    uint32_t stdout_size = stdout_output.size();
    uint32_t stderr_size = stderr_output.size();
    uint32_t zip_size = 0; // Not implemented yet
    // Convert to network byte order
    uint32_t status_net = htonl(status);
    uint32_t stdout_size_net = htonl(stdout_size);
    uint32_t stderr_size_net = htonl(stderr_size);
    uint32_t zip_size_net = htonl(zip_size);
    // Send header
    send(client_fd, &status_net, 4, 0);
    send(client_fd, &stdout_size_net, 4, 0);
    send(client_fd, &stderr_size_net, 4, 0);
    send(client_fd, &zip_size_net, 4, 0);
    // Send stdout
    if (stdout_size > 0) {
        send(client_fd, stdout_output.data(), stdout_size, 0);
    }
    // Send stderr
    if (stderr_size > 0) {
        send(client_fd, stderr_output.data(), stderr_size, 0);
    }
    // Zip data would go here (not implemented)
    syslog(LOG_INFO, "Sent response - Status: %u, Stdout: %u bytes, Stderr: %u bytes, Zip: %u bytes",
           status, stdout_size, stderr_size, zip_size);
    return success;
}

int main(int argc, char* argv[]) {
    // Allow to run daemon not as a demon using -f(useful for testing)
    bool foreground = false;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--foreground") == 0 || strcmp(argv[i], "-f") == 0) {
            foreground = true;
        }
    }
    if (!foreground) {
        daemonize();
    }
    openlog("executor_daemon", LOG_PID | LOG_CONS, LOG_DAEMON);
    syslog(LOG_INFO, "Executor daemon starting");
    // Respect kill signals
    signal(SIGTERM, signal_handler);
    signal(SIGINT, signal_handler);
    // Create pid files
    write_pid_file();
    unlink(SOCKET_PATH);
    // Ensure that socket exists
    int server_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (server_fd == -1) {
        syslog(LOG_ERR, "Failed to create socket: %s", strerror(errno));
        return EXIT_FAILURE;
    }
    // Data structure to work with sockets
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (bind(server_fd, (struct sockaddr*)&addr, sizeof(addr)) == -1) {
        syslog(LOG_ERR, "Failed to bind socket: %s", strerror(errno));
        close(server_fd);
        return EXIT_FAILURE;
    }
    // Ensure that client can communicate with a socket. This is actually really insecure way, because it allows all programs and users to send commands
    // Please FIX TODO
    // This is not serious development otherwise
    chmod(SOCKET_PATH, 0666);
    // Start listening on sockets
    if (listen(server_fd, 5) == -1) {
        syslog(LOG_ERR, "Failed to listen on socket: %s", strerror(errno));
        close(server_fd);
        return EXIT_FAILURE;
    }
    syslog(LOG_INFO, "Listening on %s", SOCKET_PATH);
    // While deamon is up 
    while (running) {
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_fd, &read_fds);
        struct timeval timeout;
        timeout.tv_sec = 1;
        timeout.tv_usec = 0;
        int activity = select(server_fd + 1, &read_fds, nullptr, nullptr, &timeout);
        if (activity < 0 && errno != EINTR) {
            syslog(LOG_ERR, "Select error: %s", strerror(errno));
            break;
        }
        if (activity > 0 && FD_ISSET(server_fd, &read_fds)) {
            int client_fd = accept(server_fd, nullptr, nullptr);
            if (client_fd == -1) {
                syslog(LOG_WARNING, "Failed to accept connection: %s", strerror(errno));
                continue;
            }
            syslog(LOG_INFO, "Client connected");
            handle_client(client_fd);
            close(client_fd);
            syslog(LOG_INFO, "Client disconnected");
        }
    }
    // It received kill signal, simply clean up and then exit
    close(server_fd);
    unlink(SOCKET_PATH);
    unlink(PID_FILE);
    syslog(LOG_INFO, "Executor daemon stopped");
    closelog();
    return EXIT_SUCCESS;
}
