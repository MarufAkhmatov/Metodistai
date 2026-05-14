import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PDFParse } from 'pdf-parse';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const AGENT_DIR = process.env.METODIST_AGENT_DIR || '';
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// --- Auth config ---
const AUTH_EMAIL = (process.env.AUTH_EMAIL || '').trim().toLowerCase();
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const TOKEN_TTL = '7d';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.md']);

function authConfigured() {
  return Boolean(AUTH_EMAIL && AUTH_PASSWORD_HASH && SESSION_SECRET);
}

function validateAgentDir() {
  if (!AGENT_DIR) {
    return "METODIST_AGENT_DIR .env ichida sozlanmagan. Loyiha ildizida .env yarating va papka yo'lini yozing.";
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
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      try { await parser.destroy(); } catch {}
    }
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
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

let currentSessionId = null;

// --- Auth middleware ---
function requireAuth(req, res, next) {
  if (!authConfigured()) {
    res.status(500).json({ error: 'Autentifikatsiya sozlanmagan. .env faylida AUTH_EMAIL, AUTH_PASSWORD_HASH, SESSION_SECRET ni tekshiring.' });
    return;
  }
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Avtorizatsiya kerak.' });
    return;
  }
  try {
    req.user = jwt.verify(token, SESSION_SECRET);
    next();
  } catch {
    res.clearCookie('token', { path: '/' });
    res.status(401).json({ error: 'Sessiya tugagan. Qaytadan kiring.' });
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urining." },
});

app.post('/api/login', loginLimiter, async (req, res) => {
  if (!authConfigured()) {
    res.status(500).json({ error: 'Autentifikatsiya sozlanmagan. .env faylini tekshiring.' });
    return;
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    res.status(400).json({ error: 'Email va parolni kiriting.' });
    return;
  }
  const emailOk = email === AUTH_EMAIL;
  const passwordOk = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
  if (!emailOk || !passwordOk) {
    res.status(401).json({ error: "Email yoki parol noto'g'ri." });
    return;
  }
  const token = jwt.sign({ email: AUTH_EMAIL }, SESSION_SECRET, { expiresIn: TOKEN_TTL });
  res.cookie('token', token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });
  res.json({ ok: true, email: AUTH_EMAIL });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

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

app.post('/api/reset', requireAuth, (_req, res) => {
  currentSessionId = null;
  res.json({ ok: true });
});

app.post('/api/chat', requireAuth, upload.single('file'), async (req, res) => {
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
    res.status(400).json({ error: 'Xabar yoki fayl yuboring.' });
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
  if (!authConfigured()) {
    console.warn('[metodistai] WARNING: Autentifikatsiya sozlanmagan — .env faylida AUTH_EMAIL, AUTH_PASSWORD_HASH, SESSION_SECRET kerak. Sayt kirishni rad etadi.');
  } else {
    console.log(`[metodistai] auth enabled for: ${AUTH_EMAIL}`);
  }
});
