import "server-only";
import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import { photosConfigured, putObject } from "@/lib/s3";

/*
 * Arhiva legala a facturii electronice.
 *
 * Pe `ok`, ZIP-ul de la descarcare contine <cifre>.xml (factura ta) si
 * semnatura_<cifre>.xml (sigiliul MF). Impreuna sunt "exemplarul original al
 * facturii electronice" (OUG 120/2021 art. 4 alin. 6) si se pastreaza 5 ani de
 * la 1 iulie al anului urmator (Legea 82/1991 art. 25). ANAF il mai da la
 * descarcare doar 60 de zile, deci il salvam la prima ocazie.
 *
 * Pe `nok`, <cifre>.xml e raportul de erori, tot sigilat — se pastreaza ca
 * dovada a incercarii.
 *
 * Care dintre cele doua numere ANAF apare in numele fisierului nu e
 * documentat, asa ca fisierele se recunosc dupa forma, nu dupa valoare.
 */

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export type AnafZip = {
  entries: string[];
  docName: string | null;
  docXml: string | null;
  sigName: string | null;
  sigXml: string | null;
};

export function parseAnafZip(bytes: Uint8Array): AnafZip {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("Not a zip archive");
  // Varianta sincrona: cea asincrona porneste worker threads, care pe
  // serverless mor cu functia.
  const files = unzipSync(bytes);
  const entries = Object.keys(files).filter((n) => !n.endsWith("/"));
  const sigName = entries.find((n) => /(^|\/)semnatura_\d+\.xml$/i.test(n)) ?? null;
  const docName =
    entries.find((n) => /(^|\/)\d+\.xml$/i.test(n)) ??
    entries.find((n) => n !== sigName && /\.xml$/i.test(n)) ??
    null;
  const dec = new TextDecoder();
  return {
    entries,
    docName,
    docXml: docName ? dec.decode(files[docName]) : null,
    sigName,
    sigXml: sigName ? dec.decode(files[sigName]) : null,
  };
}

/** Toate mesajele de eroare din raportul nok (<Error errorMessage="..."/>). */
export function parseErrorReport(docXml: string | null): string[] {
  if (!docXml) return [];
  return [...docXml.matchAll(/errorMessage\s*=\s*"([^"]*)"/gi)].map((m) =>
    m[1]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
}

export type ArchiveKeys = {
  zipS3Key: string | null;
  xmlS3Key: string | null;
  signatureS3Key: string | null;
  zipInline: string | null;
};

/**
 * Pune ZIP-ul si cele doua XML-uri in S3 sub efactura/{env}/{serie}{numar}/.
 * Fara S3 configurat, ZIP-ul ramane inline in baza (base64) — mic, si nu se
 * pierde.
 */
export async function archiveZip(o: {
  env: string;
  series: string;
  number: string;
  indexIncarcare: string;
  zip: Uint8Array;
  parsed: AnafZip;
}): Promise<ArchiveKeys> {
  const b64 = Buffer.from(o.zip).toString("base64");
  if (!photosConfigured) {
    return { zipS3Key: null, xmlS3Key: null, signatureS3Key: null, zipInline: b64 };
  }
  const prefix = `efactura/${o.env}/${o.series}${o.number}/${o.indexIncarcare}`;
  const zipS3Key = `${prefix}.zip`;
  const xmlS3Key = o.parsed.docXml ? `${prefix}/${basename(o.parsed.docName!)}` : null;
  const signatureS3Key = o.parsed.sigXml ? `${prefix}/${basename(o.parsed.sigName!)}` : null;
  try {
    await putObject(zipS3Key, o.zip, "application/zip");
    if (xmlS3Key && o.parsed.docXml) {
      await putObject(xmlS3Key, Buffer.from(o.parsed.docXml, "utf8"), "application/xml");
    }
    if (signatureS3Key && o.parsed.sigXml) {
      await putObject(signatureS3Key, Buffer.from(o.parsed.sigXml, "utf8"), "application/xml");
    }
    return { zipS3Key, xmlS3Key, signatureS3Key, zipInline: null };
  } catch {
    // S3 a cazut: nu pierdem originalul, il tinem inline. Cronul il muta in
    // S3 la urmatoarea rulare (`promoteInlineZip`).
    return { zipS3Key: null, xmlS3Key: null, signatureS3Key: null, zipInline: b64 };
  }
}

/**
 * Muta in S3 o arhiva ramasa inline. Intoarce cheile doar daca S3 a mers;
 * altfel null si copia inline ramane cum e.
 */
export async function promoteInlineZip(o: {
  env: string;
  series: string;
  number: string;
  indexIncarcare: string;
  zipInline: string;
}): Promise<ArchiveKeys | null> {
  if (!photosConfigured) return null;
  const zip = new Uint8Array(Buffer.from(o.zipInline, "base64"));
  let parsed: AnafZip;
  try {
    parsed = parseAnafZip(zip);
  } catch {
    return null;
  }
  const keys = await archiveZip({ env: o.env, series: o.series, number: o.number, indexIncarcare: o.indexIncarcare, zip, parsed });
  return keys.zipS3Key ? { ...keys, zipInline: null } : null;
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}
