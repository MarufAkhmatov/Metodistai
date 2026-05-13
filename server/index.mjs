import express from 'express';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

const app = express();
app.use(express.json({ limit: '1mb' }));

let currentSessionId = null;

function runClaude(message, sessionId) {
  return new Promise((resolve, reject) => {
    const args = ['-p', message, '--output-format', 'json'];
    if (sessionId) {
      args.splice(0, 0, '--resume', sessionId);
    }

    const child = spawn(CLAUDE_BIN, args, {
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      reject(new Error(`Claude CLI timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
    }, REQUEST_TIMEOUT_MS);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err && err.code === 'ENOENT') {
        reject(
          new Error(
            `"${CLAUDE_BIN}" topilmadi. Claude Code CLI o'rnatilganligini va PATH'da borligini tekshiring.`
          )
        );
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}. stderr: ${stderr.trim()}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        resolve({ result: stdout.trim(), session_id: sessionId ?? null });
      }
    });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sessionId: currentSessionId });
});

app.post('/api/reset', (_req, res) => {
  currentSessionId = null;
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ error: 'message bo‘sh bo‘lmasligi kerak' });
    return;
  }

  try {
    const result = await runClaude(message, currentSessionId);
    if (result && typeof result.session_id === 'string') {
      currentSessionId = result.session_id;
    }
    const reply =
      (result && typeof result.result === 'string' && result.result) ||
      'Bo‘sh javob qaytdi.';
    res.json({ reply, sessionId: currentSessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[chat] error:', msg);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`[metodistai] backend listening on http://localhost:${PORT}`);
  console.log(`[metodistai] using CLI: ${CLAUDE_BIN}`);
});
