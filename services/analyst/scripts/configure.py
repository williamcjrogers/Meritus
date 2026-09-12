"""Create private local configuration without replacing existing credentials."""

import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    print("Existing .env retained. No credentials were changed.")
else:
    descriptor = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(f"POSTGRES_PASSWORD={secrets.token_hex(32)}\n")
    print("Private .env created. Source credentials can be added using .env.example.")
