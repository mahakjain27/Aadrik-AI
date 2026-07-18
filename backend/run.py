import os

import uvicorn

# This project lives inside OneDrive, which interferes with the OS-level file
# change notifications --reload and Python's bytecode cache both rely on
# (edits silently fail to take effect, or a stale .pyc gets served). Forcing
# polling-based watching and disabling bytecode caching sidesteps both.
os.environ.setdefault("WATCHFILES_FORCE_POLLING", "1")
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
