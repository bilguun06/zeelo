import { en } from './en';
import { mn, type Dictionary } from './mn';

export type Language = 'mn' | 'en';
export const DEFAULT_LANGUAGE: Language = 'mn';
export const dictionaries: Record<Language, Dictionary> = { mn, en };
export type { Dictionary };

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TranslationKey = Path<Dictionary>;

/** Looks up a dotted key and interpolates {{vars}}. Falls back to Mongolian, then to the key itself. */
export function translate(lang: Language, key: TranslationKey | string, vars?: Record<string, string | number>): string {
  const lookup = (dict: unknown) =>
    key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict);
  let value = lookup(dictionaries[lang]) ?? lookup(dictionaries.mn);
  if (typeof value !== 'string') return key;
  if (vars) value = value.replace(/\{\{(\w+)\}\}/g, (_, v: string) => String(vars[v] ?? ''));
  return value as string;
}
