// AI Metodist — bilim bazasi (RAG) ko'prigi.
// Python skripti (scripts/rag/rag.py) ni chaqiradi: indekslash, qidirish, kuzatish.
import { spawn } from 'node:child_process';
import { watch, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAG_SCRIPT = path.join(__dirname, '..', 'scripts', 'rag', 'rag.py');
const PYTHON_BIN =
  process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

const INDEX_TIMEOUT_MS = 20 * 60 * 1000; // model yuklab olish + indekslash uchun keng vaqt
const QUERY_TIMEOUT_MS = 90 * 1000;
const WATCH_DEBOUNCE_MS = 4000;

let status = {
  state: 'idle', // idle | indexing | ready | error | disabled
  indexedFiles: 0,
  totalChunks: 0,
  error: null,
  updatedAt: null,
};

let indexing = false;
let reindexQueued = false;
let watcher = null;
let debounceTimer = null;

export function getRagStatus() {
  return { ...status, pythonBin: PYTHON_BIN };
}

function runRag(args, timeoutMs, stdinText) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [RAG_SCRIPT, ...args], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      reject(new Error(`RAG skripti vaqt tugadi (${Math.round(timeoutMs / 1000)}s)`));
    }, timeoutMs);

    child.stdin.on('error', () => {});
    if (stdinText !== undefined) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();

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
            `"${PYTHON_BIN}" topilmadi. Python 3 o'rnatilganini va PATH'da borligini tekshiring (.env: PYTHON_BIN).`
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

      const trimmed = stdout.trim();
      let parsed = null;
      if (trimmed) {
        const lastLine = trimmed.split('\n').pop();
        try {
          parsed = JSON.parse(lastLine);
        } catch {}
      }

      if (code !== 0) {
        const msg = (parsed && parsed.error) || stderr.trim() || `RAG skripti xato kodi ${code}`;
        reject(new Error(msg));
        return;
      }
      if (!parsed) {
        reject(new Error(`RAG skriptidan JSON javob kelmadi. ${stderr.trim()}`));
        return;
      }
      if (parsed.ok === false) {
        reject(new Error(parsed.error || 'RAG skripti xatosi'));
        return;
      }
      resolve(parsed);
    });
  });
}

export async function indexKnowledgeBase(agentDir) {
  if (!existsSync(RAG_SCRIPT)) {
    status = { ...status, state: 'disabled', error: 'rag.py topilmadi' };
    return;
  }
  if (indexing) {
    reindexQueued = true;
    return;
  }
  indexing = true;
  status = { ...status, state: 'indexing', error: null };
  try {
    const result = await runRag(['index', agentDir], INDEX_TIMEOUT_MS);
    status = {
      state: 'ready',
      indexedFiles: result.indexed_files ?? 0,
      totalChunks: result.total_chunks ?? 0,
      error: null,
      updatedAt: Date.now(),
    };
    console.log(
      `[rag] indekslandi: ${status.indexedFiles} fayl, ${status.totalChunks} parcha`
    );
    if (Array.isArray(result.skipped) && result.skipped.length) {
      console.warn(`[rag] indekslanmagan fayllar: ${result.skipped.length} ta`);
    }
  } catch (e) {
    status = {
      ...status,
      state: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
    console.error('[rag] indekslash xatosi:', status.error);
  } finally {
    indexing = false;
    if (reindexQueued) {
      reindexQueued = false;
      indexKnowledgeBase(agentDir);
    }
  }
}

export async function queryKnowledgeBase(agentDir, query) {
  if (!existsSync(RAG_SCRIPT) || status.state === 'disabled') return null;
  if (typeof query !== 'string' || !query.trim()) return null;
  try {
    return await runRag(['query', agentDir], QUERY_TIMEOUT_MS, query);
  } catch (e) {
    console.error('[rag] so\'rov xatosi:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export function startKnowledgeWatcher(agentDir) {
  if (watcher) return;
  try {
    watcher = watch(agentDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = filename.toString().replace(/\\/g, '/');
      // O'zimiz yozadigan fayllarni e'tiborsiz qoldiramiz (cheksiz indekslash siklini oldini olish)
      if (name === '.rag' || name.startsWith('.rag/') || name.includes('/.rag/')) return;
      if (name === 'KNOWLEDGE_INDEX.md' || name.endsWith('/KNOWLEDGE_INDEX.md')) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        console.log("[rag] papkada o'zgarish aniqlandi — qayta indekslanmoqda");
        indexKnowledgeBase(agentDir);
      }, WATCH_DEBOUNCE_MS);
    });
    watcher.on('error', (e) => {
      console.warn('[rag] kuzatuvchi xatosi:', e instanceof Error ? e.message : String(e));
    });
    console.log(`[rag] papka kuzatilmoqda: ${agentDir}`);
  } catch (e) {
    console.warn(
      "[rag] kuzatuvchini ishga tushirib bo'lmadi:",
      e instanceof Error ? e.message : String(e)
    );
  }
}
