"use client";

import { useSyncExternalStore } from "react";

/*
 * Nimeni nu se abonează la nimic: „am fost hidratat?” nu se schimbă niciodată
 * după ce devine adevărat, deci funcția de dezabonare n-are ce face.
 */
const noSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Adevărat abia după ce componenta a ajuns în browser.
 *
 * Trebuie când ce afișezi depinde de ceva ce există doar pe client — tema
 * rezolvată, `localStorage`, fusul orar al utilizatorului. Randat direct,
 * serverul ar scrie una și clientul alta, iar React s-ar plânge de hidratare.
 *
 * Varianta obișnuită e un `useState(false)` plus un efect care îl face
 * adevărat. Merge, dar trece prin încă o randare și pune `setState` într-un
 * efect fără să existe niciun sistem extern de sincronizat. `useSyncExternal-
 * Store` spune exact același lucru: pe server răspunsul e fals, în browser e
 * adevărat, fără efect și fără randarea în plus.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, onClient, onServer);
}
