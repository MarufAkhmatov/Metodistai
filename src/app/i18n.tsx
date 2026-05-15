import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'uz' | 'ru' | 'en';

const STORAGE_KEY = 'metodistai.lang';
const DEFAULT_LANG: Lang = 'ru';

type Translations = Record<string, string>;

const uz: Translations = {
  // login
  'login.title': 'Tizimga kirish',
  'login.email': 'Email',
  'login.password': 'Parol',
  'login.submit': 'Kirish',
  'login.submitting': 'Tekshirilmoqda...',
  'login.enterBoth': 'Email va parolni kiriting.',
  'login.failed': "Kirib bo'lmadi (HTTP {status})",
  'login.footer': 'Faqat ruxsat berilgan foydalanuvchilar uchun.',
  // header
  'header.date': '12-yanvar',
  'header.youPlus': 'Siz +',
  'header.auditReview': "Audit qo'mitasi ko'rigi",
  'header.folders': 'Papkalar',
  'header.searchFolders': 'Papkalarni qidirish...',
  'header.small': 'Kichik',
  'header.export': 'Eksport',
  'header.viewTasks': "Vazifalarni ko'rish",
  'header.addContracts': "Shartnoma qo'shish",
  'header.search': 'Qidiruv',
  'header.quickActions': 'Tezkor amallar',
  'header.exportData': 'Maʼlumotni eksport',
  'header.account': 'Hisob',
  'header.youTeam': 'Siz va jamoa',
  'header.active': '{count} faol',
  'header.total': '{count} jami',
  'header.language': 'Til',
  // nav
  'nav.metodist': 'Metodist',
  'nav.workflow': 'Workflow',
  'nav.pages': 'Sahifalar',
  // carousel
  'carousel.file': 'fayl',
  'carousel.noDocuments': 'Hujjat yoʻq',
  'carousel.noFolders':
    "Papkalar topilmadi. AI Metodist Agent papkasida normativ hujjatli papkalar borligini tekshiring.",
  // dashboard
  'dash.keyDates': 'Muhim sanalar',
  'dash.championing': 'Jamiyatni qoʻllab-quvvatlash.',
  'dash.date': 'Sana',
  'dash.event': 'Tadbir',
  'dash.twoWeeks': '2 hafta',
  'dash.twoMonths': '2 oy',
  'dash.autorenewDate': '/Avtoyangilanish sanasi',
  'dash.terminationDate': 'Tugatish sanasi',
  'dash.start': 'Boshlash',
  'dash.noFolderSelected': 'Papka tanlanmagan',
  'dash.documents': '{count} hujjat',
  'dash.subfolders': '{count} ichki papka',
  'dash.lastModified': 'oxirgi oʻzgarish {date}',
  'dash.annualAudit': 'Yillik maʼlumotlar maxfiyligi auditi',
  'dash.finalValidation': 'Yakuniy tekshiruv',
  'dash.noDocsInFolder': 'Bu papkada normativ hujjat yoʻq.',
  'dash.folderNotSelected': 'Papka tanlanmagan.',
  'dash.open': 'Ochish',
  'dash.download': 'Yuklab olish',
  'dash.expand': 'Kattalashtirish',
  'dash.collapse': 'Kichraytirish',
  'dash.riskAssessment': 'Xavflarni baholash',
  'dash.deliverableDue': 'Topshiriq muddati',
  'dash.wereHere': 'Biz shu yerdamiz',
  // chat
  'chat.clear': 'Tozalash',
  'chat.clearHistory': 'Tarixni tozalash',
  'chat.logout': 'Tizimdan chiqish',
  'chat.close': 'Yopish',
  'chat.openChat': 'Chatni ochish',
  'chat.emptyState':
    "Xat matnini yozing yoki PDF/DOCX faylni biriktiring. Claude metodologiya boʻyicha jadval qaytaradi.",
  'chat.copy': 'Nusxa olish',
  'chat.copied': 'Nusxalandi',
  'chat.thinking': 'Claude oʻylayapti...',
  'chat.removeFile': 'Faylni olib tashlash',
  'chat.attachFile': 'Fayl biriktirish',
  'chat.inputPlaceholder': 'Xat matnini yoki savolingizni yozing...',
  'chat.send': 'Yuborish',
  'chat.inputHint': 'Enter — yuborish, Shift+Enter — yangi qator. Fayl limit: 10 MB.',
  'chat.fileTooLarge': 'Fayl juda katta ({size}). Limit: 10 MB.',
  'chat.emptyReply': '(boʻsh javob)',
  'chat.error':
    'Xato: {msg}\n\nBackend ishlayotganini tekshiring: `npm run server` yoki `npm run dev:all`.',
  'chat.expand': 'Kattalashtirish',
  'chat.collapse': 'Kichraytirish',
  // app
  'app.foldersLoadError': "Papkalarni yuklab boʻlmadi: {error}",
  // workflow page
  'wf.tabs.editor': 'Tahrir',
  'wf.tabs.executions': 'Bajarish',
  'wf.tabs.tests': 'Testlar',
  'wf.run': "Workflow'ni ishga tushir",
  'wf.stop': "To'xtatish",
  'wf.input.default': 'Taqqoslash uchun yangi fayl',
  'wf.input.upload': 'Chat orqali yuklang',
  'wf.input.analyzing': 'Tahlil qilinyapti…',
  'wf.input.ready': 'Tahlilga tayyor',
  'wf.agent.subtitle': 'Claude Agent (claude-3-5-sonnet)',
  'wf.agent.running': 'Ishlamoqda',
  'wf.agent.idle': "Bo'sh",
  'wf.agent.chatModel': 'Chat modeli',
  'wf.agent.connect': 'Ulanish',
  'wf.agent.toolApi': 'Asbob (API)',
  'wf.kb.title': 'Bilim bazasi',
  'wf.kb.loading': 'Yuklanmoqda…',
  'wf.kb.folders': '{count} ulangan papka',
  'wf.actions.create': 'Papka yaratish',
  'wf.actions.createTip': 'Yangi papka yaratish',
  'wf.actions.add': "Fayl qo'shish",
  'wf.actions.addTip': "Mavjud papkaga fayl qo'shish",
  'wf.kbf.title': 'KB papkalari',
  'wf.kbf.comparing': 'Taqqoslanmoqda…',
  'wf.kbf.empty': "Tegishli papkalar hali yo'q",
  'wf.kbf.savePrompt': "Ushbu analizlarni Word'ga saqlashni xohlaysizmi?",
  'wf.kbf.saveYes': 'Ha, saqla',
  'wf.archive.title': 'Arxiv papka',
  'wf.archive.files': '{count} ta saqlangan fayl',
  'wf.archive.localHint': 'Lokal: <AGENT_DIR>/Archive folder/',
  'wf.create.title': 'Yangi papka yaratish',
  'wf.create.desc':
    "Lokal Bilim bazasi ichida bo'sh papka yaratiladi. Keyin \"Fayl qo'shish\" tugmasi orqali fayllar joylashtiriladi.",
  'wf.create.placeholder': "Papka nomi (masalan: HR bo'limi)",
  'wf.create.submit': 'Yaratish',
  'wf.create.submitting': 'Yaratilmoqda…',
  'wf.create.errorEmpty': "Papka nomi bo'sh.",
  'wf.add.title': "Faylni papkaga qo'shish",
  'wf.add.desc':
    'Mavjud papkalardan birini tanlang va PDF, DOC, DOCX, XLS, XLSX, TXT yoki MD faylni yuklang.',
  'wf.add.targetLabel': 'Maqsad papka',
  'wf.add.emptyHint':
    "Papkalar yo'q — avval \"Papka yaratish\" bilan yarating",
  'wf.add.selectHint': 'Papkani tanlang…',
  'wf.add.fileLabel': 'Fayl',
  'wf.add.submit': 'Yuklash',
  'wf.add.submitting': 'Yuklanmoqda…',
  'wf.add.errorSelectFolder': 'Papkani tanlang.',
  'wf.add.errorSelectFile': 'Faylni tanlang.',
  'wf.common.cancel': 'Bekor qilish',
  'wf.common.close': 'Yopish',
  'wf.common.zoomIn': 'Kattalashtirish',
  'wf.common.zoomOut': 'Kichraytirish',
  'wf.common.zoomReset': 'Standartga qaytar',
  'wf.chat.online': 'Faol',
  'wf.chat.saveAsWord': "Word'ga saqlaymi?",
  'wf.chat.saving': 'Saqlanmoqda…',
  'wf.chat.saved': 'Saqlandi',
  'wf.chat.saveTitle': 'Word (.docx) formatida saqlash',
};

