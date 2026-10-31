import QRCode from "qrcode";

/*
 * Codul QR de plata de pe facturile in euro: formatul EPC069-12 ("GiroCode"),
 * pe care il citesc aplicatiile bancare din zona SEPA. Clientul scaneaza si
 * gaseste transferul completat: beneficiar, IBAN, suma si numarul facturii.
 *
 * Exista doar pentru EUR. Pentru USD si RON nu e un standard pe care sa-l
 * inteleaga bancile clientilor, asa ca acolo factura nu are cod.
 */

export type EpcPayment = {
  bic: string;
  name: string;
  iban: string;
  amount: number;
  /** Textul liber al platii, de ex. "Invoice CP 0035". Maxim 140 de caractere. */
  remittance: string;
};

export function epcPayload(p: EpcPayment): string {
  const amount = Math.round(p.amount * 100) / 100;
  if (!(amount >= 0.01 && amount <= 999_999_999.99)) throw new Error(`EPC amount out of range: ${p.amount}`);
  return [
    "BCD",
    "002",
    "1", // UTF-8
    "SCT",
    p.bic.trim(),
    p.name.trim().slice(0, 70),
    p.iban.replace(/\s+/g, "").toUpperCase(),
    `EUR${amount.toFixed(2)}`,
    "", // purpose
    "", // structured reference (folosim textul liber)
    p.remittance.trim().slice(0, 140),
  ].join("\n");
}

/** Matricea de module a codului, ca PDF-ul s-o deseneze vectorial. */
export function epcMatrix(p: EpcPayment): boolean[][] {
  const qr = QRCode.create(epcPayload(p), { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.modules.get(y, x) === 1));
}
