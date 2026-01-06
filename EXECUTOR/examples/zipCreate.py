#!/usr/bin/env python3
# Create a simple text file
with open('hello.txt', 'w') as f:
    f.write('Hello from the executor!\n')
    f.write('This file was created inside the container.\n')
# Create a JSON file
import json
data = {
    'message': 'Test data',
    'numbers': [1, 2, 3, 4, 5],
    'nested': {
        'key': 'value'
    }
}
with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)
# Create a subdirectory with files
import os
os.makedirs('subdir', exist_ok=True)
with open('subdir/nested.txt', 'w') as f:
    f.write('This is a nested file\n')
print('Created 3 files:')
print('  - hello.txt')
print('  - data.json')
print('  - subdir/nested.txt')
