import { DEFAULT_LANGUAGE, translate, type Language, type TranslationKey } from '@orgil/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { KEYS, prefs } from './storage';

interface I18n {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n>({ lang: DEFAULT_LANGUAGE, setLang: () => {}, t: (k) => translate(DEFAULT_LANGUAGE, k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE);
  useEffect(() => {
    prefs.get(KEYS.language).then((l) => (l === 'en' || l === 'mn') && setLangState(l));
  }, []);
  const setLang = useCallback((l: Language) => {
    setLangState(l);
    void prefs.set(KEYS.language, l);
  }, []);
  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Translates validation error keys coming from @orgil/validation (they are i18n keys). */
export function useErrorText() {
  const { t } = useI18n();
  return (key?: string) => (key ? (key.includes('.') ? t(key as TranslationKey) : key) : undefined);
}
