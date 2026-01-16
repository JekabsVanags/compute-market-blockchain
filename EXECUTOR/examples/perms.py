import os
print(f"UID: {os.getuid()}, GID: {os.getgid()}")
print(f"CWD: {os.getcwd()}")
print(f"Writable: {os.access('.', os.W_OK)}")
os.system('ls -la')