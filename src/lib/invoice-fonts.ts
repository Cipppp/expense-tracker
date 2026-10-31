import path from "node:path";
import { Font } from "@react-pdf/renderer";

/*
 * JetBrains Mono pentru template-urile noi de factura. Varianta NL, fara
 * ligaturi, ca "->" sau "!=" dintr-o descriere sa ramana caractere separate.
 * Fisierele se citesc de pe disc la randare (next.config le include in
 * functiile de pe Vercel). Fontul are si diacriticele romanesti.
 */
export const INVOICE_FONT = "JetBrains Mono";

const file = (weight: string) =>
  path.join(process.cwd(), "src/assets/fonts/jetbrains-mono", `JetBrainsMonoNL-${weight}.ttf`);

Font.register({
  family: INVOICE_FONT,
  fonts: [
    { src: file("Regular"), fontWeight: 400 },
    { src: file("Medium"), fontWeight: 500 },
    { src: file("Bold"), fontWeight: 700 },
  ],
});

/** Fara despartire in silabe: un cod, un IBAN sau un nume nu se rup cu cratima. */
export const noHyphens = (word: string) => [word];

/** RO53INGB0000... in grupe de cate patru, cum se citeste si se dicteaza. */
export function groupIban(iban: string): string {
  return iban.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}