const ru: Translations = {
  // login
  'login.title': 'Вход в систему',
  'login.email': 'Email',
  'login.password': 'Пароль',
  'login.submit': 'Войти',
  'login.submitting': 'Проверка...',
  'login.enterBoth': 'Введите email и пароль.',
  'login.failed': 'Не удалось войти (HTTP {status})',
  'login.footer': 'Только для авторизованных пользователей.',
  // header
  'header.date': '12 января',
  'header.youPlus': 'Вы +',
  'header.auditReview': 'Обзор аудиторского комитета',
  'header.folders': 'Папки',
  'header.searchFolders': 'Поиск папок...',
  'header.small': 'Маленький',
  'header.export': 'Экспорт',
  'header.viewTasks': 'Посмотреть задачи',
  'header.addContracts': 'Добавить договоры',
  'header.search': 'Поиск',
  'header.quickActions': 'Быстрые действия',
  'header.exportData': 'Экспорт данных',
  'header.account': 'Аккаунт',
  'header.youTeam': 'Вы и команда',
  'header.active': '{count} активны',
  'header.total': 'всего {count}',
  'header.language': 'Язык',
  // nav
  'nav.metodist': 'Методист',
  'nav.workflow': 'Workflow',
  'nav.pages': 'Страницы',
  // carousel
  'carousel.file': 'файлов',
  'carousel.noDocuments': 'Нет документов',
  'carousel.noFolders':
    'Папки не найдены. Проверьте, есть ли в папке AI Metodist Agent папки с нормативными документами.',
  // dashboard
  'dash.keyDates': 'Важные даты',
  'dash.championing': 'Поддержка сообщества.',
  'dash.date': 'Дата',
  'dash.event': 'Событие',
  'dash.twoWeeks': '2 недели',
  'dash.twoMonths': '2 месяца',
  'dash.autorenewDate': '/Дата автопродления',
  'dash.terminationDate': 'Дата расторжения',
  'dash.start': 'Старт',
  'dash.noFolderSelected': 'Папка не выбрана',
  'dash.documents': '{count} документов',
  'dash.subfolders': '{count} вложенных папок',
  'dash.lastModified': 'изменён {date}',
  'dash.annualAudit': 'Годовой аудит конфиденциальности данных',
  'dash.finalValidation': 'Финальная проверка',
  'dash.noDocsInFolder': 'В этой папке нет нормативных документов.',
  'dash.folderNotSelected': 'Папка не выбрана.',
  'dash.open': 'Открыть',
  'dash.download': 'Скачать',
  'dash.expand': 'Увеличить',
  'dash.collapse': 'Уменьшить',
  'dash.riskAssessment': 'Оценка рисков',
  'dash.deliverableDue': 'Срок сдачи',
  'dash.wereHere': 'Мы здесь',
  // chat
  'chat.clear': 'Очистить',
  'chat.clearHistory': 'Очистить историю',
  'chat.logout': 'Выйти',
  'chat.close': 'Закрыть',
  'chat.openChat': 'Открыть чат',
  'chat.emptyState':
    'Напишите текст письма или прикрепите файл PDF/DOCX. Claude вернёт таблицу по методологии.',
  'chat.copy': 'Копировать',
  'chat.copied': 'Скопировано',
  'chat.thinking': 'Claude думает...',
  'chat.removeFile': 'Удалить файл',
  'chat.attachFile': 'Прикрепить файл',
  'chat.inputPlaceholder': 'Напишите текст письма или ваш вопрос...',
  'chat.send': 'Отправить',
  'chat.inputHint': 'Enter — отправить, Shift+Enter — новая строка. Лимит файла: 10 МБ.',
  'chat.fileTooLarge': 'Файл слишком большой ({size}). Лимит: 10 МБ.',
  'chat.emptyReply': '(пустой ответ)',
  'chat.error':
    'Ошибка: {msg}\n\nПроверьте, что бэкенд запущен: `npm run server` или `npm run dev:all`.',
  'chat.expand': 'Увеличить',
  'chat.collapse': 'Уменьшить',
  // app
  'app.foldersLoadError': 'Не удалось загрузить папки: {error}',
  // workflow page
  'wf.tabs.editor': 'Редактор',
  'wf.tabs.executions': 'Выполнения',
  'wf.tabs.tests': 'Тесты',
  'wf.run': 'Запустить',
  'wf.stop': 'Стоп',
  'wf.input.default': 'Новый файл для сравнения',
  'wf.input.upload': 'Загрузите через чат',
  'wf.input.analyzing': 'Анализ…',
  'wf.input.ready': 'Готов к анализу',
  'wf.agent.subtitle': 'Claude Agent (claude-3-5-sonnet)',
  'wf.agent.running': 'Работает',
  'wf.agent.idle': 'Простой',
  'wf.agent.chatModel': 'Чат-модель',
  'wf.agent.connect': 'Подключение',
  'wf.agent.toolApi': 'Инструмент (API)',
  'wf.kb.title': 'База знаний',
  'wf.kb.loading': 'Загрузка…',
  'wf.kb.folders': 'подключено папок: {count}',
  'wf.actions.create': 'Создать папку',
  'wf.actions.createTip': 'Создать новую папку',
  'wf.actions.add': 'Добавить файлы',
  'wf.actions.addTip': 'Добавить файл в существующую папку',
  'wf.kbf.title': 'Папки из БЗ',
  'wf.kbf.comparing': 'Сравнение…',
  'wf.kbf.empty': 'Связанных папок пока нет',
  'wf.kbf.savePrompt': 'Сохранить эти результаты в Word?',
  'wf.kbf.saveYes': 'Да, сохранить',
  'wf.archive.title': 'Архивная папка',
  'wf.archive.files': 'сохранено: {count}',
  'wf.archive.localHint': 'Локально: <AGENT_DIR>/Archive folder/',
  'wf.create.title': 'Создать новую папку',
  'wf.create.desc':
    'В вашей локальной Базе знаний будет создана пустая папка. Затем добавьте файлы через «Добавить файлы».',
  'wf.create.placeholder': 'Название папки (например: Отдел HR)',
  'wf.create.submit': 'Создать',
  'wf.create.submitting': 'Создание…',
  'wf.create.errorEmpty': 'Название пустое.',
  'wf.add.title': 'Добавить файл в папку',
  'wf.add.desc':
    'Выберите существующую папку и загрузите PDF, DOC, DOCX, XLS, XLSX, TXT или MD файл.',
  'wf.add.targetLabel': 'Целевая папка',
  'wf.add.emptyHint': 'Папок нет — сначала создайте через «Создать папку»',
  'wf.add.selectHint': 'Выберите папку…',
  'wf.add.fileLabel': 'Файл',
  'wf.add.submit': 'Загрузить',
  'wf.add.submitting': 'Загрузка…',
  'wf.add.errorSelectFolder': 'Выберите папку.',
  'wf.add.errorSelectFile': 'Выберите файл.',
  'wf.common.cancel': 'Отмена',
  'wf.common.close': 'Закрыть',
  'wf.common.zoomIn': 'Увеличить',
  'wf.common.zoomOut': 'Уменьшить',
  'wf.common.zoomReset': 'Сбросить масштаб',
  'wf.chat.online': 'В сети',
  'wf.chat.saveAsWord': 'Сохранить как Word?',
  'wf.chat.saving': 'Сохранение…',
  'wf.chat.saved': 'Сохранено',
  'wf.chat.saveTitle': 'Сохранить как Word (.docx)',
};

