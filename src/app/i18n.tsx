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
