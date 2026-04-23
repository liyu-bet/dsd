export type LanguageUiMeta = {
  short: string;
  title: string;
  countryCode: string;
};

export const languageUiMeta: Record<string, LanguageUiMeta> = {
  ar: { short: 'AR', title: 'Арабский', countryCode: 'sa' },
  bg: { short: 'BG', title: 'Болгарский', countryCode: 'bg' },
  cs: { short: 'CS', title: 'Чешский', countryCode: 'cz' },
  de: { short: 'DE', title: 'Немецкий', countryCode: 'de' },
  en: { short: 'EN', title: 'Английский', countryCode: 'gb' },
  es: { short: 'ES', title: 'Испанский', countryCode: 'es' },
  fr: { short: 'FR', title: 'Французский', countryCode: 'fr' },
  hi: { short: 'HI', title: 'Хинди', countryCode: 'in' },
  hr: { short: 'HR', title: 'Хорватский', countryCode: 'hr' },
  hu: { short: 'HU', title: 'Венгерский', countryCode: 'hu' },
  it: { short: 'IT', title: 'Итальянский', countryCode: 'it' },
  ja: { short: 'JA', title: 'Японский', countryCode: 'jp' },
  kk: { short: 'KK', title: 'Казахский', countryCode: 'kz' },
  ko: { short: 'KO', title: 'Корейский', countryCode: 'kr' },
  lt: { short: 'LT', title: 'Литовский', countryCode: 'lt' },
  nl: { short: 'NL', title: 'Нидерландский', countryCode: 'nl' },
  pl: { short: 'PL', title: 'Польский', countryCode: 'pl' },
  pt: { short: 'PT', title: 'Португальский', countryCode: 'pt' },
  ro: { short: 'RO', title: 'Румынский', countryCode: 'ro' },
  ru: { short: 'RU', title: 'Русский', countryCode: 'ru' },
  th: { short: 'TH', title: 'Тайский', countryCode: 'th' },
  tr: { short: 'TR', title: 'Турецкий', countryCode: 'tr' },
  uk: { short: 'UK', title: 'Украинский', countryCode: 'ua' },
  zh: { short: 'ZH', title: 'Китайский', countryCode: 'cn' },
};

export const normalizeLanguageCode = (value?: string | null) => {
  if (!value) return null;
  const cleaned = String(value).replace(/_/g, '-').trim().toLowerCase();
  const match = cleaned.match(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?/i);
  return match ? match[0] : null;
};

export const getLanguageFlagUrl = (countryCode?: string | null) =>
  countryCode ? `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png` : null;
