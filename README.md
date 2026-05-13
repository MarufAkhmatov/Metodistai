# Metodist Ai

Figma-dan generatsiya qilingan React + Vite dashboard. Lokal Claude Code CLI ga
ulangan oddiy chat oynasi qo'shilgan — savol yozasiz, javob to'g'ridan-to'g'ri
sizning kompyuteringizdagi `claude` CLI orqali keladi (API kalit kerak emas).

Original Figma loyihasi:
<https://www.figma.com/design/42JqsTM41wac5ID1IkHYL2/Metodist-Ai>

## Arxitektura

```
Brauzer (Vite, port 5173)  ──/api/chat──▶  Node.js backend (port 3001)
                                                    │
                                                    ▼
                                           `claude -p ...` (lokal CLI)
```

- `src/app/components/ChatPanel.tsx` — chat oynasi (pastki o'ng burchakdagi tugma).
- `server/index.mjs` — Express backend, `claude` CLI chaqiradi va javobni qaytaradi.
- `vite.config.ts` — `/api` so'rovlarni backendga proxy qiladi.

## ASUS Windows kompyuteringizda o'rnatish

### 1. Node.js o'rnatish (agar yo'q bo'lsa)

<https://nodejs.org/en/download> dan **LTS (v20 yoki yangiroq)** versiyasini yuklab
oling va o'rnating. O'rnatgandan keyin PowerShell ochib tekshiring:

```powershell
node -v
npm -v
```

### 2. Git o'rnatish (agar yo'q bo'lsa)

<https://git-scm.com/download/win>

### 3. Claude Code CLI o'rnatish

```powershell
npm install -g @anthropic-ai/claude-code
```

Birinchi marta ishga tushirib login qiling:

```powershell
claude
```

Brauzerda ochilgan oynadan Anthropic akkauntingiz bilan kiring (obunangiz orqali).
Test qilish:

```powershell
claude -p "Salom, ishlayapsanmi?"
```

Javob kelsa — tayyor.

### 4. Loyihani Desktopga yuklab olish

PowerShell-da:

```powershell
cd $env:USERPROFILE\Desktop
git clone https://github.com/marufakhmatov/metodistai.git
cd metodistai
git checkout claude/create-website-claude-code-Ny3wj
npm install
```

### 5. AI Metodist Agent papkasini ulash

Sizning `C:\Users\ASUS\Desktop\AI Metodist Agent` papkangizda `CLAUDE.md`
yo'riqnomasi va metodologiya hujjatlari bor. Sayt o'sha papkani Claude
Code CLI uchun ish papkasi sifatida ishlatadi.

Loyiha ildizida `.env` faylini yarating:

```powershell
Copy-Item .env.example .env
notepad .env
```

`.env` ichida quyidagi qator borligini tekshiring (kerak bo'lsa yo'lni
to'g'rilang):

```
METODIST_AGENT_DIR=C:\Users\ASUS\Desktop\AI Metodist Agent
```

Saqlab yoping.

### 6. Saytni ishga tushirish

```powershell
npm run dev:all
```

Bu buyruq ikkita narsani parallel ishga tushiradi:

- **web** — `http://localhost:5173` (sayt)
- **api** — `http://localhost:3001` (Claude bilan ulanadigan backend)

Brauzerda <http://localhost:5173> oching. O'ng pastki burchakdagi yashil tugmani
bosing — chat oynasi ochiladi.

**Foydalanish:**

- **Matn**: xat matnini paste qilib Enter bosing.
- **Fayl**: paperclip ikonkasini bosib `.pdf`, `.docx`, `.txt` yoki `.md`
  faylni yuklang (10 MB gacha). Xohlasangiz matn ham qo'shing.
- Javob jadval ko'rinishida keladi (Claude `CLAUDE.md` yo'riqnomasiga
  asoslanadi).

To'xtatish uchun PowerShell oynasida `Ctrl+C`.

### Desktopdagi yorliq (ixtiyoriy)

Notepadda yangi fayl yarating, ichiga yozing:

```bat
@echo off
cd /d "%USERPROFILE%\Desktop\metodistai"
start "" http://localhost:5173
npm run dev:all
pause
```

Faylni `Metodist Ai.bat` nomi bilan Desktopga saqlang. Bosgan zahoti brauzer
ochiladi va sayt ishga tushadi.

## Tez-tez uchraydigan muammolar

- **`"claude" topilmadi`** — Claude Code CLI o'rnatilmagan yoki PATH'da yo'q.
  PowerShell qayta oching va `claude --version` tekshiring.
- **`METODIST_AGENT_DIR sozlanmagan` yoki `Papka topilmadi`** — loyiha
  ildizida `.env` fayli yo'q yoki ichidagi yo'l noto'g'ri. `Copy-Item .env.example .env`
  qilib, `notepad .env` orqali tahrirlang.
- **Backend ochilmayapti / port band** — `3001` portni boshqa dastur band qilgan.
  `set PORT=3010 && npm run server` bilan boshqa portda ishga tushirib ko'ring
  (`vite.config.ts` ichidagi proxy targetini ham yangilang).
- **Fayl yuklanmadi (juda katta)** — limit 10 MB. Faylni qisqartiring yoki
  matn sifatida paste qiling.
- **Chat tarixini tozalash** — chat oynasi yuqorisidagi "Tozalash" tugmasi.

## Skriptlar

| Buyruq             | Vazifa                                                  |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Faqat frontend (Vite dev server).                       |
| `npm run server`   | Faqat backend (Claude CLI ko'prigi).                    |
| `npm run dev:all`  | Ikkalasini birga (kunlik foydalanish uchun).            |
| `npm run build`    | Productionga build (`dist/` papkasiga).                 |
