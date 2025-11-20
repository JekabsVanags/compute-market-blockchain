CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
TARGET = executor_daemon
SOURCE = executor_daemon.cpp

INSTALL_BIN = /usr/local/bin
INSTALL_SCRIPT = /usr/local/bin
SYSTEMD_DIR = /etc/systemd/system

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SOURCE)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	@echo "Installing executor daemon..."
	install -m 755 $(TARGET) $(INSTALL_BIN)/$(TARGET)
	install -m 755 executor_python.sh $(INSTALL_SCRIPT)/executor_python.sh
	install -m 644 executor-daemon.service $(SYSTEMD_DIR)/executor-daemon.service
	systemctl daemon-reload
	@echo "Installation complete. Run 'sudo systemctl start executor-daemon' to start the service"

uninstall:
	@echo "Uninstalling executor daemon..."
	systemctl stop executor-daemon || true
	systemctl disable executor-daemon || true
	rm -f $(INSTALL_BIN)/$(TARGET)
	rm -f $(INSTALL_SCRIPT)/executor_python.sh
	rm -f $(SYSTEMD_DIR)/executor-daemon.service
	systemctl daemon-reload
	@echo "Uninstall complete"

.PHONY: all clean install uninstall
