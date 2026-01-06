import torch
import torch.nn as nn
import torch.optim as optim

# Device selection
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("=== DEVICE INFO ===")
print("CUDA available:", torch.cuda.is_available())
print("Using device:", device)
print()

# Winner calculation
def winner(board):
    lines = [
        board[0:3], board[3:6], board[6:9],               # rows
        board[0:9:3], board[1:9:3], board[2:9:3],         # cols
        board[0:9:4], board[2:7:2],                       # diags
    ]
    if any(sum(line) == 3 for line in lines):
        return 1  # X wins
    if any(sum(line) == -3 for line in lines):
        return 2  # O wins
    return 0

# Dataset generation
def random_board():
    return torch.randint(-1, 2, (9,), dtype=torch.int)

N = 2000
boards = []
labels = []

for _ in range(N):
    b = random_board()
    boards.append(b)
    labels.append(winner(b.tolist()))

print("=== DATASET INFO ===")
print("Total boards:", N)
print("Label counts:",
      "none=", labels.count(0),
      "X=", labels.count(1),
      "O=", labels.count(2))
print()

print("Sample board (raw):", boards[0].tolist())
print("Sample label:", labels[0])
print()

X = torch.stack(boards).float().to(device)
y = torch.tensor(labels).to(device)

# Model definition
print("=== MODEL ===")
model = nn.Sequential(
    nn.Linear(9, 32),
    nn.ReLU(),
    nn.Linear(32, 16),
    nn.ReLU(),
    nn.Linear(16, 3)
).to(device)

print(model)
print()

optimizer = optim.Adam(model.parameters(), lr=0.01)
loss_fn = nn.CrossEntropyLoss()

# Training
print("=== TRAINING START ===")
for epoch in range(20):
    optimizer.zero_grad()
    logits = model(X)
    loss = loss_fn(logits, y)
    loss.backward()
    optimizer.step()

    if epoch % 2 == 0:
        print(f"Epoch {epoch:02d}: loss={loss.item():.6f}")

print("=== TRAINING COMPLETE ===")
print()

# Helper to visualize boards
def print_board(b):
    chars = {1: "X", -1: "O", 0: "."}
    grid = [chars[int(x)] for x in b]
    print("\nBoard:")
    for i in range(0, 9, 3):
        print(" ", grid[i], grid[i+1], grid[i+2])
    print()

# Test predictions
test_boards = [
    torch.tensor([1, 1, 1, 0, 0, 0, 0, 0, 0]),  # X wins row 1
    torch.tensor([0, 0, 0, -1, -1, -1, 0, 0, 0]),  # O wins row 2
    torch.tensor([1, 0, -1, 1, -1, 0, 0, 0, 1]),  # X diagonal
    torch.tensor([0, 0, 0, 0, 0, 0, 0, 0, 0]),  # empty = no winner
]

print("=== TESTING ===")
model.eval()

for idx, tb in enumerate(test_boards):
    tb_device = tb.float().to(device)
    with torch.no_grad():
        out = model(tb_device)
        pred = torch.argmax(out).item()

    print(f"Test case #{idx}: prediction={pred} (0=none,1=X,2=O)")
    print_board(tb.tolist())
