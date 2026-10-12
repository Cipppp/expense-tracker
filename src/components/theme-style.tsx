"use client";

import { useSyncExternalStore } from "react";

/*
 * Stilul temei contului, plus o previzualizare pe care o poate pune pagina de
 * setari.
 *
 * Serverul trimite CSS-ul temei salvate, deci pagina se deseneaza din prima in
 * culorile bune, fara sa clipeasca in cele de baza. Cand cineva alege alta
 * tema, previzualizarea ia locul CSS-ului salvat imediat, inainte sa ajunga
 * raspunsul de la server. Daca salvarea pica, pagina de setari pune la loc
 * tema de dinainte.
 */
let preview: string | null = null;
const listeners = new Set<() => void>();

export function setThemePreview(css: string | null) {
  preview = css;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function ThemeStyle({ css }: { css: string }) {
  const override = useSyncExternalStore(
    subscribe,
    () => preview,
    () => null,
  );
  const text = override ?? css;
  if (!text) return null;
  // Textul e generat numai din numere validate (vezi lib/theme.ts), nu din
  // ce a scris cineva, deci nu are cum sa injecteze altceva decat culori.
  return <style id="app-theme" dangerouslySetInnerHTML={{ __html: text }} />;
}
