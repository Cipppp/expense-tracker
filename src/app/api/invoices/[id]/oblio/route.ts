import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOblioInvoice, oblioConfigured, oblioPreflight } from "@/lib/oblio";
import { getSettings } from "@/lib/queries";
import { vatKindForInvoice } from "@/lib/vat";
import { legalMentionText } from "@/lib/legal-mentions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Apelul catre Oblio are timeout de 25s; lasam functiei loc sa-l raporteze.
export const maxDuration = 60;

/*
 * Impinge o factura deja emisa in aplicatie si catre Oblio.
 *
 * Doua sisteme de numerotare care nu se cunosc ar produce serii divergente,
 * asa ca numarul primit inapoi de la Oblio se salveaza pe factura. Daca
 * factura a fost deja trimisa, ruta nu o mai trimite a doua oara — un duplicat
 * in contabilitate e mai greu de reparat decat un buton apasat degeaba.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // Autentificarea e facuta de middleware pentru tot /api in afara listei
  // publice; ruta asta nu e in ea.
  if (!oblioConfigured()) {
    return NextResponse.json(
      {
        error:
          "Oblio is not configured. Set OBLIO_EMAIL and OBLIO_SECRET, then redeploy.",
      },
      { status: 422 },
    );
  }

  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice.oblioNumber) {
    return NextResponse.json({
      already: true,
      oblioNumber: invoice.oblioNumber,
      oblioLink: invoice.oblioLink,
    });
  }

  if (
    invoice.invoiceCurrency !== invoice.legalCurrency &&
    !(invoice.bnrRate && invoice.bnrRate > 0)
  ) {
    return NextResponse.json(
      {
        error: `Invoice is in ${invoice.invoiceCurrency} but has no BNR rate. Set the rate first.`,
      },
      { status: 422 },
    );
  }

  const settings = await getSettings();

  /*
   * Numai facturi noi, si numai daca cele doua numerotari sunt in pas.
   *
   * Butonul apare pe orice factura din istoric, iar Oblio nu ia numarul de pe
   * document: consuma urmatorul din seria LUI. Un clic pe CP0021 ar fi creat
   * la Oblio documentul CP0029, datat in iunie, cu 21% TVA de la o firma care
   * intre timp nu mai e platitoare — si l-ar fi trimis la SPV a doua zi. Aia
   * se repara doar cu stornare.
   *
   * Comparatia cu `next` din seria Oblio prinde si cazul in care contorul a
   * fost mutat din alta parte (o factura emisa direct in interfata).
   */
  try {
    const pre = await oblioPreflight({
      series: settings.invoiceSeries,
      issuerCif: settings.issuerCif,
      issuerVatIntra: settings.issuerVatIntra,
    });
    if (pre.series.next && pre.series.next !== invoice.number) {
      return NextResponse.json(
        {
          error: `Oblio is at ${invoice.series} ${pre.series.next}, this invoice is ${invoice.series} ${invoice.number}. Only the next invoice in the series can be issued through the API.`,
        },
        { status: 409 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oblio preflight failed" },
      { status: 502 },
    );
  }

  /*
   * `cif` selecteaza firma emitenta din contul Oblio — nu e un cod care se
   * tipareste. Trimiterea codului art. 317 in locul CIF-ului intorcea
   * "The company with cif RO55415170 does not exist" (verificat pe contul
   * real), deci ar fi picat FIECARE factura externa. Codul intracomunitar isi
   * are locul pe document, unde PDF-ul si XML-ul il pun deja corect.
   */
  /*
   * Mentiunile legale de pe factura. PDF-ul aplicatiei le tipareste singur,
   * dar Oblio pune pe document doar ce primeste in `mentions`, iar contul e
   * neplatitor de TVA, deci Oblio nu arata nicio coloana de TVA. Fara textul
   * de mai jos, factura din Oblio (cea din contabilitate si din SPV) pleca
   * fara "taxare inversa" si fara codul art. 317 — ambele cerute de art. 319
   * alin. (20) Cod fiscal. Un footerNote scris de mana are prioritate.
   */
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, settings.vatRegistered);
  // Romana + engleza, acelasi text ca pe PDF (lib/legal-mentions).
  const legalMention = legalMentionText(kind, { issuerVatIntra: settings.issuerVatIntra });

  try {
    const result = await createOblioInvoice({
      issuerCif: settings.issuerCif,
      seriesName: invoice.series,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      currency: invoice.invoiceCurrency,
      exchangeRate: invoice.bnrRate,
      vatRate: invoice.vatRate,
      mentions: invoice.footerNote?.trim() || legalMention,
      client: {
        name: invoice.clientCompany || invoice.clientName,
        cif: invoice.clientCui,
        rc: invoice.clientReg,
        address: invoice.clientAddress,
        country: invoice.clientCountry,
        email: invoice.job?.email ?? null,
      },
      lines: invoice.lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });

    const oblioNumber = `${result.seriesName} ${result.number}`.trim();
    try {
      await db.invoice.update({
        where: { id },
        data: { oblioNumber, oblioLink: result.link },
      });
    } catch {
      // Documentul EXISTA la Oblio. Daca inghitim eroarea de scriere si
      // raportam esec, urmatorul clic emite un duplicat pe care Oblio nu-l
      // mai poate sterge.
      return NextResponse.json(
        {
          oblioNumber,
          oblioLink: result.link,
          already: false,
          warning:
            "Issued in Oblio but the local record could not be updated. Do not press again.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ oblioNumber, oblioLink: result.link, already: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oblio call failed" },
      { status: 502 },
    );
  }
}
