// Markdown -> .docx konvertori (AI chat javoblarini Word'ga saqlash uchun).
// Talab: jadvallar to'g'ri, matn aniq, --- *** * belgilari bo'lmasligi.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

// --- Tokenizer: matnni bloklarga ajratadi ---
function tokenize(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const tokens = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Bo'sh qator
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Horizontal rule (---, ***, ___) — Word'ga o'tkazilmaydi (user talabi)
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      i++;
      continue;
    }

    // Heading (#, ##, ...)
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      tokens.push({ type: 'heading', level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // Code block ```...```
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing
      tokens.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    // Table — qator |..|..| va keyingisi |---|---|
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{2,}.*\|\s*$/.test(lines[i + 1])
    ) {
      const splitRow = (s) =>
        s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', header, rows });
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      tokens.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    // List
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items = [];
      while (i < lines.length) {
        const lu = lines[i].match(/^(\s*)[-*+]\s+(.*)$/);
        const lo = lines[i].match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (ordered && lo) {
          items.push(lo[3]);
          i++;
        } else if (!ordered && lu) {
          items.push(lu[2]);
          i++;
        } else if (/^\s+\S/.test(lines[i]) && items.length > 0 && !/^\s*$/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: 'list', ordered, items });
      continue;
    }

    // Paragraph — bo'sh qatorga yoki yangi blok ko'rinishiga qadar to'playmiz
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        /^\s*$/.test(l) ||
        /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l) ||
        /^(#{1,6})\s+/.test(l) ||
        /^\s*```/.test(l) ||
        /^\s*[-*+]\s+/.test(l) ||
        /^\s*\d+[.)]\s+/.test(l) ||
        /^\s*>/.test(l) ||
        /^\s*\|.*\|\s*$/.test(l)
      ) {
        break;
      }
      paraLines.push(l);
      i++;
    }
    if (paraLines.length) {
      tokens.push({ type: 'para', text: paraLines.join(' ') });
    }
  }
  return tokens;
}

// --- Inline formatlash: **bold**, *italic*, `code`, [text](url) — markdown belgilari olib tashlanadi ---
function parseInline(text) {
  // Avval *** belgilarini olib tashlaymiz (talab bo'yicha)
  let s = String(text || '').replace(/\*{3,}/g, '');
  const runs = [];
  let cur = '';
  let bold = false;
  let italic = false;
  let code = false;
  let i = 0;
  const push = () => {
    if (cur) {
      runs.push({ text: cur, bold, italic, code });
      cur = '';
    }
  };
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];
    if (ch === '`') {
      push();
      code = !code;
      i++;
    } else if (ch === '*' && next === '*' && !code) {
      push();
      bold = !bold;
      i += 2;
    } else if ((ch === '*' || ch === '_') && !code) {
      push();
      italic = !italic;
      i++;
    } else if (ch === '[' && !code) {
      // [text](url) — text qoldiramiz, url tashlanadi
      const close = s.indexOf(']', i + 1);
      if (close > -1 && s[close + 1] === '(') {
        const urlEnd = s.indexOf(')', close + 2);
        if (urlEnd > -1) {
          cur += s.slice(i + 1, close);
          i = urlEnd + 1;
          continue;
        }
      }
      cur += ch;
      i++;
    } else {
      cur += ch;
      i++;
    }
  }
  push();
  return runs.length ? runs : [{ text: '', bold: false, italic: false, code: false }];
}

function toRun(spec) {
  return new TextRun({
    text: spec.text,
    bold: spec.bold || undefined,
    italics: spec.italic || undefined,
    font: spec.code ? 'Consolas' : undefined,
  });
}

function paragraphFrom(text, opts = {}) {
  const runs = parseInline(text).map(toRun);
  return new Paragraph({
    children: runs,
    spacing: { after: 120 },
    ...opts,
  });
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const TABLE_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
};

function buildChildren(tokens) {
  const children = [];
  for (const tok of tokens) {
    if (tok.type === 'heading') {
      const level = Math.min(Math.max(tok.level, 1), 6);
      children.push(
        new Paragraph({
          heading: HEADING_LEVELS[level - 1],
          children: parseInline(tok.text).map(toRun),
          spacing: { before: 200, after: 120 },
        })
      );
    } else if (tok.type === 'para') {
      children.push(paragraphFrom(tok.text));
    } else if (tok.type === 'quote') {
      children.push(
        paragraphFrom(tok.text, {
          indent: { left: 720 },
          spacing: { after: 120 },
        })
      );
    } else if (tok.type === 'code') {
      for (const line of tok.text.split('\n')) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
            spacing: { after: 0 },
          })
        );
      }
      children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } }));
    } else if (tok.type === 'list') {
      tok.items.forEach((item) => {
        const runs = parseInline(item).map(toRun);
        if (tok.ordered) {
          children.push(
            new Paragraph({
              children: runs,
              numbering: { reference: 'metodist-numbering', level: 0 },
              spacing: { after: 80 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: runs,
              bullet: { level: 0 },
              spacing: { after: 80 },
            })
          );
        }
      });
    } else if (tok.type === 'table') {
      const colCount = Math.max(tok.header.length, ...tok.rows.map((r) => r.length));
      const padRow = (row) => {
        const out = row.slice(0, colCount);
        while (out.length < colCount) out.push('');
        return out;
      };
      const cellPar = (text, isHeader) =>
        new Paragraph({
          children: parseInline(text).map((spec) =>
            new TextRun({
              text: spec.text,
              bold: isHeader || spec.bold || undefined,
              italics: spec.italic || undefined,
              font: spec.code ? 'Consolas' : undefined,
            })
          ),
          spacing: { before: 40, after: 40 },
        });
      const headerRow = new TableRow({
        tableHeader: true,
        children: padRow(tok.header).map(
          (c) =>
            new TableCell({
              children: [cellPar(c, true)],
              shading: { fill: 'EAEAEA' },
            })
        ),
      });
      const bodyRows = tok.rows.map(
        (r) =>
          new TableRow({
            children: padRow(r).map((c) => new TableCell({ children: [cellPar(c, false)] })),
          })
      );
      children.push(
        new Table({
          rows: [headerRow, ...bodyRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: TABLE_BORDERS,
        })
      );
      children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } }));
    }
  }
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }));
  }
  return children;
}

export async function markdownToDocxBuffer(markdown, { title } = {}) {
  const tokens = tokenize(markdown);
  const body = buildChildren(tokens);

  const titlePar = title
    ? [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: title, bold: true })],
          spacing: { after: 200 },
        }),
      ]
    : [];

  const doc = new Document({
    creator: 'AI Metodist',
    title: title || 'Analiz',
    numbering: {
      config: [
        {
          reference: 'metodist-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [...titlePar, ...body],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