const en: Translations = {
  // login
  'login.title': 'Sign in',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.submitting': 'Checking...',
  'login.enterBoth': 'Enter email and password.',
  'login.failed': 'Sign-in failed (HTTP {status})',
  'login.footer': 'For authorized users only.',
  // header
  'header.date': 'January 12',
  'header.youPlus': 'You +',
  'header.auditReview': 'Audit Committee Review',
  'header.folders': 'Folders',
  'header.searchFolders': 'Search folders...',
  'header.small': 'Small',
  'header.export': 'Export',
  'header.viewTasks': 'View tasks',
  'header.addContracts': 'Add Contracts',
  'header.search': 'Search',
  'header.quickActions': 'Quick Actions',
  'header.exportData': 'Export Data',
  'header.account': 'Account',
  'header.youTeam': 'You & Team',
  'header.active': '{count} Active',
  'header.total': '{count} Total',
  'header.language': 'Language',
  // nav
  'nav.metodist': 'Metodist',
  'nav.workflow': 'Workflow',
  'nav.pages': 'Pages',
  // carousel
  'carousel.file': 'files',
  'carousel.noDocuments': 'No documents',
  'carousel.noFolders':
    'No folders found. Check that the AI Metodist Agent folder has folders with normative documents.',
  // dashboard
  'dash.keyDates': 'Key Dates',
  'dash.championing': 'Championing Community.',
  'dash.date': 'Date',
  'dash.event': 'Event',
  'dash.twoWeeks': '2 Weeks',
  'dash.twoMonths': '2 Months',
  'dash.autorenewDate': '/Autorenew date',
  'dash.terminationDate': 'Termination date',
  'dash.start': 'Start',
  'dash.noFolderSelected': 'No folder selected',
  'dash.documents': '{count} documents',
  'dash.subfolders': '{count} subfolders',
  'dash.lastModified': 'modified {date}',
  'dash.annualAudit': 'Annual Data Privacy Audit',
  'dash.finalValidation': 'Final Validation',
  'dash.noDocsInFolder': 'No normative documents in this folder.',
  'dash.folderNotSelected': 'No folder selected.',
  'dash.open': 'Open',
  'dash.download': 'Download',
  'dash.expand': 'Expand',
  'dash.collapse': 'Collapse',
  'dash.riskAssessment': 'Risk Assessment',
  'dash.deliverableDue': 'Deliverable Due',
  'dash.wereHere': "We're here",
  // chat
  'chat.clear': 'Clear',
  'chat.clearHistory': 'Clear history',
  'chat.logout': 'Log out',
  'chat.close': 'Close',
  'chat.openChat': 'Open chat',
  'chat.emptyState':
    'Type the letter text or attach a PDF/DOCX file. Claude will return a methodology table.',
  'chat.copy': 'Copy',
  'chat.copied': 'Copied',
  'chat.thinking': 'Claude is thinking...',
  'chat.removeFile': 'Remove file',
  'chat.attachFile': 'Attach file',
  'chat.inputPlaceholder': 'Type the letter text or your question...',
  'chat.send': 'Send',
  'chat.inputHint': 'Enter — send, Shift+Enter — new line. File limit: 10 MB.',
  'chat.fileTooLarge': 'File too large ({size}). Limit: 10 MB.',
  'chat.emptyReply': '(empty reply)',
  'chat.error':
    'Error: {msg}\n\nCheck that the backend is running: `npm run server` or `npm run dev:all`.',
  'chat.expand': 'Expand',
  'chat.collapse': 'Collapse',
  // app
  'app.foldersLoadError': 'Could not load folders: {error}',
  // workflow page
  'wf.tabs.editor': 'Editor',
  'wf.tabs.executions': 'Executions',
  'wf.tabs.tests': 'Tests',
  'wf.run': 'Run Workflow',
  'wf.stop': 'Stop',
  'wf.input.default': 'New file to compare',
  'wf.input.upload': 'Upload via chat',
  'wf.input.analyzing': 'Analyzing…',
  'wf.input.ready': 'Ready for analysis',
  'wf.agent.subtitle': 'Claude Agent (claude-3-5-sonnet)',
  'wf.agent.running': 'Running',
  'wf.agent.idle': 'Idle',
  'wf.agent.chatModel': 'Chat model',
  'wf.agent.connect': 'Connect',
  'wf.agent.toolApi': 'Tool (API)',
  'wf.kb.title': 'Knowledge Base',
  'wf.kb.loading': 'Loading…',
  'wf.kb.folders': '{count} connected folders',
  'wf.actions.create': 'Create folders',
  'wf.actions.createTip': 'Create a new folder',
  'wf.actions.add': 'Add files',
  'wf.actions.addTip': 'Add a file to an existing folder',
  'wf.kbf.title': 'Folders from KB',
  'wf.kbf.comparing': 'Comparing…',
  'wf.kbf.empty': 'No related folders yet',
  'wf.kbf.savePrompt': 'Save these analyses as Word?',
  'wf.kbf.saveYes': 'Yes, save',
  'wf.archive.title': 'Archive folder',
  'wf.archive.files': '{count} saved files',
  'wf.archive.localHint': 'Local: <AGENT_DIR>/Archive folder/',
  'wf.create.title': 'Create new folder',
  'wf.create.desc':
    'An empty folder will be created in your local Knowledge Base. Then add files via "Add files".',
  'wf.create.placeholder': 'Folder name (e.g. HR Department)',
  'wf.create.submit': 'Create',
  'wf.create.submitting': 'Creating…',
  'wf.create.errorEmpty': 'Name is empty.',
  'wf.add.title': 'Add file to folder',
  'wf.add.desc':
    'Pick an existing folder and upload a PDF, DOC, DOCX, XLS, XLSX, TXT or MD file.',
  'wf.add.targetLabel': 'Target folder',
  'wf.add.emptyHint': 'No folders yet — create one via "Create folders" first',
  'wf.add.selectHint': 'Choose a folder…',
  'wf.add.fileLabel': 'File',
  'wf.add.submit': 'Upload',
  'wf.add.submitting': 'Uploading…',
  'wf.add.errorSelectFolder': 'Pick a folder.',
  'wf.add.errorSelectFile': 'Pick a file.',
  'wf.common.cancel': 'Cancel',
  'wf.common.close': 'Close',
  'wf.common.zoomIn': 'Zoom in',
  'wf.common.zoomOut': 'Zoom out',
  'wf.common.zoomReset': 'Reset zoom',
  'wf.chat.online': 'Online',
  'wf.chat.saveAsWord': 'Save as Word?',
  'wf.chat.saving': 'Saving…',
  'wf.chat.saved': 'Saved',
  'wf.chat.saveTitle': 'Save as Word (.docx)',
};

const translations: Record<Lang, Translations> = { uz, ru, en };

export const LOCALE_BY_LANG: Record<Lang, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

type TFunc = (key: string, params?: Record<string, string | number>) => string;

type LanguageCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
};

const LanguageContext = createContext<LanguageCtx | null>(null);

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  } catch {}
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      let str = translations[lang][key] ?? translations[DEFAULT_LANG][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return str;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageCtx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
