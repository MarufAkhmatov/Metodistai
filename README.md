# Metodist Ai

Figma-dan generatsiya qilingan React + Vite dashboard. Lokal Claude Code CLI ga
ulangan oddiy chat oynasi qo'shilgan — savol yozasiz, javob to'g'ridan-to'g'ri
sizning kompyuteringizdagi `claude` CLI orqali keladi (API kalit kerak emas).

Original Figma loyihasi:
<https://www.figma.com/design/42JqsTM41wac5ID1IkHYL2/Metodist-Ai>

## Arxitektura

```
Brauzer (Vite, 127.0.0.1:5173) ──/api/chat──▶ Node.js backend (127.0.0.1:3001)
                                                    │
                                          maskalash (mask.mjs)
                                                    │
                                                    ▼
                                           `claude -p ...` (lokal CLI)
```

- `src/app/components/ChatPanel.tsx` — chat oynasi (pastki o'ng burchakdagi tugma).
- `server/index.mjs` — Express backend, `claude` CLI chaqiradi va javobni qaytaradi.
- `server/mask.mjs` — maxfiylik qatlami (bulutga maskalangan matn ketadi).
- `server/rag.mjs` + `scripts/rag/` — lokal bilim bazasi (offline embeddinglar).
- `vite.config.ts` — `/api` so'rovlarni backendga proxy qiladi.

## Maxfiylik — ma'lumotlaringiz qayerda

Sayt to'liq sizning kompyuteringizda ishlaydi. Quyidagilar **hech qachon
kompyuterdan tashqariga chiqmaydi**:

- Normativ hujjatlardan matn ajratish — lokal.
- Bilim bazasi (RAG) embeddinglari — `fastembed` orqali **offline**, internetsiz.
  Vektorlar `AI Metodist Agent\.rag\` da saqlanadi.
- Backend va sayt faqat `127.0.0.1` (localhost) da ishlaydi — bir Wi-Fi'dagi
  boshqa qurilmalar kira olmaydi.

**Bulutga (Anthropic) nima boradi:** Claude Code CLI — bu Anthropic'ning
bulutli xizmati. Chatga savol bersangiz, javob shu yerdan keladi. Lekin:

- Claude'ga matn yuborilishidan **oldin maskalanadi** (`server/mask.mjs`):
  email, telefon, uzun raqamlar (passport/INN) avtomatik; ism va tashkilot
  nomlari esa `mask-terms.txt` ro'yxatingiz bo'yicha. Ular `[MAXFIY_xxx]`
  belgilariga almashtiriladi, javob qaytgach asl holiga tiklanadi —
  Anthropic faqat belgilarni ko'radi.
- Claude'ning **fayl o'qish vositalari o'chirilgan** (`--disallowedTools`) va
  u bo'sh papkada ishlaydi — normativ hujjatlaringizga to'g'ridan-to'g'ri
  kira olmaydi, faqat siz bergan (maskalangan) matnni ko'radi.

> **Muhim cheklov:** maskalash — himoya chorasi, mutlaq kafolat emas.
> `mask-terms.txt` ga kiritmagan ism/nomlar maskalanmaydi. Agar **hech narsa
> bulutga chiqmasligi** shart bo'lsa, Claude o'rniga to'liq lokal model
> (masalan Ollama) ishlatish kerak — buni alohida sozlash mumkin.

## Sahifalar (routing) — Metodist va AI-Workflow

Sayt endi ikki sahifali. `react-router` orqali URL marshruti:

- `/` — **Metodist** (1-sahifa): joriy dashboard, carousel, chat.
- `/workflow` — **AI-Workflow** (2-sahifa).

Header'da ikkala sahifa orasida o'tish uchun navigatsiya tugmalari bor
(mobil menyuda ham "Sahifalar" bo'limi). Har ikkala sahifa **bir xil login
tizimi** ortida.

### AI-Workflow kodini qo'shish

2-sahifa hozircha vaqtinchalik (placeholder) — `src/app/pages/WorkflowPage.tsx`.
AI-Workflow (<https://github.com/MarufAkhmatov/AI-Workflow>) alohida loyiha
bo'lgani uchun, uning kodi shu repozitoriyga qo'shilishi kerak (sayt yagona
ilova sifatida quriladi). Qadamlar:

1. AI-Workflow loyihasining `src/` papkasidagi komponentlarni shu loyihaning
   `src/app/workflow/` papkasiga nusxalang (papkani yarating).
2. AI-Workflow `package.json` dagi kerakli paketlarni bu loyihaga o'rnating:
   `npm install <paket nomi>`.
3. `src/app/pages/WorkflowPage.tsx` ni tahrirlab, AI-Workflow asosiy
   komponentini import qiling, masalan:
   ```tsx
   import WorkflowApp from '../workflow/App';
   export default function WorkflowPage() {
     return <WorkflowApp />;
   }
   ```
4. Stil to'qnashuvi bo'lsa (ikki loyihaning global CSS'lari) — AI-Workflow
   stillarini `workflow/` ichida lokal saqlang yoki sinflarni nomlang.

Kodni qo'shib commit qilganingizdan keyin ayting — qolgan ulashni
(import, stil izolyatsiyasi, build) men sozlab beraman.

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

### 6. Login va parolni sozlash

Sayt himoyalangan — ochilganda email + parol so'raydi. Sozlash uchun `.env`
fayliga uchta qator kerak: `AUTH_EMAIL`, `AUTH_PASSWORD_HASH`, `SESSION_SECRET`.

**Parol hash'ini yaratish** (parol ochiq holda saqlanmaydi):

```powershell
node server/hash-password.mjs "sizning-parolingiz"
```

Chiqqan satrni nusxalang. **Maxfiy kalit yaratish**:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`notepad .env` ochib, quyidagilarni qo'shing (hash va kalitni qo'shtirnoq
ichida):

```
AUTH_EMAIL=sizning@email.com
AUTH_PASSWORD_HASH="$2b$12$..."
SESSION_SECRET="uzun_tasodifiy_satr"
```

Saqlab yoping. Parolni keyin o'zgartirmoqchi bo'lsangiz — yangi hash yaratib,
`AUTH_PASSWORD_HASH` ni almashtiring.

> Xavfsizlik: ochiq parol hech qayerda saqlanmaydi (faqat bcrypt hash).
> Sessiya HTTP-only cookie'da, JavaScript o'qiy olmaydi. Login sahifasi
> brute-force urinishlardan himoyalangan (15 daqiqada 10 marta limit).

### 7. Bilim bazasi (RAG) — Python sozlash

Sayt `AI Metodist Agent` papkasidagi barcha normativ hujjatlarni avtomatik
o'qib, vektor bilim bazasiga aylantiradi. Kimdir papkaga yangi papka yoki
hujjat qo'shsa — backend buni sezadi, qayta indekslaydi va chatdagi AI shu
yangi hujjatlar bo'yicha ham javob bera oladi. Papka ildizida
`KNOWLEDGE_INDEX.md` fayli avtomatik yaratilib turadi.

Buning uchun Python kutubxonalarini o'rnating:

```powershell
pip install -r scripts/rag/requirements.txt
```

- Birinchi indekslashda embedding modeli bir marta yuklab olinadi
  (~bir necha yuz MB) — internet kerak. Keyin offline ishlaydi.
- Agar `python` buyrug'i ishlamasa, `.env` ga `PYTHON_BIN` ni to'liq yo'l
  bilan yozing (masalan `PYTHON_BIN=C:\Python312\python.exe`).
- Vektor ma'lumotlari `AI Metodist Agent\.rag\` yashirin papkasida saqlanadi.

### 8. Maxfiy atamalar ro'yxatini sozlash

Loyiha ildizida `mask-terms.example.txt` faylidan nusxa oling:

```powershell
Copy-Item mask-terms.example.txt mask-terms.txt
notepad mask-terms.txt
```

Ichiga maskalanishi kerak bo'lgan ism, familiya, tashkilot nomlarini
har birini alohida qatorga yozing va saqlang. Email/telefon/uzun raqamlar
avtomatik aniqlanadi — ularni yozish shart emas. `mask-terms.txt`
repozitoriyga tushmaydi (`.gitignore` da). Batafsil — yuqoridagi
"Maxfiylik" bo'limiga qarang.

### 9. Saytni ishga tushirish

```powershell
npm run dev:all
```

Bu buyruq ikkita narsani parallel ishga tushiradi:

- **web** — `http://localhost:5173` (sayt)
- **api** — `http://localhost:3001` (Claude bilan ulanadigan backend)

Brauzerda <http://localhost:5173> oching. Email va parol bilan kiring.
Keyin o'ng pastki burchakdagi yashil tugmani bosing — chat oynasi ochiladi.
Chiqish uchun chat oynasi yuqorisidagi chiqish (logout) ikonkasini bosing.

**Foydalanish:**

- **Matn**: xat matnini paste qilib Enter bosing.
- **Fayl**: paperclip ikonkasini bosib `.pdf`, `.docx`, `.txt` yoki `.md`
  faylni yuklang (10 MB gacha). Xohlasangiz matn ham qo'shing.
- Javob jadval ko'rinishida keladi (Claude `CLAUDE.md` yo'riqnomasiga
  asoslanadi).
