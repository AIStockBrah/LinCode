#!/home/odin/KILLERAPPZ/ROBOT/venv/bin/python3
"""
LinCode — Claude-powered Ubuntu CLI expert agent.

Usage:
    ./lincode.py
    ./lincode.py --port 8888
    ./lincode.py --host 0.0.0.0 --port 7777
"""

import json
import os
import sys
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv

import anthropic
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

import config


# =============================================================================
# PATHS
# =============================================================================

LINCODE_DIR = Path(__file__).parent

load_dotenv(LINCODE_DIR / ".env")


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT = """You are LinCode, an expert Ubuntu Linux CLI assistant.

You have encyclopedic knowledge of:
- All standard GNU/Linux tools (bash, coreutils, grep, sed, awk, find, xargs)
- Ubuntu/Debian package management (apt, dpkg, snap)
- Linux Filesystem Hierarchy Standard (/etc, /var, /proc, /sys, /usr, /opt)
- Network tools (curl, wget, ip, ss, netstat, nmap, ssh, scp, rsync, nc)
- Process management (ps, top, kill, pkill, systemctl, journalctl, cron)
- File permissions (chmod, chown, umask, setfacl, getfacl)
- Text processing (cut, sort, uniq, tr, wc, head, tail, tee, paste, column)
- Archive/compression (tar, gzip, bzip2, xz, zip, 7z)
- Disk tools (df, du, lsblk, fdisk, parted, mkfs, mount, umount)
- Shell scripting (variables, loops, conditionals, functions, heredocs, process substitution)
- Environment variables, .bashrc, .profile, PATH, aliases
- User/group management (useradd, usermod, passwd, groups, sudo, visudo)
- Git, Docker, Python/pip/venv, Node/npm from the command line
- Ubuntu-specific: UFW, Netplan, snap, add-apt-repository, /etc/apt/sources.list

## Behavior

When asked how to do something:
1. Output the exact command(s) in a fenced ```bash code block
2. Briefly explain what each part does (1-2 lines max) only if non-obvious
3. Note important flags or safer alternatives if relevant

When given code or a command to explain:
1. Break down each component (flags, pipes, redirections, subshells)
2. State what the full command does as a whole
3. Flag potential issues or better alternatives if applicable

Rules:
- Always use fenced ```bash blocks for commands
- Use inline `backticks` for file paths, variable names, and flags
- Be terse. 3 commands > 3 paragraphs.
- If a command needs sudo, say so explicitly
- If a command is destructive (rm -rf, dd, mkfs), prepend a WARNING: comment
- Prefer commands available by default on Ubuntu without extra installs
- The user is a developer on Ubuntu. Assume competence."""


# =============================================================================
# SESSION STATE
# =============================================================================

sessions: dict[str, list[dict]] = {}
client = anthropic.AsyncAnthropic()


# =============================================================================
# ROUTES
# =============================================================================

async def index_page(request: Request) -> HTMLResponse:
    html_path = LINCODE_DIR / "templates" / "index.html"
    return HTMLResponse(html_path.read_text())


async def health(request: Request) -> JSONResponse:
    return JSONResponse({"ok": True})


async def chat(request: Request) -> EventSourceResponse:
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id", "")

    if not message:
        return JSONResponse({"error": "message required"}, status_code=400)
    if not session_id:
        return JSONResponse({"error": "session_id required"}, status_code=400)

    history = sessions.setdefault(session_id, [])
    history.append({"role": "user", "content": message})

    async def generate() -> AsyncGenerator:
        full_response = ""
        try:
            async with client.messages.stream(
                model=config.MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=history,
            ) as stream:
                async for text in stream.text_stream:
                    full_response += text
                    yield {"event": "token", "data": json.dumps({"token": text})}
            history.append({"role": "assistant", "content": full_response})
            yield {"event": "done", "data": json.dumps({"ok": True})}
        except Exception as e:
            if history and history[-1]["role"] == "user":
                history.pop()
            yield {"event": "error", "data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate())


async def clear_session(request: Request) -> JSONResponse:
    body = await request.json()
    session_id = body.get("session_id", "")
    sessions.pop(session_id, None)
    return JSONResponse({"ok": True})


# =============================================================================
# APP
# =============================================================================

routes = [
    Route("/", endpoint=index_page),
    Route("/api/health", endpoint=health),
    Route("/api/chat", endpoint=chat, methods=["POST"]),
    Route("/api/session", endpoint=clear_session, methods=["DELETE"]),
    Mount("/static", StaticFiles(directory=str(LINCODE_DIR / "static")), name="static"),
]

app = Starlette(routes=routes)


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import argparse

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="LinCode — Ubuntu CLI Expert Agent")
    parser.add_argument("--host", default=config.HOST, help=f"Host (default: {config.HOST})")
    parser.add_argument("--port", type=int, default=config.PORT, help=f"Port (default: {config.PORT})")
    args = parser.parse_args()

    banner = r"""
  ██╗     ██╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗
  ██║     ██║████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ██║     ██║██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗
  ██║     ██║██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝
  ███████╗██║██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗
  ╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝╚══════╝
"""
    print(banner)
    print(f"  Ubuntu CLI Expert Agent  |  http://localhost:{args.port}")
    print(f"  Model: {config.MODEL}")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
