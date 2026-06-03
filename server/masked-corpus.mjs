// Maskalangan korpus nusxasi.
//
// Maqsad: agent (Claude CLI) hujjatlarni TO'LIQ o'qiy olsin (aniqlik uchun),
// LEKIN bulutga faqat MASKALANGAN matn chiqsin (bank siri / shaxsiy ma'lumot
// xom holda Anthropic serverlariga bormasin).
//
// Usul: RAG indeksidagi (.rag/chunks.json) parchalardan har bir hujjatning
// to'liq matnini qayta yig'amiz, maskalaymiz va alohida papkaga (.txt) yozamiz.
// Agentning ish papkasi (cwd) shu maskalangan papka bo'ladi — u faqat shu
// matnlarni o'qiy oladi, xom fayllarga (AGENT_DIR) yo'li yo'q.
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

// rag.py bilan bir xil bo'lishi SHART (chunk_text overlap).
const CHUNK_OVERLAP = 200;

// rel_path xavfsizligi: '..' yoki absolyut yo'lni rad etamiz.
function safeRel(rel) {
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('\0')) return null;
  if (norm.split('/').some((seg) => seg === '..')) return null;
  return norm;
}

// Parchalardan har bir hujjatning to'liq matnini qayta yig'ish.
// chunk0 = text[0:1000], chunk1 = text[800:1800] ... => full = chunk0 + chunk[i>0].slice(OVERLAP)
function reassemble(chunks) {
  const byPath = new Map();
  for (const c of chunks) {
    const rel = safeRel(c && c.rel_path);
    if (!rel) continue;
    if (!byPath.has(rel)) byPath.set(rel, []);
    byPath.get(rel).push(c);
  }
  const out = new Map();
  for (const [rel, list] of byPath) {
    list.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
    let full = '';
    list.forEach((c, i) => {
      const t = typeof c.text === 'string' ? c.text : '';
      full += i === 0 ? t : t.slice(CHUNK_OVERLAP);
    });
    out.set(rel, full);
  }
  return out;
}

// Maskalangan nusxani qurish (faqat zarur bo'lganda — .rag/chunks.json o'zgargan bo'lsa).
// masker — createMasker(...) natijasi; uning globalMap'iga maska yozuvlari to'planadi.
// Qaytaradi: { state: 'fresh'|'built'|'no-index'|'error', files }.
export function ensureMaskedCorpus({ agentDir, maskedDir, markerPath, masker }) {
  const chunksPath = path.join(agentDir, '.rag', 'chunks.json');
  if (!existsSync(chunksPath)) {
    return { state: 'no-index', files: 0 };
  }
  let chunksMtime = 0;
  try {
    chunksMtime = statSync(chunksPath).mtimeMs;
  } catch {
    return { state: 'error', files: 0 };
  }

  // Yangilik tekshiruvi: marker oxirgi qurilgan chunks mtime'ini saqlaydi.
  let lastBuilt = -1;
  let lastFiles = 0;
  if (existsSync(markerPath)) {
    try {
      const m = JSON.parse(readFileSync(markerPath, 'utf8'));
      lastBuilt = m.chunksMtime ?? -1;
      lastFiles = m.files ?? 0;
    } catch {}
  }
  if (lastBuilt === chunksMtime && existsSync(maskedDir)) {
    return { state: 'fresh', files: lastFiles };
  }

  let chunks;
  try {
    chunks = JSON.parse(readFileSync(chunksPath, 'utf8'));
  } catch {
    return { state: 'error', files: 0 };
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { state: 'no-index', files: 0 };
  }

  // Eski nusxani tozalab, qaytadan quramiz.
  try {
    rmSync(maskedDir, { recursive: true, force: true });
  } catch {}
  mkdirSync(maskedDir, { recursive: true });

  const texts = reassemble(chunks);
  let count = 0;
  for (const [rel, full] of texts) {
    if (!full.trim()) continue;
    const masked = masker.mask(full);
    const dest = path.join(maskedDir, `${rel}.txt`);
    try {
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, masked, 'utf8');
      count++;
    } catch {}
  }

  try {
    writeFileSync(
      markerPath,
      JSON.stringify({ chunksMtime, files: count, builtAt: Date.now() }),
      'utf8'
    );
  } catch {}

  return { state: 'built', files: count };
}
