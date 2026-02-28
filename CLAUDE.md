# LinCode

Minimalist retro 90s hacker-aesthetic GUI — a Claude-powered Ubuntu CLI expert agent.

Accepts natural language task descriptions and outputs Ubuntu CLI commands; accepts pasted
commands/code and explains what they do. Supports multi-turn conversation.

## Quick Start

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
./lincode.py
# Open http://localhost:7777
```

## Setup

No installs needed. Shebang points to the shared venv:
`/home/odin/KILLERAPPZ/ROBOT/venv` (has anthropic 0.76.0, starlette, uvicorn, sse-starlette).

Make executable on first use:
```bash
chmod +x /home/odin/LinCode/lincode.py
```

Required environment variable:
```bash
export ANTHROPIC_API_KEY="..."
```

## Run / Kill / Log

```bash
# Run (default port 7777)
./lincode.py

# Custom port
./lincode.py --port 8888

# Kill
pkill -f lincode.py

# With log capture
./lincode.py 2>&1 | tee lincode.log
```

## Project Structure

```
LinCode/
├── CLAUDE.md           # This file
├── lincode.py          # Starlette app: routes, Claude streaming, session state
├── config.py           # MODEL, HOST, PORT constants
├── templates/
│   └── index.html      # Single-page app: ASCII header, message log, input footer
└── static/
    ├── style.css       # All CRT/retro visual effects
    └── app.js          # SSE stream reader, markdown renderer, boot sequence
```

Six files total. No database, no package.json, no migrations.

## Architecture

- **Sessions**: In-memory dict `sessions: dict[str, list[dict]]`, keyed by UUID from
  browser `sessionStorage`. Ephemeral — cleared on server restart.
- **Streaming**: `POST /api/chat` → `anthropic.AsyncAnthropic().messages.stream()` →
  `EventSourceResponse` (sse_starlette). Frontend reads via `fetch()` + `ReadableStream`,
  NOT `EventSource` API (which is GET-only).
- **SSE format**: `event: token\ndata: {"token": "..."}\n\n` and `event: done\ndata: {"ok": true}\n\n`
- **Pattern source**: Mirrors `/home/odin/ARKIAGENT/web_app.py` — same Starlette +
  EventSourceResponse structure.

## Model & Config

See `config.py`:
- Model: `claude-sonnet-4-6`
- Host: `127.0.0.1`
- Port: `7777`

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Serve `templates/index.html` |
| POST | `/api/chat` | Streaming chat (SSE response) |
| DELETE | `/api/session` | Clear session history |
| GET | `/api/health` | `{"ok": true}` |
| GET | `/static/*` | Static assets |

## Visual Effects (do not break)

- **Scanlines**: `.scanlines` div — `repeating-linear-gradient`, `z-index: 9999`, `pointer-events: none`
- **Vignette**: `.crt-vignette` div — `radial-gradient`, `z-index: 9998`, `pointer-events: none`
- **Phosphor glow**: `text-shadow: 0 0 5px var(--phosphor)` on text elements
- **Screen flicker**: `@keyframes flicker` on `body`, fires once on load
- **Glow pulse**: `@keyframes glow-pulse` on `.logo` ASCII art, continuous

## Implementation Sequence

1. Create `config.py` + minimal `lincode.py` (index route only) → verify boot on port 7777
2. Add `SYSTEM_PROMPT` + `/api/chat` SSE route → test with `curl`
3. Build `index.html` DOM structure + wire up `app.js` streaming
4. Write `style.css` retro effects → verify aesthetic
5. Add markdown renderer + copy buttons
6. Add boot sequence animation
7. Wire `[CLR]` button and session clear
8. Final polish: health check, keyboard shortcuts, auto-focus

## Verification

```bash
# After ./lincode.py:
curl http://localhost:7777/api/health
# → {"ok": true}

# Test streaming:
curl -X POST http://localhost:7777/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "how do I find files larger than 100MB?", "session_id": "test"}' \
  --no-buffer

# Expected: SSE stream of tokens ending with event: done
```
