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
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
import { markdownToDocxBuffer } from './markdown-to-docx.mjs';

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

// rel_path (ichki papkali bo'lishi mumkin) ni AGENT_DIR ostida xavfsiz hal qiladi.
function resolveRelUnderAgentDir(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) return null;
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.split('/').some((seg) => seg === '..')) return null;
  const base = path.resolve(AGENT_DIR);
  const resolved = path.resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

// RAG chunk'larini yuqori darajadagi papka (departament) bo'yicha guruhlaydi.
function groupKbMatches(chunks) {
  const byFolder = new Map();
  for (const c of chunks) {
    const rel = String((c && c.rel_path) || '').replace(/\\/g, '/');
    if (!rel) continue;
    const slash = rel.indexOf('/');
    const folder = slash >= 0 ? rel.slice(0, slash) : '(ildiz)';
    const name = rel.slice(rel.lastIndexOf('/') + 1);
    if (!byFolder.has(folder)) byFolder.set(folder, new Map());
    byFolder.get(folder).set(rel, name);
  }
  return [...byFolder.entries()].map(([folder, files]) => ({
    folder,
    files: [...files.entries()].map(([relPath, name]) => ({ name, relPath })),
  }));
}

// Oddiy stop-word ro'yxati (uz/ru/en) — keyword qidiruv aniqligi uchun.
const STOPWORDS = new Set([
  'the','and','for','with','from','into','this','that','are','was','were','have','has','had',
  'will','can','may','should','could','would','about','what','which','who','whom','your','our',
  'their','his','her','its','they','them','these','those','here','there','when','where','how',
  'all','any','some','one','two','also','more','most','than','then','only','very',
  'это','что','как','для','или','при','из','по','на','за','от','до','без','над','под','чтобы',
  'если','то','же','ли','бы','быть','есть','был','была','были','будет','была','этой','этом','эта',
  'тот','тех','той','той','один','два','три','эти','такой','такая','такие',
  'uchun','bilan','yoki','bu','shu','ham','hech','kerak','boyicha','quyidagi','quyida','har','bir',
  "bo'lib","bo'ladi","bo'lgan",'esa','agar','ammo','lekin','chunki','keyin','oldin','ostida',
  'ustida','ichida','tashqari','yana','xuddi','aynan','aslida','balki','vaholanki',
]);

function tokenizeForSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// AGENT_DIR ichidagi fayl/papka nomlarini key word'lar bilan solishtirib, top-N papkalarni qaytaradi.
// RAG ishlamasa yoki natija qaytarmasa — fallback. Departament = ildiz-darajadagi papka.
function keywordMatchKB(query, agentDir, opts = {}) {
  const folderLimit = opts.folderLimit ?? 6;
  const filesPerFolder = opts.filesPerFolder ?? 6;
  const maxDepth = opts.maxDepth ?? 4;
  const tokens = [...new Set(tokenizeForSearch(query))];
  if (tokens.length === 0) return [];

  let topFolders = [];
  try {
    topFolders = readdirSync(agentDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith('.') &&
          e.name !== ARCHIVE_FOLDER_NAME &&
          e.name !== '.rag'
      );
  } catch {
    return [];
  }

  const scoreName = (lowName) => {
    let s = 0;
    for (const t of tokens) {
      if (lowName.includes(t)) s += 1;
    }
    return s;
  };

  const results = [];
  for (const folder of topFolders) {
    const folderPath = path.join(agentDir, folder.name);
    const folderNameLow = folder.name.toLowerCase();
    let folderScore = scoreName(folderNameLow) * 3; // papka nomidan match ko'proq vazn
    const matchedFiles = [];

    const walk = (dir, relPrefix, depth) => {
      if (depth > maxDepth) return;
      let entries = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          // Ichki papka nomidan ham bal qo'shamiz
          folderScore += scoreName(entry.name.toLowerCase());
          walk(full, rel, depth + 1);
        } else if (entry.isFile() && isDocFile(entry.name)) {
          const score = scoreName(entry.name.toLowerCase());
          if (score > 0) {
            matchedFiles.push({ name: entry.name, relPath: rel, _score: score });
          }
        }
      }
    };
    walk(folderPath, folder.name, 0);

    const total = folderScore + matchedFiles.reduce((s, f) => s + f._score, 0);
    if (total > 0) {
      matchedFiles.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name));
      results.push({
        folder: folder.name,
        files: matchedFiles.slice(0, filesPerFolder).map(({ _score, ...rest }) => rest),
        _score: total,
      });
    }
  }

  results.sort((a, b) => b._score - a._score);
  return results.slice(0, folderLimit).map(({ _score, ...rest }) => rest);
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

