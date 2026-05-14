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
import { existsSync, statSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  indexKnowledgeBase,
  queryKnowledgeBase,
  startKnowledgeWatcher,
  getRagStatus,
} from './rag.mjs';
import { createMasker, loadMaskTerms, resetMaskMap } from './mask.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const AGENT_DIR = process.env.METODIST_AGENT_DIR || '';
// Claude CLI shu BO'SH papkada ishlaydi — normativ hujjatlarga (AGENT_DIR)
// to'g'ridan-to'g'ri kira olmasligi uchun. Unga faqat maskalangan matn beriladi.
const AGENT_WORKDIR = path.join(__dirname, '..', '.agent-workdir');
// Claude faqat berilgan matnga javob bersin — fayl/tarmoq vositalari o'chirilgan.
const DISALLOWED_TOOLS = 'Bash,Read,Edit,Write,Glob,Grep,WebFetch,WebSearch,NotebookEdit';
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

try {
  mkdirSync(AGENT_WORKDIR, { recursive: true });
} catch {}

// --- Auth config ---
const AUTH_EMAIL = (process.env.AUTH_EMAIL || '').trim().toLowerCase();
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const TOKEN_TTL = '7d';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.txt', '.md']);

// Normativ hujjat sifatida sanaladigan fayl turlari (carousel/dashboard uchun).
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx']);
const MAX_SCAN_DEPTH = 6;

function isDocFile(name) {
  return DOC_EXT.has(path.extname(name).toLowerCase());
}

function countDocsRecursive(dir, depth = 0) {
  if (depth > MAX_SCAN_DEPTH) return 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      count += countDocsRecursive(path.join(dir, entry.name), depth + 1);
    } else if (entry.isFile() && isDocFile(entry.name)) {
      count += 1;
    }
  }
  return count;
}

// Papka ichidagi hujjatlarni rekursiv skan qiladi: soni, umumiy hajmi va turlari bo'yicha.
function scanDocsRecursive(dir, depth, acc) {
  if (depth > MAX_SCAN_DEPTH) return acc;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDocsRecursive(full, depth + 1, acc);
    } else if (entry.isFile() && isDocFile(entry.name)) {
      const ext = path.extname(entry.name).toLowerCase();
      acc.count += 1;
      try {
        acc.sizeBytes += statSync(full).size;
      } catch {}
      if (ext === '.pdf') acc.pdf += 1;
      else if (ext === '.doc' || ext === '.docx') acc.word += 1;
      else if (ext === '.xls' || ext === '.xlsx') acc.excel += 1;
    }
  }
  return acc;
}