- **Til**: yuqori o'ng burchakdagi UZ/RU/EN tugmasi orqali sayt tilini
  almashtiring.
- **Yangi hujjatlar**: `AI Metodist Agent` papkasiga yangi papka/hujjat
  qo'shsangiz, sayt ~20 soniyada avtomatik yangilanadi va AI ularni
  bilim bazasiga qo'shib oladi.

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
- **`Autentifikatsiya sozlanmagan`** — `.env` da `AUTH_EMAIL`,
  `AUTH_PASSWORD_HASH` yoki `SESSION_SECRET` yo'q. 6-bo'limga qarang.
- **`Email yoki parol noto'g'ri`** — `.env` dagi `AUTH_EMAIL` ni tekshiring,
  parol hash'ini `node server/hash-password.mjs "parol"` bilan qayta yarating.
- **`Juda ko'p urinish`** — login 15 daqiqada 10 martadan ko'p xato kiritilgan.
  15 daqiqa kuting yoki backend'ni qayta ishga tushiring.
- **`"python" topilmadi` yoki `fastembed o'rnatilmagan`** — bilim bazasi (RAG)
  uchun Python kerak. `pip install -r scripts/rag/requirements.txt` ni
  bajaring; `python` ishlamasa `.env` ga `PYTHON_BIN` ni to'liq yo'l bilan
  yozing. RAG ishlamasa ham chat ishlayveradi (faqat avto-qidiruvsiz).
- **Bilim bazasi yangilanmadi** — backend loglarida `[rag]` qatorlarini
  tekshiring. Birinchi indekslash model yuklab olinishini kutadi (internet
  kerak). Holatni `/api/rag/status` orqali ko'rish mumkin.
- **Chat tarixini tozalash** — chat oynasi yuqorisidagi "Tozalash" tugmasi.

## Skriptlar

| Buyruq             | Vazifa                                                  |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Faqat frontend (Vite dev server).                       |
| `npm run server`   | Faqat backend (Claude CLI ko'prigi).                    |
| `npm run dev:all`  | Ikkalasini birga (kunlik foydalanish uchun).            |
| `npm run build`    | Productionga build (`dist/` papkasiga).                 |
