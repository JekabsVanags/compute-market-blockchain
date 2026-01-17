CXX = g++

# Toggle between cpu and gpu
#DOCKER_TYPE = gpu
DOCKER_TYPE = cpu

CXXFLAGS = -std=c++17 -Wall -Wextra -O2 -DDEFAULT_IMAGE=\"executor-$(DOCKER_TYPE)\"
TARGET = executor_daemon
SOURCE = executor_daemon.cpp

PY_EXEC = executor_docker.sh
# Basically thge daemon references this name, so keep it as seperate variable
# Meanwhile py_exec can be changed to other implementations
PY_EXEC_DEST = executor_python.sh
INSTALL_BIN = /usr/local/bin
INSTALL_SCRIPT = /usr/local/bin
SYSTEMD_DIR = /etc/systemd/system

# Set to 0 to skip docker build
# Use when you know what you are doing
BUILD_DOCKER ?= 1

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SOURCE)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	@echo "Installing executor daemon..."
ifneq ($(BUILD_DOCKER),0)
	docker build -t executor-cpu -f Dockerfile.cpu .
	docker build -t executor-gpu -f Dockerfile.gpu .
endif
	install -m 755 $(TARGET) $(INSTALL_BIN)/$(TARGET)
	install -m 755 $(PY_EXEC) $(INSTALL_SCRIPT)/$(PY_EXEC_DEST)
	install -m 644 executor-daemon.service $(SYSTEMD_DIR)/executor-daemon.service
	systemctl daemon-reload
	@echo "Installation complete. Run 'sudo systemctl start executor-daemon' to start the service"

uninstall:
	@echo "Uninstalling executor daemon..."
	systemctl stop executor-daemon || true
	systemctl disable executor-daemon || true
	rm -f $(INSTALL_BIN)/$(TARGET)
	rm -f $(INSTALL_SCRIPT)/$(PY_EXEC_DEST)
	rm -f $(SYSTEMD_DIR)/executor-daemon.service
	systemctl daemon-reload
	@echo "Uninstall complete"

.PHONY: all clean install uninstall
