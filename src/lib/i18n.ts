import { en, TranslationDict } from "../i18n/en";
import { hi } from "../i18n/hi";

export type SupportedLanguage = "en" | "hi";

export function getTranslations(lang: SupportedLanguage): TranslationDict {
  return lang === "hi" ? hi : en;
}

export function tText(lang: SupportedLanguage, enText: string, hiText: string): string {
  return lang === "hi" ? hiText : enText;
}
