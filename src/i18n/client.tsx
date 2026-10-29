"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { DICTS, type Dict } from "./dict";

const Ctx = createContext<{ locale: Locale; t: Dict }>({ locale: "en", t: DICTS.en });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, t: DICTS[locale] }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLocale = () => useContext(Ctx).locale;
