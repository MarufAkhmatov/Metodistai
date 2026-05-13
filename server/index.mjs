import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const AGENT_DIR = process.env.METODIST_AGENT_DIR || '';
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.md']);

function validateAgentDir() {
  if (!AGENT_DIR) {
    return 'METODIST_AGENT_DIR .env ichida sozlanmagan. Loyiha ildizida .env yarating va papka yo\'lini yozing.';
  }
  if (!existsSync(AGENT_DIR)) {
    return `Papka topilmadi: ${AGENT_DIR}. .env ichidagi METODIST_AGENT_DIR ni tekshiring.`;
  }
  try {
    if (!statSync(AGENT_DIR).isDirectory()) {
      return `${AGENT_DIR} — papka emas.`;
    }
  } catch (e) {
    return `Papkaga kirib bo'lmadi: ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Qo'llanilmaydigan fayl turi: ${ext}. Faqat .pdf, .docx, .txt, .md`);
  }
  if (ext === '.pdf') {
    const result = await pdfParse(file.buffer);
    return result.text || '';
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }
  return file.buffer.toString('utf-8');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

const app = express();
app.use(express.json({ limit: '1mb' }));

let currentSessionId = null;

function runClaude(prompt, sessionId) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json', '--add-dir', AGENT_DIR];
    if (sessionId) {
      args.unshift('--resume', sessionId);
    }

    const child = spawn(CLAUDE_BIN, args, {
      cwd: AGENT_DIR,
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
      } catch {
        resolve({ result: stdout.trim(), session_id: sessionId ?? null });
      }
    });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: !validateAgentDir(),
    agentDir: AGENT_DIR || null,
    error: validateAgentDir(),
    sessionId: currentSessionId,
  });
});

app.post('/api/reset', (_req, res) => {
  currentSessionId = null;
  res.json({ ok: true });
});

app.post('/api/chat', upload.single('file'), async (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  let fileText = '';
  let fileName = '';

  if (req.file) {
    try {
      fileText = await extractText(req.file);
      fileName = req.file.originalname;
      console.log(`[chat] extracted ${fileText.length} chars from ${fileName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
      return;
    }
  }

  if (!message && !fileText) {
    res.status(400).json({ error: "Xabar yoki fayl yuboring." });
    return;
  }

  const promptParts = [];
  if (message) promptParts.push(message);
  if (fileText) {
    promptParts.push(`\n\n--- Biriktirilgan fayl: ${fileName} ---\n${fileText}\n--- Fayl tugadi ---`);
  }
  const prompt = promptParts.join('');

  try {
    const result = await runClaude(prompt, currentSessionId);
    if (result && typeof result.session_id === 'string') {
      currentSessionId = result.session_id;
    }
    const reply =
      (result && typeof result.result === 'string' && result.result) ||
      "Bo'sh javob qaytdi.";
    res.json({ reply, sessionId: currentSessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[chat] error:', msg);
    res.status(500).json({ error: msg });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: `Fayl juda katta. Limit: ${MAX_FILE_BYTES / 1024 / 1024} MB` });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
});

app.listen(PORT, () => {
  console.log(`[metodistai] backend listening on http://localhost:${PORT}`);
  console.log(`[metodistai] using CLI: ${CLAUDE_BIN}`);
  const dirError = validateAgentDir();
  if (dirError) {
    console.warn(`[metodistai] WARNING: ${dirError}`);
  } else {
    console.log(`[metodistai] using AGENT_DIR: ${AGENT_DIR}`);
  }
});
