// AI Metodist — maxfiylik (maskalash) qatlami.
// Normativ hujjatlardagi maxfiy ma'lumotlarni Claude (bulut) ga yuborishdan
// OLDIN o'rin egallovchi belgilarga almashtiradi va Claude javobi kelgach
// ASL qiymatlarni tiklaydi. Shu tariqa Anthropic serverlari faqat
// [MAXFIY_xxx] kabi belgilarni ko'radi, asl matnni emas.
//
// DIQQAT: bu mitigatsiya, mutlaq kafolat emas. Tuzilmaviy ma'lumotlar
// (email, telefon, uzun raqamlar) ishonchli aniqlanadi; ism/tashkilot
// nomlari faqat mask-terms.txt ro'yxatidagilar maskalanadi.
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MASK_TERMS_FILE =
  process.env.MASK_TERMS_FILE || path.join(__dirname, '..', 'mask-terms.txt');

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
const DIGITS_RE = /\d{7,}/g;

// Sessiya davomida to'planadigan xarita: o'rin egallovchi belgi -> asl qiymat.
// Bir qiymat doim bir xil belgiga aylanadi (hash asosida), shu sababli
// suhbat davomida (resume) izchillik saqlanadi.
const globalMap = new Map();

export function resetMaskMap() {
  globalMap.clear();
}

export function loadMaskTerms() {
  if (!existsSync(MASK_TERMS_FILE)) return [];
  try {
    return readFileSync(MASK_TERMS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

function shortId(value) {
  return crypto.createHash('sha1').update(value.toLowerCase()).digest('hex').slice(0, 6);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createMasker(terms) {
  const termRes = (terms || []).map(
    (t) =>
      new RegExp(`(?<![\\p{L}\\p{N}])(${escapeRegExp(t)})(?![\\p{L}\\p{N}])`, 'giu')
  );

  function placeholder(category, original) {
    const ph = `[${category}_${shortId(original)}]`;
    if (!globalMap.has(ph)) globalMap.set(ph, original);
    return ph;
  }

  function mask(text) {
    if (!text) return text;
    let out = text;
    // Avval ism/tashkilot ro'yxati, keyin tuzilmaviy PII.
    for (const re of termRes) {
      out = out.replace(re, (m) => placeholder('MAXFIY', m));
    }
    out = out.replace(EMAIL_RE, (m) => placeholder('EMAIL', m));
    out = out.replace(PHONE_RE, (m) => placeholder('TELEFON', m));
    out = out.replace(DIGITS_RE, (m) => placeholder('RAQAM', m));
    return out;
  }

  function unmask(text) {
    if (!text) return text;
    let out = text;
    for (const [ph, original] of globalMap) {
      out = out.split(ph).join(original);
    }
    return out;
  }

  return { mask, unmask };
}
