"""Service Window Runner for NASA Astera Watch One-Click Launcher.

Runs a child server command (FastAPI/Uvicorn or Vite/Node), streams live UTF-8 output
to both the console window and the launcher log file, and preserves exit diagnostics.
"""

from __future__ import annotations

import argparse
import ctypes
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def _set_console_title(title: str) -> None:
    if os.name == "nt":
        try:
            ctypes.windll.kernel32.SetConsoleTitleW(title)
        except Exception:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an Astera Watch service with live log teeing.")
    parser.add_argument("--title", required=True, help="Console window title")
    parser.add_argument("--cwd", required=True, help="Working directory")
    parser.add_argument("--log", required=True, help="Log file path")
    parser.add_argument("cmd", nargs=argparse.REMAINDER, help="Command to execute after --")
    args = parser.parse_args()

    cmd = list(args.cmd)
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    if not cmd:
        print("[ERROR] No service command provided after --", file=sys.stderr)
        return 2

    _set_console_title(args.title)

    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")

    started = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"[{started}] Starting service: {' '.join(cmd)} (cwd={args.cwd})\n"

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print(f"=== {args.title} ===")
    print(header.strip(), flush=True)

    with open(log_path, "w", encoding="utf-8", errors="replace") as log_f:
        log_f.write(header)
        log_f.flush()

        proc = subprocess.Popen(
            cmd,
            cwd=args.cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )

        try:
            assert proc.stdout is not None
            for line in proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
                log_f.write(line)
                log_f.flush()
        except KeyboardInterrupt:
            proc.terminate()
        finally:
            rc = proc.wait()

        footer = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Service exited with code {rc}\n"
        log_f.write(footer)
        log_f.flush()
        print(footer.strip(), flush=True)
        return rc


if __name__ == "__main__":
    raise SystemExit(main())