// Bitta papka/fayl nomini AGENT_DIR ostida xavfsiz hal qiladi (path traversal'ni bloklaydi).
function resolveUnderAgentDir(segment) {
  if (
    typeof segment !== 'string' ||
    !segment ||
    segment.includes('/') ||
    segment.includes('\\') ||
    segment.includes('\0') ||
    segment === '.' ||
    segment === '..'
  ) {
    return null;
  }
  const base = path.resolve(AGENT_DIR);
  const resolved = path.resolve(base, segment);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

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

app.get('/api/rag/status', requireAuth, (_req, res) => {
  res.json(getRagStatus());
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// AGENT_DIR ichidagi, kamida bitta normativ hujjati bor papkalar ro'yxati.
app.get('/api/folders', requireAuth, (_req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  let entries;
  try {
    entries = readdirSync(AGENT_DIR, { withFileTypes: true });
  } catch (e) {
    res.status(500).json({ error: `Papkani o'qib bo'lmadi: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  const folders = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = path.join(AGENT_DIR, entry.name);
    const scan = scanDocsRecursive(full, 0, { count: 0, sizeBytes: 0, pdf: 0, word: 0, excel: 0 });
    if (scan.count === 0) continue;
    let subfolderCount = 0;
    try {
      subfolderCount = readdirSync(full, { withFileTypes: true }).filter(
        (s) => s.isDirectory() && !s.name.startsWith('.')
      ).length;
    } catch {}
    let modifiedAt = null;
    try {
      modifiedAt = statSync(full).mtime.toISOString();
    } catch {}
    folders.push({
      name: entry.name,
      documentCount: scan.count,
      subfolderCount,
      modifiedAt,
      totalSizeBytes: scan.sizeBytes,
      pdfCount: scan.pdf,
      wordCount: scan.word,
      excelCount: scan.excel,
    });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ folders });
});

// Tanlangan papkadagi normativ hujjatlar va ichki papkalar.
app.get('/api/folders/:folder/documents', requireAuth, (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const folderPath = resolveUnderAgentDir(req.params.folder);
  if (!folderPath || !existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    res.status(404).json({ error: 'Papka topilmadi.' });
    return;
  }
  let entries;
  try {
    entries = readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    res.status(500).json({ error: `Papkani o'qib bo'lmadi: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  const documents = [];
  const subfolders = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      subfolders.push({ name: entry.name, documentCount: countDocsRecursive(full) });
    } else if (entry.isFile() && isDocFile(entry.name)) {
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      documents.push({
        name: entry.name,
        format: path.extname(entry.name).toLowerCase().slice(1),
        sizeBytes: st.size,
        modifiedAt: st.mtime.toISOString(),
      });
    }
  }
  documents.sort((a, b) => a.name.localeCompare(b.name));
  subfolders.sort((a, b) => a.name.localeCompare(b.name));
  let modifiedAt = null;
  try {
    modifiedAt = statSync(folderPath).mtime.toISOString();
  } catch {}
  res.json({ folder: req.params.folder, modifiedAt, documents, subfolders });
});

// Hujjatni view (inline) yoki download (?download=1) qilish.
app.get('/api/folders/:folder/files/:name', requireAuth, (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const folderPath = resolveUnderAgentDir(req.params.folder);
  if (!folderPath) {
    res.status(400).json({ error: "Noto'g'ri papka nomi." });
    return;
  }
  const fileName = req.params.name;
  if (
    typeof fileName !== 'string' ||
    !fileName ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0') ||
    fileName === '.' ||
    fileName === '..' ||
    !isDocFile(fileName)
  ) {
    res.status(400).json({ error: "Noto'g'ri fayl nomi." });
    return;
  }
  const filePath = path.join(folderPath, fileName);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.status(404).json({ error: 'Fayl topilmadi.' });
    return;
  }
  if (req.query.download === '1') {
    res.download(filePath, fileName);
  } else {
    res.sendFile(filePath);
  }
});

function runClaude(prompt, sessionId) {
  return new Promise((resolve, reject) => {
    // --add-dir BERILMAYDI va cwd bo'sh papka — Claude normativ hujjatlarni
    // o'qiy olmaydi; --disallowedTools fayl/tarmoq vositalarini bloklaydi.
    const args = [
      '-p',
      '--output-format',
      'json',
      '--disallowedTools',
      DISALLOWED_TOOLS,
    ];
    if (sessionId) {
      args.unshift('--resume', sessionId);
    }

    const child = spawn(CLAUDE_BIN, args, {
      cwd: AGENT_WORKDIR,
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    child.stdin.on('error', () => {});
    child.stdin.write(prompt);
    child.stdin.end();

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
  resetMaskMap();
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

  let ragContext = '';
  if (message) {
    const rag = await queryKnowledgeBase(AGENT_DIR, message);
    if (rag && Array.isArray(rag.chunks) && rag.chunks.length > 0) {
      const excerpts = rag.chunks
        .map((c, i) => `[${i + 1}] (${c.rel_path})\n${c.text}`)
        .join('\n\n');
      ragContext =
        `--- Bilim bazasidan tegishli parchalar (avtomatik qidiruv natijasi) ---\n` +
        `${excerpts}\n` +
        `--- Parchalar tugadi. Maxfiylik sababli asl fayllar sizga berilmaydi — ` +
        `faqat shu parchalarga asoslanib javob bering. Parcha yetarli bo'lmasa, ` +
        `foydalanuvchidan aniqlik so'rang. ---`;
    }
  }

  // CLAUDE.md yo'riqnomasini o'zimiz o'qib beramiz (Claude endi AGENT_DIR ga kira olmaydi).
  let claudeMd = '';
  const claudeMdPath = path.join(AGENT_DIR, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      claudeMd = readFileSync(claudeMdPath, 'utf8');
    } catch {}
  }

  const contentParts = [];
  if (claudeMd) {
    contentParts.push(`--- Yo'riqnoma (CLAUDE.md) ---\n${claudeMd}\n--- Yo'riqnoma tugadi ---`);
  }
  if (message) contentParts.push(message);
  if (ragContext) contentParts.push(ragContext);
  if (fileText) {
    contentParts.push(`--- Biriktirilgan fayl: ${fileName} ---\n${fileText}\n--- Fayl tugadi ---`);
  }
  const rawContent = contentParts.join('\n\n');

  // Maxfiylik: matnni Claude (bulut) ga yuborishdan OLDIN maskalaymiz.
  const masker = createMasker(loadMaskTerms());
  const maskedContent = masker.mask(rawContent);
  const privacyNote =
    `\n\n--- MAXFIYLIK QOIDASI ---\n` +
    `Yuqoridagi matndagi [MAXFIY_xxx], [RAQAM_xxx], [TELEFON_xxx], [EMAIL_xxx] ` +
    `belgilari maxfiy ma'lumotlar o'rnida turibdi. Javobingizda ham AYNAN shu ` +
    `belgilardan foydalaning — asl ism, raqam yoki qiymatni taxmin qilmang, ` +
    `tiklamang yoki so'ramang.`;
  const prompt = maskedContent + privacyNote;

  try {
    const result = await runClaude(prompt, currentSessionId);
    if (result && typeof result.session_id === 'string') {
      currentSessionId = result.session_id;
    }
    const rawReply =
      (result && typeof result.result === 'string' && result.result) ||
      "Bo'sh javob qaytdi.";
    // Claude javobidagi belgilarni asl qiymatlarga tiklab, foydalanuvchiga ko'rsatamiz.
    const reply = masker.unmask(rawReply);
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

// Faqat localhost (127.0.0.1) da tinglaydi — tarmoqdagi boshqa qurilmalar kira olmaydi.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[metodistai] backend listening on http://127.0.0.1:${PORT} (faqat localhost)`);
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
  if (!dirError) {
    indexKnowledgeBase(AGENT_DIR);
    startKnowledgeWatcher(AGENT_DIR);
  }
});