// Bilim bazasidagi faylni (ichki papkali rel_path) view yoki download qilish.
const KB_VIEW_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md']);
app.get('/api/kb/file', requireAuth, (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const rel = typeof req.query.path === 'string' ? req.query.path : '';
  const filePath = resolveRelUnderAgentDir(rel);
  if (
    !filePath ||
    !KB_VIEW_EXT.has(path.extname(filePath).toLowerCase()) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    res.status(404).json({ error: 'Fayl topilmadi.' });
    return;
  }
  if (req.query.download === '1') {
    res.download(filePath, path.basename(filePath));
  } else {
    res.sendFile(filePath);
  }
});

// --- Archive folder ("o'ng-quyi sariq papka") ---
const ARCHIVE_FOLDER_NAME = 'Archive folder';

function ensureArchiveDir() {
  if (!AGENT_DIR) return null;
  const dir = path.join(AGENT_DIR, ARCHIVE_FOLDER_NAME);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function sanitizeName(s, fallback = 'analiz') {
  const cleaned = String(s || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[ -\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

app.get('/api/archive/files', requireAuth, (_req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const dir = ensureArchiveDir();
  if (!dir) {
    res.json({ folder: ARCHIVE_FOLDER_NAME, files: [] });
    return;
  }
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {}
  const files = entries
    .filter((e) => e.isFile() && /\.docx$/i.test(e.name))
    .map((e) => {
      let st = null;
      try {
        st = statSync(path.join(dir, e.name));
      } catch {}
      return {
        name: e.name,
        sizeBytes: st ? st.size : 0,
        modifiedAt: st ? st.mtime.toISOString() : null,
      };
    })
    .sort((a, b) => (b.modifiedAt || '').localeCompare(a.modifiedAt || ''));
  res.json({ folder: ARCHIVE_FOLDER_NAME, files });
});

app.post('/api/save-archive', requireAuth, async (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const markdown = typeof req.body?.markdown === 'string' ? req.body.markdown : '';
  if (!markdown.trim()) {
    res.status(400).json({ error: "Bo'sh matn saqlab bo'lmaydi." });
    return;
  }
  const titleRaw = typeof req.body?.title === 'string' ? req.body.title : '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const firstLine = markdown.split('\n').find((l) => l.trim()) || '';
  const safeTitle = sanitizeName(titleRaw || firstLine.replace(/^#+\s*/, ''));
  const filename = `${stamp}_${safeTitle}.docx`;
  const dir = ensureArchiveDir();
  if (!dir) {
    res.status(500).json({ error: "Arxiv papkasini yaratib bo'lmadi." });
    return;
  }
  try {
    const buffer = await markdownToDocxBuffer(markdown, { title: safeTitle });
    const filePath = path.join(dir, filename);
    writeFileSync(filePath, buffer);
    res.json({
      ok: true,
      filename,
      relPath: `${ARCHIVE_FOLDER_NAME}/${filename}`,
      folder: ARCHIVE_FOLDER_NAME,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[archive] save error:', msg);
    res.status(500).json({ error: msg });
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
  let kbMatches = [];
  // RAG so'rovi: xabar + biriktirilgan fayl matni — yuklangan faylni KB bilan
  // taqqoslash uchun ham tegishli parchalar topilsin.
  const ragQuery = [message, fileText].filter(Boolean).join('\n').slice(0, 4000);
  if (ragQuery.trim()) {
    const rag = await queryKnowledgeBase(AGENT_DIR, ragQuery);
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
      kbMatches = groupKbMatches(rag.chunks);
    }
  }

  // Fallback: RAG ishlamasa yoki natija qaytarmasa — fayl/papka nomlari bo'yicha qidiramiz.
  // Yuklangan fayl nomi ham kuchli signal.
  if (kbMatches.length === 0) {
    const fallbackQuery = [message, fileName].filter(Boolean).join(' ').slice(0, 2000);
    if (fallbackQuery.trim()) {
      kbMatches = keywordMatchKB(fallbackQuery, AGENT_DIR);
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
    res.json({ reply, sessionId: currentSessionId, kbMatches });
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
