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
import { createMasker, loadMaskTerms, resetMaskMap, saveMaskMap, loadMaskMap } from './mask.mjs';
import { markdownToDocxBuffer } from './markdown-to-docx.mjs';
import { ensureMaskedCorpus } from './masked-corpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const AGENT_DIR = process.env.METODIST_AGENT_DIR || '';
const AGENT_WORKDIR = path.join(__dirname, '..', '.agent-workdir');
// MAXFIYLIK: Claude CLI ning ish papkasi (cwd) AGENT_DIR EMAS, balki
// MASKALANGAN nusxa papkasi. Shunda agent hujjatlarni TO'LIQ o'qiy oladi,
// lekin bulutga faqat maskalangan matn chiqadi (xom bank siri/PII chiqmaydi).
// Bu papka .agent-workdir ichida — gitignore'da, AGENT_DIR'dan butunlay alohida.
const MASKED_CORPUS_DIR = path.join(AGENT_WORKDIR, 'masked-corpus');
const MASKED_MARKER = path.join(AGENT_WORKDIR, 'masked-corpus.marker.json');
const MASK_MAP_FILE = path.join(AGENT_WORKDIR, 'mask-map.json');
// Faqat O'QISH ruxsat: Read/Grep/Glob ochiq (maskalangan nusxani o'qish uchun);
// yozish/bajarish/tarmoq (Edit/Write/Bash/Web) bloklangan.
const DISALLOWED_TOOLS = 'Edit,Write,Bash,WebFetch,WebSearch,NotebookEdit';
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Metodolog roli — har bir so'rovga stdin orqali qo'shiladi (CLI argumenti emas,
// shuning uchun Windows shell qochirish muammosi yo'q). 18KB dasturchi CLAUDE.md
// o'rniga shu aniq yo'riqnoma ishlatiladi.
const SYSTEM_INSTRUCTIONS = `Sen "Ипак Йўли" банкининг AI методолог-ёрдамчисисан. Банкнинг ички норматив ҳужжатлари (рус / ўзбек-лотин / ўзбек-кирилл) бўйича ходимларга аниқ, манбага асосланган жавоб берасан.

ИШ ТАРТИБИ ВА ҚОИДАЛАР:
1. ТИЛ: савол қайси тилда ва ёзувда берилса — жавобни ҲАМ айнан шу тил/ёзувда бер (рус / ўзбек-лотин / ўзбек-кирилл).
2. ҲУЖЖАТЛАРНИ ЎҚИ: бутун корпус сенинг ЖОРИЙ ИШ ПАПКАНГ (cwd) да — ҳар бир ҳужжат алоҳида «.txt» файл, папка тузилиши банкдаги бўлимлар билан бир хил. Glob ("**/*.txt"), Grep ва Read билан керакли ҳужжатларни оч. Берилган «Билим базаси» парчалари — фақат йўналтирувчи; етарли бўлса дарров жавоб бер, чуқурроқ керак бўлса тегишли .txt файлларни оч.
3. БУ .txt ФАЙЛЛАР тўлиқ матнни (сканер PDF лар учун OCR матнини ҳам) ўз ичига олади — бошқа жойдан қидирма, фақат шу cwd ичидаги файлларни ўқи.
   МАХФИЙЛИК: матнда [MAXFIY_xxx], [RAQAM_xxx], [TELEFON_xxx], [EMAIL_xxx] белгилари учрайди — булар маxфий қийматлар ўрнида. Жавобингда ҲАМ айнан шу белгиларни сақла, асл қийматни ўйлаб топма.
4. МАНБА: фақат ҳужжатлардаги ҳақиқий матнга таян. Ҳеч нарсани ўйлаб топма. Топилмаса — «ҳужжатларда топилмади» деб айт ва аниқлик сўра.
5. ИҚТИБОС: ҳар бир даъвони манба билан кўрсат — (файл номи, бет/саҳифа N, банд/§). Ташқи (лex.uz) акт бўлса — акт рақами + сана + URL.
6. CLI БУЙРУҚЛАРИНИ ИШГА ТУШИРМА (metodist, npm ва ҳ.к.) — фақат ҳужжатларни ўқиб жавоб бер.
7. ЖАВОБ СИФАТИ: аввал қисқа аниқ жавоб; кейин зарур бўлса банд-даражасидаги жадвал ёки рўйхат; охирида манбалар рўйхати. Тахмин ва сув қуйишдан сақлан.`;

// Кенг қамровли (аудит/таққослаш/«барча ҳужжатлар») саволларда қўшиладиган қўшимча
// йўриқнома. Бунда агент қисқа эмас, ТЎЛИҚ ва тизимли таҳлил қилиши шарт.
const DEEP_AUDIT_INSTRUCTIONS = `--- ЧУҚУР АУДИТ РЕЖИМИ (МАЖБУРИЙ) ---
Бу савол КЕНГ ҚАМРОВЛИ, тизимли таҳлил талаб қилади. Қисқа ёки юзаки жавоб БЕРМА.
Қуйидаги тартибда ишла:

1. РЕЖА ТУЗ: аввал \`Glob\` ("**/*.txt") ва \`Grep\` билан ЖОРИЙ ИШ ПАПКАНГ (cwd) даги тегишли БАРЧА папка ва ҳужжатларни санаб чиқ. Берилган бошланғич парчалар — фақат йўналиш; улар билан ЧЕКЛАНМА.
2. ҲАР БИР тегишли бўлим/папкани кўриб чиқ — биттагина эмас. Ҳар бир ҳужжат cwd да ".txt" файл сифатида (тўлиқ матн, OCR ҳам шу ерда) — уни \`Read\` билан оч.
3. БАНД-БАНД таққосла: ташқи акт/талабнинг ҲАР БИР банди ↔ ички ҳужжатдаги ҳолат. Ҳар бир банд учун: мавжуд / йўқ / тўлиқ эмас — аниқ белгила.
4. ҲЕЧ НИМАНИ ўйлаб топма ва умумлаштириб юзаки ёзма. Фақат ҳужжатдаги ҳақиқий матнга таян; топилмаса "ҳужжатларда топилмади" деб ёз.
5. НАТИЖА ТУЗИЛМАСИ (Markdown):
   • **Резюме**: нечта расхождение/камчилик, нечта бўлим қамраб олинди.
   • **Бўлимлар кесимида жадваллар**: устунлар — № | Папка | Ҳужжат | Камчилик/йўқ банд | Ташқи акт банди.
   • **Бўлимлар бўйича тақсимот** жадвали: Бўлим | Ҳужжатлар сони | Расхождения | Даража (критик/муҳим/ўрта).
   • **ТОП устувор вазифалар** (5–10 та).
   • **Манбалар**: ҳар бир даъво учун (файл номи, бет/§, банд рақами).
6. ҚАМРОВ: барча тегишли бўлимларни ёп. 1–2 ҳужжат билан тугатма — бу етарли эмас.`;

// Савол кенг қамровли (аудит/таққослаш) бўлса — ҳа.
const DEEP_QUESTION_PATTERNS = [
  // uz (lotin)
  'audit', 'auditi', 'taqqosla', 'solishtir', "to'liq tahlil", 'toliq tahlil',
  'barcha hujjat', 'hamma hujjat', 'barcha papka', "har bir bo'lim", 'har bir bolim',
  'nomuvofiq', 'muvofiqlik', "ro'yxatini", 'royxatini', 'qaysi hujjatlar', 'qaysi papkalar',
  'keng qamrov', 'chuqur tahlil',
  // ru
  'аудит', 'сравн', 'сопостав', 'все документ', 'всех документ', 'все внд', 'каждое подразделени',
  'каждый документ', 'расхожд', 'несоответств', 'перечень', 'список всех', 'полный анализ',
  'полная проверк', 'по всем', 'проверь все', 'комплаенс-аудит', 'комплаенс аудит', 'выяви все',
  // en
  'compare', 'comparison', 'all documents', 'across all', 'discrepanc', 'non-compli',
  'full analysis', 'comprehensive', 'which documents', 'list all', 'each department',
];

function isDeepQuestion(text) {
  const low = String(text || '').toLowerCase();
  return DEEP_QUESTION_PATTERNS.some((p) => low.includes(p));
}

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

// multer/busboy fayl nomini latin1 sifatida o'qiydi (RFC 7578), lekin brauzer UTF-8 yuboradi.
// Mojibake'ni oldini olish uchun latin1 -> utf8 ga qayta dekodlaymiz.
function decodeOriginalName(name) {
  if (typeof name !== 'string' || !name) return '';
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
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

// AGENT_DIR ichidagi papkalar ro'yxati.
// Default: faqat ichida normativ hujjati bor papkalar (dashboard uchun).
// `?includeEmpty=1` — bo'sh papkalarni ham qo'shadi (Add files dropdown'i uchun).
app.get('/api/folders', requireAuth, (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const includeEmpty = String(req.query?.includeEmpty || '') === '1';
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
    if (!includeEmpty && scan.count === 0) continue;
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

// AGENT_DIR ichida yangi (bo'sh) papka yaratish — "Create folders" tuguni uchun.
app.post('/api/folders/create', requireAuth, (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  const raw = typeof req.body?.name === 'string' ? req.body.name : '';
  const name = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  if (!name) {
    res.status(400).json({ error: "Papka nomi bo'sh." });
    return;
  }
  if (name === '.' || name === '..' || name.startsWith('.') || name === ARCHIVE_FOLDER_NAME) {
    res.status(400).json({ error: 'Bu nomdan foydalanib bo\'lmaydi.' });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: 'Papka nomi juda uzun (maks 80 belgi).' });
    return;
  }
  const target = path.join(AGENT_DIR, name);
  if (existsSync(target)) {
    res.status(409).json({ error: 'Bu nomdagi papka allaqachon mavjud.' });
    return;
  }
  try {
    mkdirSync(target, { recursive: false });
    res.json({ ok: true, name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

// Tanlangan papkaga fayl yuklash — "Add files" tuguni uchun.
const UPLOAD_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md']);
app.post('/api/folders/:folder/upload', requireAuth, upload.single('file'), (req, res) => {
  const dirError = validateAgentDir();
  if (dirError) {
    res.status(500).json({ error: dirError });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Fayl yuborilmadi.' });
    return;
  }
  const folderPath = resolveUnderAgentDir(req.params.folder);
  if (!folderPath || !existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    res.status(404).json({ error: 'Papka topilmadi.' });
    return;
  }
  const origName = decodeOriginalName(req.file.originalname || '');
  const ext = path.extname(origName).toLowerCase();
  if (!UPLOAD_EXT.has(ext)) {
    res
      .status(400)
      .json({ error: `Qo'llanilmaydigan fayl turi: ${ext}. Faqat .pdf .doc .docx .xls .xlsx .txt .md` });
    return;
  }
  // Fayl nomini xavfsiz qilamiz, lekin asl nomdan ko'p uzoqlashmaymiz.
  const safeName = origName
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  if (!safeName || safeName === '.' || safeName === '..') {
    res.status(400).json({ error: 'Fayl nomi noto\'g\'ri.' });
    return;
  }
  const dest = path.join(folderPath, safeName);
  if (existsSync(dest)) {
    res.status(409).json({ error: 'Shu nomdagi fayl allaqachon mavjud.' });
    return;
  }
  try {
    writeFileSync(dest, req.file.buffer);
    res.json({
      ok: true,
      folder: req.params.folder,
      name: safeName,
      sizeBytes: req.file.size,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
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

function runClaude(prompt, sessionId, opts = {}) {
  const maxTurns = Number.isFinite(opts.maxTurns) ? opts.maxTurns : 48;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : REQUEST_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    // cwd = korpus; faqat o'qish vositalari ochiq (DISALLOWED_TOOLS yozish/tarmoqni bloklaydi).
    // --max-turns: oddiy savol uchun kichik, chuqur audit uchun katta (kechikishni boshqaradi).
    const args = [
      '-p',
      '--output-format',
      'json',
      '--disallowedTools',
      DISALLOWED_TOOLS,
      '--max-turns',
      String(maxTurns),
    ];
    if (sessionId) {
      args.unshift('--resume', sessionId);
    }

    const child = spawn(CLAUDE_BIN, args, {
      // cwd = MASKALANGAN nusxa papkasi (opts.cwd): Claude faqat maskalangan
      // .txt larni o'qiy oladi — xom korpus (AGENT_DIR) ga yo'l yo'q.
      cwd: opts.cwd || AGENT_WORKDIR,
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
      reject(new Error(`Claude CLI timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

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
      // claude -p --output-format json natижани (max-turns/xato бўлса ҳам) stdout'га
      // ёзади. Шунинг учун exit кодга ҚАРАМАЙ аввал stdout'ни ўқиймиз — акс ҳолда
      // "exited with code 1" билан тайёр (ёки қисман) жавоб йўқолади.
      const out = stdout.trim();
      if (out) {
        try {
          resolve(JSON.parse(out));
        } catch {
          resolve({ result: out, session_id: sessionId ?? null });
        }
        return;
      }
      reject(
        new Error(
          `Claude CLI exited with code ${code}.` +
            (stderr.trim() ? ` stderr: ${stderr.trim()}` : ' (chiqishsiz tugadi)')
        )
      );
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
      fileName = decodeOriginalName(req.file.originalname);
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

  // Keng qamrovli (audit/taqqoslash) savol bo'lsa — chuqur rejim:
  // ko'proq boshlang'ich parcha, kuchaytirilgan yo'riqnoma, ko'proq qadam va vaqt.
  const deepMode = isDeepQuestion(message) || isDeepQuestion(fileName);

  let ragContext = '';
  let kbMatches = [];
  // RAG so'rovi: xabar + biriktirilgan fayl matni — yuklangan faylni KB bilan
  // taqqoslash uchun ham tegishli parchalar topilsin.
  const ragQuery = [message, fileText].filter(Boolean).join('\n').slice(0, 4000);
  if (ragQuery.trim()) {
    // Chuqur rejimda korpus bo'ylab keng qamrov uchun ancha ko'p parcha so'raymiz.
    const topK = deepMode ? 40 : 8;
    const rag = await queryKnowledgeBase(AGENT_DIR, ragQuery, topK);
    if (rag && Array.isArray(rag.chunks) && rag.chunks.length > 0) {
      const excerpts = rag.chunks
        .map((c, i) => {
          // To'liq matn cwd ichidagi maskalangan .txt faylida.
          const txtPath = `${c.rel_path.replace(/\\/g, '/')}.txt`;
          return `[${i + 1}] hujjat: ${c.rel_path}\n   to'liq matn (cwd): ${txtPath}\n   parcha: ${c.text}`;
        })
        .join('\n\n');
      ragContext =
        `--- Bilim bazasidan tegishli boshlang'ich parchalar (avtomatik qidiruv) ---\n` +
        `${excerpts}\n` +
        `--- Bu faqat YO'NALTIRUVCHI parchalar. Aniq, band-darajasidagi javob uchun ` +
        `jorij ish papkangiz (cwd) dagi ko'rsatilgan ".txt" faylni Read bilan oching; ` +
        `kerak bo'lsa Grep/Glob ("**/*.txt") bilan boshqa tegishli hujjatlarni ham toping. ---`;
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

  // Metodolog yo'riqnomasi har doim eng boshda (stdin orqali).
  const contentParts = [SYSTEM_INSTRUCTIONS];
  if (deepMode) contentParts.push(DEEP_AUDIT_INSTRUCTIONS);
  if (message) contentParts.push(`--- SAVOL ---\n${message}`);
  if (ragContext) contentParts.push(ragContext);
  if (fileText) {
    contentParts.push(`--- Biriktirilgan fayl: ${fileName} ---\n${fileText}\n--- Fayl tugadi ---`);
  }
  const rawContent = contentParts.join('\n\n');

  // --- Maxfiylik oqimi ---
  // 1) Diskdagi maska xaritasini yuklaymiz (server restart bo'lsa ham unmask ishlasin).
  // 2) Maskalangan korpus nusxasini (agent o'qiydigan .txt papka) zarur bo'lsa quramiz;
  //    bu maskalashda barcha placeholder->asl yozuvlar globalMap'ga to'planadi.
  // 3) Promptni maskalaymiz (hash-asosli — bir xil qiymat doim bir xil belgi).
  // 4) Xaritani diskka saqlaymiz.
  const masker = createMasker(loadMaskTerms());
  loadMaskMap(MASK_MAP_FILE);
  const mirror = ensureMaskedCorpus({
    agentDir: AGENT_DIR,
    maskedDir: MASKED_CORPUS_DIR,
    markerPath: MASKED_MARKER,
    masker,
  });
  const maskedContent = masker.mask(rawContent);
  saveMaskMap(MASK_MAP_FILE);

  const privacyNote =
    `\n\n--- MAXFIYLIK QOIDASI ---\n` +
    `Yuqoridagi matndagi [MAXFIY_xxx], [RAQAM_xxx], [TELEFON_xxx], [EMAIL_xxx] ` +
    `belgilari maxfiy ma'lumotlar o'rnida turibdi. Javobingizda ham AYNAN shu ` +
    `belgilardan foydalaning — asl ism, raqam yoki qiymatni taxmin qilmang, ` +
    `tiklamang yoki so'ramang.`;
  const prompt = maskedContent + privacyNote;

  // Agent FAQAT maskalangan nusxani (cwd) o'qiydi — xom AGENT_DIR ga YO'L YO'Q.
  // Nusxa hali tayyor bo'lmasa (indeks yo'q), bo'sh ishchi papka beriladi:
  // agent faqat promptdagi maskalangan parchalarga tayanadi.
  const corpusReady = mirror.state === 'fresh' || mirror.state === 'built';
  const runCwd = corpusReady ? MASKED_CORPUS_DIR : AGENT_WORKDIR;

  try {
    // Maskalangan nusxa .txt — o'qish tez. Chuqur rejimda ko'proq qadam beriladi,
    // lekin vaqt budjeti uzun emas (tez javob): chuqur 120 qadam/12 daq, oddiy 48/10 daq.
    const runOpts = deepMode
      ? { maxTurns: 120, timeoutMs: 12 * 60 * 1000, cwd: runCwd }
      : { maxTurns: 48, timeoutMs: REQUEST_TIMEOUT_MS, cwd: runCwd };
    const result = await runClaude(prompt, currentSessionId, runOpts);
    if (result && typeof result.session_id === 'string') {
      currentSessionId = result.session_id;
    }
    let rawReply = (result && typeof result.result === 'string' && result.result.trim()) || '';
    // Claude qadamlar chegarasiga (--max-turns) urilса, натижа қисман ёки бўш бўлиши мумкин.
    if (!rawReply && result && result.subtype === 'error_max_turns') {
      rawReply =
        "Савол жуда кенг — белгиланган таҳлил қадамлари тугади. Илтимос, саволни торроқ беринг " +
        "(масалан, аниқ битта ҳужжат ёки битта мавзу бўйича).";
    } else if (!rawReply && result && result.is_error) {
      rawReply = 'Жавоб шакллантиришда хатолик юз берди. Илтимос, саволни қайта беринг.';
    } else if (!rawReply) {
      rawReply = "Bo'sh javob qaytdi.";
    }
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
const server = app.listen(PORT, '127.0.0.1', () => {
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

// Chat-da Claude hujjatlarni o'qib javob berishi bir necha daqiqa olishi mumkin.
// Node'ning standart 5 daqiqalik requestTimeout'i uzun so'rovni uzib qo'yadi
// (brauzer "javob yo'q" ko'radi) — uni o'chiramiz. runClaude o'z timeouti (10 daq) bilan cheklaydi.
server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;
server.keepAliveTimeout = 0;
