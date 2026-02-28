'use strict';

// =============================================================================
// Session
// =============================================================================

let sessionId = sessionStorage.getItem('lincode-session');
if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('lincode-session', sessionId);
}

// =============================================================================
// DOM refs
// =============================================================================

const log       = document.getElementById('message-log');
const input     = document.getElementById('user-input');
const sendBtn   = document.getElementById('send-btn');
const clearBtn  = document.getElementById('clear-btn');
const connStatus = document.getElementById('conn-status');

// =============================================================================
// State
// =============================================================================

let isStreaming = false;

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function scrollToBottom() {
    log.scrollTop = log.scrollHeight;
}

// =============================================================================
// Markdown renderer (~35 lines, no library)
// Handles: fenced code blocks, inline code, **bold**, bullet lists
// =============================================================================

function renderMarkdown(raw) {
    // Split on fenced code blocks — odd indices are code blocks
    const parts = raw.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
        if (i % 2 === 1) {
            // Fenced code block
            const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
            if (match) {
                const lang = escapeHtml(match[1] || '');
                const code = escapeHtml(match[2].trimEnd());
                return `<pre class="code-block"><code class="lang-${lang}">${code}</code>`
                     + `<button class="copy-btn" onclick="copyCode(this)">[COPY]</button></pre>`;
            }
            return escapeHtml(part);
        }

        // Regular text: apply inline markdown
        let html = escapeHtml(part);

        // **bold**
        html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

        // `inline code`
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

        // Bullet list items (- or *)
        html = html.replace(/^[ \t]*[-*] (.+)$/gm, '<li>$1</li>');

        // Wrap consecutive <li> elements in <ul>
        html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }).join('');
}

function copyCode(btn) {
    const code = btn.closest('pre').querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const orig = btn.textContent;
        btn.textContent = '[COPIED]';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {
        btn.textContent = '[ERR]';
        setTimeout(() => { btn.textContent = '[COPY]'; }, 1500);
    });
}

// =============================================================================
// Boot sequence
// =============================================================================

const BOOT_LINES = [
    'LINCODE v1.0 INITIALIZING...',
    'LOADING UBUNTU CLI KNOWLEDGE BASE...',
    'ESTABLISHING CLAUDE API CONNECTION...',
    'SYSTEM READY. TYPE A COMMAND OR DESCRIBE A TASK.',
];

async function bootSequence() {
    for (const line of BOOT_LINES) {
        const div = document.createElement('div');
        div.className = 'boot-line';
        log.appendChild(div);
        for (const char of line) {
            div.textContent += char;
            await sleep(22);
        }
        await sleep(160);
    }
    // Enable input after boot
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
}

// =============================================================================
// Message rendering
// =============================================================================

function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg-user';
    div.innerHTML = '<span class="prefix">$&gt;&nbsp;</span>' + escapeHtml(text);
    log.appendChild(div);
    scrollToBottom();
}

function addAssistantMessage() {
    const div = document.createElement('div');
    div.className = 'msg-assistant';
    log.appendChild(div);
    scrollToBottom();
    return div;
}

// =============================================================================
// Chat / SSE streaming
// =============================================================================

async function sendMessage() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    isStreaming = true;
    input.disabled = true;
    sendBtn.disabled = true;
    connStatus.textContent = '● STREAMING';

    addUserMessage(text);
    input.value = '';
    input.style.height = 'auto';

    const msgDiv = addAssistantMessage();
    let fullText = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, session_id: sessionId }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            msgDiv.innerHTML = '<span class="error-text">ERROR: '
                + escapeHtml(err.error || response.statusText) + '</span>';
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line for next chunk

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (currentEvent === 'token' && data.token) {
                            fullText += data.token;
                            msgDiv.innerHTML =
                                '<span class="prefix">&gt;&nbsp;</span>'
                                + renderMarkdown(fullText);
                            scrollToBottom();
                        } else if (currentEvent === 'error') {
                            msgDiv.innerHTML =
                                '<span class="error-text">ERROR: '
                                + escapeHtml(data.error || 'unknown error') + '</span>';
                        }
                    } catch (_) { /* ignore JSON parse errors */ }
                    currentEvent = null;
                }
            }
        }

        // Ensure final render is complete
        if (fullText) {
            msgDiv.innerHTML =
                '<span class="prefix">&gt;&nbsp;</span>'
                + renderMarkdown(fullText);
            scrollToBottom();
        }

    } catch (err) {
        msgDiv.innerHTML =
            '<span class="error-text">ERROR: ' + escapeHtml(err.message) + '</span>';
    } finally {
        isStreaming = false;
        input.disabled = false;
        sendBtn.disabled = false;
        connStatus.textContent = '● READY';
        input.focus();
    }
}

// =============================================================================
// Controls
// =============================================================================

sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    } else if (e.key === 'Escape') {
        input.value = '';
        input.style.height = 'auto';
    }
});

// Auto-resize textarea
input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
});

clearBtn.addEventListener('click', async () => {
    // Clear visible log
    log.innerHTML = '';

    // Clear server-side session
    await fetch('/api/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});

    // New session UUID so history is truly fresh
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('lincode-session', sessionId);

    const div = document.createElement('div');
    div.className = 'boot-line';
    div.textContent = 'SESSION CLEARED. NEW SESSION INITIALIZED.';
    log.appendChild(div);

    input.focus();
});

// =============================================================================
// Init
// =============================================================================

document.addEventListener('DOMContentLoaded', bootSequence);
