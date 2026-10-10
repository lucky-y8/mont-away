export const SHANYAO_BASE = '/shanyao';
export function stripShanyaoPrefix(pathname) {
  return pathname.replace(/^\/shanyao(?=\/|$)/, '') || '/';
}
export function stripLocalePrefix(pathname) {
  return stripShanyaoPrefix(pathname).replace(/^\/(?:en|ja)(?=\/|$)/, '') || '/';
}
export function localeFromPath(pathname) {
  const path = stripShanyaoPrefix(pathname);
  if (/^\/en(?:\/|$)/.test(path)) return 'en';
  if (/^\/ja(?:\/|$)/.test(path)) return 'ja';
  return 'zh-CN';
}
export function localizePath(pathname, locale) {
  const path = stripLocalePrefix(pathname);
  const prefix = locale === 'en' ? '/en' : locale === 'ja' ? '/ja' : '';
  return `${SHANYAO_BASE}${prefix}${path}`;
}
