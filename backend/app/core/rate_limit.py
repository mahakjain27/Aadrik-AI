"""
Minimal in-memory attempt tracker for brute-force protection. Single-process
only (resets on restart, doesn't share state across workers) - fine for this
app's current scale; swap for a Redis-backed store if that ever changes.
"""

import threading
import time

_attempts: dict[str, list[float]] = {}
_lock = threading.Lock()


def is_rate_limited(key: str, max_attempts: int, window_seconds: int) -> bool:
    now = time.time()

    with _lock:
        timestamps = [t for t in _attempts.get(key, []) if now - t < window_seconds]
        _attempts[key] = timestamps
        return len(timestamps) >= max_attempts


def record_attempt(key: str) -> None:
    with _lock:
        _attempts.setdefault(key, []).append(time.time())


def clear_attempts(key: str) -> None:
    with _lock:
        _attempts.pop(key, None)
