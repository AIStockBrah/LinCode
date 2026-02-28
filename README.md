# LinCode

```
  ██╗     ██╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗
  ██║     ██║████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ██║     ██║██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗
  ██║     ██║██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝
  ███████╗██║██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗
  ╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝╚══════╝
```

**A Claude-powered Ubuntu CLI expert agent with a retro 90s hacker aesthetic.**

LinCode is a localhost web application that acts as an always-available Ubuntu Linux command-line expert. Describe a task in plain English and get back the exact commands to accomplish it. Paste a command you don't understand and get a breakdown of every flag, pipe, and redirection. Ask follow-up questions — it remembers the conversation.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running LinCode](#running-lincode)
- [Using the Interface](#using-the-interface)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [What LinCode Knows](#what-lincode-knows)
- [Example Interactions](#example-interactions)
- [Session Management](#session-management)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Limitations](#limitations)

---

## What It Does

LinCode has two primary modes of operation:

**1. Task → Commands**
Describe what you want to accomplish in plain English. LinCode responds with the exact shell commands needed, formatted in a fenced `bash` code block with a `[COPY]` button, plus a brief explanation of non-obvious parts.

> *"how do I find all files larger than 100MB and sort them by size?"*
> *"set up a cron job that runs a script every day at 3am"*
> *"monitor which process is using port 8080"*

**2. Command → Explanation**
Paste any shell command, script snippet, or sequence of piped commands. LinCode breaks down every component — flags, subshells, redirections, pipes — and tells you what the full thing does. It will also flag destructive operations or suggest safer alternatives where applicable.

> *"explain: find . -name '*.log' -mtime +30 -exec rm {} +"*
> *"what does `2>&1 | tee output.log` do?"*
> *"explain this systemd unit file: ..."*

**3. Multi-turn Conversation**
LinCode maintains the full conversation history within a session. You can ask follow-up questions, request variations, or build on previous answers without repeating context.

> *"now show me how to exclude the /proc directory from that find command"*
> *"what if I want to run that as a different user?"*
> *"give me the version that works with GNU find instead of BSD"*

---

## Prerequisites

- **Python 3.12+** (uses type hint syntax from 3.10+)
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
- **Shared venv** at `/home/odin/KILLERAPPZ/ROBOT/venv` with the following packages already installed:
  - `anthropic >= 0.76.0`
  - `starlette`
  - `uvicorn`
  - `sse-starlette`

No additional installs are required. The shebang line in `lincode.py` points directly to the shared venv Python binary.

---

## Setup

**1. Make the script executable** (first time only):

```bash
chmod +x /home/odin/LinCode/lincode.py
```

**2. Set your Anthropic API key:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

To persist it across terminal sessions, add that line to your `~/.bashrc` or `~/.profile`:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

LinCode will refuse to start and print an error if the key is missing.

---

## Running LinCode

**Default (port 7777, localhost only):**

```bash
cd /home/odin/LinCode
./lincode.py
```

**Custom port:**

```bash
./lincode.py --port 8888
```

**Exposed to your local network** (accessible from other devices on your LAN):

```bash
./lincode.py --host 0.0.0.0 --port 7777
```

> Note: the default `127.0.0.1` binding means LinCode is only reachable from the same machine. Use `0.0.0.0` only on trusted networks.

**With log capture:**

```bash
./lincode.py 2>&1 | tee ~/lincode.log
```

**Kill a running instance:**

```bash
pkill -f lincode.py
```

Once running, open your browser to **http://localhost:7777**.

The terminal will print a startup banner confirming the URL and model in use.

---

## Using the Interface

### Layout

The interface is a single-page app divided into three zones:

```
┌─────────────────────────────────────────────────────┐
│  ASCII logo + status bar                  [HEADER]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Conversation log — scrollable                      │
│  (boot sequence appears here on load)    [MAIN]     │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  $>  [ input textarea ]           [EXEC]  [FOOTER]  │
│  [CLR]  Enter→send | Shift+Enter→newline | Esc→clr  │
└─────────────────────────────────────────────────────┘
```

### Boot Sequence

On every page load, a typewriter animation plays four lines before input is enabled:

```
LINCODE v1.0 INITIALIZING...
LOADING UBUNTU CLI KNOWLEDGE BASE...
ESTABLISHING CLAUDE API CONNECTION...
SYSTEM READY. TYPE A COMMAND OR DESCRIBE A TASK.
```

Input is locked until the sequence completes (~3 seconds). This is intentional — it's aesthetic, not a loading delay.

### Status Indicator

The top-left status indicator changes to reflect the current state:

| Status | Meaning |
|---|---|
| `● READY` | Idle, waiting for input |
| `● STREAMING` | Claude is generating a response |

### Message Layout

- **Your messages** appear right-aligned with a `$>` prefix, brighter green, and a right border — styled like terminal input.
- **LinCode responses** appear left-aligned with a `>` prefix — styled like terminal output.

### Code Blocks

All shell commands in responses are rendered in a styled `bash` code block with:
- A green left border for visual separation
- A `[COPY]` button in the top-right corner that copies the raw command text to your clipboard
- The button briefly shows `[COPIED]` to confirm, then resets

### [CLR] Button

Clears the visible conversation log, wipes the server-side message history, and generates a new session UUID. The next message starts a completely fresh conversation with no context from before.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Send message |
| `Shift + Enter` | Insert newline (for multi-line input) |
| `Esc` | Clear the input field without sending |

The textarea auto-resizes as you type, up to a maximum height of 200px, after which it scrolls internally.

---

## What LinCode Knows

LinCode's system prompt gives it deep, specific knowledge across the following Ubuntu CLI domains:

### Core GNU/Linux Tools
`bash`, `coreutils` (`ls`, `cp`, `mv`, `rm`, `mkdir`, `chmod`, `chown`, `stat`, `touch`, `ln`), `grep`, `sed`, `awk`, `find`, `xargs`, `sort`, `uniq`, `cut`, `tr`, `wc`, `head`, `tail`, `tee`, `paste`, `column`, `diff`, `patch`

### Package Management
`apt`, `apt-get`, `apt-cache`, `dpkg`, `snap`, `add-apt-repository`, `/etc/apt/sources.list`, PPAs, held packages, purge vs remove

### Filesystem & Disk
`df`, `du`, `lsblk`, `fdisk`, `parted`, `mkfs`, `mount`, `umount`, `blkid`, `fstab`, `/proc`, `/sys`, `/dev`, the Linux FHS, symlinks, inodes, extended attributes

### Networking
`curl`, `wget`, `ip`, `ss`, `netstat`, `nmap`, `ssh`, `scp`, `sftp`, `rsync`, `nc` (netcat), `dig`, `host`, `ping`, `traceroute`, UFW, Netplan, `/etc/hosts`, `/etc/resolv.conf`

### Process & Service Management
`ps`, `top`, `htop`, `kill`, `pkill`, `pgrep`, `nice`, `renice`, `nohup`, `bg`, `fg`, `jobs`, `systemctl`, `journalctl`, `cron`, `at`, `systemd` unit files, `dmesg`

### Permissions & Security
`chmod`, `chown`, `chgrp`, `umask`, `setfacl`, `getfacl`, `sudo`, `visudo`, `/etc/sudoers`, `passwd`, `useradd`, `usermod`, `userdel`, `groupadd`, `groups`, `id`, SSH key management

### Shell Scripting
Variables, arrays, arithmetic, `if`/`elif`/`else`, `for`/`while`/`until` loops, functions, `case` statements, here-documents (`<<EOF`), process substitution (`<(cmd)`), command substitution (`$(cmd)`), exit codes, `set -e`/`set -u`/`set -o pipefail`, `trap`

### Archive & Compression
`tar` (all common flag combinations), `gzip`, `bzip2`, `xz`, `zip`, `unzip`, `7z`, `.tar.gz` vs `.tar.bz2` vs `.tar.xz`

### Environment & Shell Config
`PATH`, `LD_LIBRARY_PATH`, `env`, `export`, `source`, `.bashrc`, `.bash_profile`, `.profile`, `/etc/environment`, `alias`, `which`, `type`, `whereis`

### Developer Tooling (CLI)
`git` (all common operations), `docker` / `docker compose`, `python3` / `pip` / `venv`, `node` / `npm` / `npx`, `make`, `gcc`, `gdb`

### Text Editors (CLI)
`vim`, `nano` — common operations, config files, key bindings

---

## Example Interactions

Below are representative examples of the kinds of questions LinCode handles well.

---

**Find large files:**
```
how do I find all files larger than 500MB under /var and sort by size?
```

**Disk usage breakdown:**
```
show me disk usage by directory, sorted, top 10 results
```

**Kill a process on a port:**
```
how do I find and kill whatever is running on port 3000?
```

**Recursive search and replace:**
```
replace all occurrences of "foo" with "bar" across every .py file in a directory
```

**Set up a systemd service:**
```
create a systemd service unit that runs /opt/myapp/start.sh on boot as the www-data user
```

**SSH without a password:**
```
walk me through setting up passwordless SSH login from machine A to machine B
```

**Monitor a log file:**
```
watch /var/log/nginx/access.log in real time and highlight lines containing 4xx or 5xx
```

**Explain an unfamiliar command:**
```
explain: tar -czf - /var/backups | ssh user@remote "cat > backup-$(date +%Y%m%d).tar.gz"
```

**Explain a pipeline:**
```
what does this do: ps aux | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

**Schedule a task:**
```
run /home/odin/scripts/cleanup.sh every Sunday at 2:30am, log output to /var/log/cleanup.log
```

**Docker workflow:**
```
show me how to build an image, run a container, exec into it, and then clean up
```

**Fix permissions recursively:**
```
reset permissions on a web root: directories should be 755, files should be 644
```

---

## Session Management

LinCode stores conversation history in an **in-memory dictionary** on the server, keyed by a UUID generated in your browser's `sessionStorage`.

**What this means:**

- History persists for the lifetime of the server process. Restarting `lincode.py` clears all sessions.
- Each browser tab generates its own session UUID. Two tabs run independent conversations.
- Closing and reopening the same tab in the same browser session (without clearing sessionStorage) will attempt to resume the same server-side session — if the server is still running and hasn't been restarted, context is preserved.
- The `[CLR]` button explicitly clears both the UI log and the server-side history, and generates a new UUID, giving you a completely fresh start.

**There is no persistence to disk.** This is a deliberate design choice — LinCode is a reference tool, not a history manager.

---

## API Reference

LinCode exposes a small HTTP API that can be used directly for scripting or testing.

### `GET /api/health`

Health check. Returns `200 OK` with `{"ok": true}`.

```bash
curl http://localhost:7777/api/health
```

---

### `POST /api/chat`

Send a message and receive a streaming Server-Sent Events (SSE) response.

**Request body (JSON):**

| Field | Type | Description |
|---|---|---|
| `message` | string | The user's question or command |
| `session_id` | string | UUID identifying the conversation session |

**Response:** `text/event-stream` (SSE)

The stream emits events in this sequence:

```
event: token
data: {"token": "Here"}

event: token
data: {"token": " is"}

event: token
data: {"token": " the command..."}

event: done
data: {"ok": true}
```

On error, a single error event is emitted instead of `done`:

```
event: error
data: {"error": "...error message..."}
```

**Example with curl:**

```bash
curl -X POST http://localhost:7777/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "how do I check disk usage?", "session_id": "test-123"}' \
  --no-buffer
```

---

### `DELETE /api/session`

Clear a session's conversation history on the server.

**Request body (JSON):**

| Field | Type | Description |
|---|---|---|
| `session_id` | string | UUID of the session to clear |

**Response:** `{"ok": true}`

```bash
curl -X DELETE http://localhost:7777/api/session \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-123"}'
```

---

## Configuration

All tuneable constants live in `config.py`:

```python
MODEL = "claude-sonnet-4-6"   # Anthropic model ID
HOST  = "127.0.0.1"           # Bind address
PORT  = 7777                  # Listening port
```

To change the port permanently, edit `config.py`. To change it for a single run, use `--port`:

```bash
./lincode.py --port 9000
```

To use a different Claude model, update `MODEL` in `config.py`. Any model ID available through the Anthropic Messages API will work.

---

## Project Structure

```
LinCode/
├── lincode.py          Main application — Starlette routes, streaming logic, sessions
├── config.py           MODEL, HOST, PORT constants
├── templates/
│   └── index.html      Single-page app HTML — layout, ASCII art, DOM structure
└── static/
    ├── style.css       All visual styling — CRT effects, colors, layout, animations
    └── app.js          Frontend logic — SSE reader, markdown renderer, boot sequence
```

**Six files total.** No database, no build step, no package.json, no migrations.

### `lincode.py`

The entire backend. Responsibilities:

- Serves `index.html` at `GET /`
- Accepts `POST /api/chat` with a JSON body, streams tokens back via SSE using `anthropic.AsyncAnthropic().messages.stream()`
- Maintains `sessions: dict[str, list[dict]]` in memory — a map from session UUID to message history
- Handles `DELETE /api/session` to clear history
- Validates `ANTHROPIC_API_KEY` at startup and exits immediately if missing

### `config.py`

Three constants. Edit here to change model, host, or port.

### `templates/index.html`

Pure HTML — no templating engine, no JavaScript frameworks. Loaded fresh on each request (the file is read from disk on every `GET /`). Contains the ASCII art header, the message log container, and the input footer.

### `static/style.css`

All visual effects are CSS-only:

| Effect | Technique |
|---|---|
| CRT scanlines | `repeating-linear-gradient` on a fixed full-screen overlay |
| CRT vignette | `radial-gradient` from transparent center to dark edges |
| Phosphor glow | `text-shadow` with multiple layered blur radii |
| Screen flicker | `@keyframes flicker` fired once on body load |
| Logo glow pulse | `@keyframes glow-pulse` continuous on the ASCII header |

### `static/app.js`

Vanilla JavaScript, no libraries. Responsibilities:

- Generates a session UUID on first load, stores it in `sessionStorage`
- Runs the typewriter boot sequence, then enables input
- Sends messages via `fetch()` and reads the SSE response as a `ReadableStream` (the `EventSource` API is GET-only and cannot be used here)
- Parses the SSE stream manually: buffers chunks, splits on newlines, tracks `event:` and `data:` line pairs
- Renders Claude's responses with a minimal inline markdown renderer (fenced code blocks, inline code, bold, bullet lists) — no external library
- Re-renders the full accumulated response on every token, so formatting appears correctly as it streams in
- Handles the `[COPY]` buttons, `[CLR]` button, keyboard shortcuts, and textarea auto-resize

---

## Design Decisions

**No persistence.** LinCode is a lookup and explanation tool. Conversation history in a session is useful for follow-up questions, but long-term storage would add complexity with minimal benefit for this use case.

**No external JS dependencies.** The retro aesthetic works entirely through CSS. A markdown library would add ~50KB and a build step. The inline renderer handles everything Claude realistically outputs for CLI documentation.

**POST + ReadableStream instead of EventSource.** The browser `EventSource` API only supports GET requests. Since chat requires a request body (message + session ID), the frontend uses `fetch()` with manual SSE parsing instead.

**Shared venv, no installs.** LinCode deliberately reuses `/home/odin/KILLERAPPZ/ROBOT/venv`. Zero setup overhead — if the venv exists and the API key is set, the app runs.

**`127.0.0.1` default binding.** LinCode makes real API calls using a sensitive key. Binding to localhost by default prevents accidental exposure on shared or public networks.

---

## Limitations

- **Session history is ephemeral.** Restarting `lincode.py` clears all conversations. There is no way to resume a session after a restart.
- **One response at a time.** The `[EXEC]` button and input are locked during streaming. You cannot send a second message until the current response completes.
- **No file uploads.** LinCode cannot read your actual scripts, configs, or logs. You can paste content directly into the input field.
- **Ubuntu-focused.** The system prompt is tuned for Ubuntu/Debian. It will handle general Linux questions well, but distro-specific commands for Arch, Fedora, or NixOS may be less reliable.
- **Max 4096 output tokens per response.** Sufficient for any command explanation or script, but not suitable for generating very long documents.
- **Costs API credits.** Every message sent to LinCode makes a real call to the Anthropic API billed to your account. LinCode does not implement rate limiting or usage tracking.
