# e-Factura direct la ANAF (fără Oblio)

Aplicația face singură ce fac Oblio și SmartBill: construiește XML-ul UBL/CIUS-RO,
îl validează, se autentifică la ANAF cu OAuth2, îl încarcă, urmărește starea,
descarcă și arhivează răspunsul sigilat de Ministerul Finanțelor.

Surse: procedura ANAF OAuth (`Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf`),
„Prezentare servicii web RO e-Factura" (MF), Schematron `ro16931-ubl-1.0.9`,
ghidul ANAF v2.9, OUG 120/2021 art. 4 și 10, Legea 82/1991 art. 25.

## Cum funcționează

1. **O singură dată pe an**, din browserul cu certificatul: `Settings → ANAF e-Factura → Connect`.
   Aplicația te trimite la `logincert.anaf.ro/anaf-oauth2/v1/authorize`; browserul prezintă
   certificatul (TLS), introduci PIN-ul, ANAF te întoarce la `/api/anaf/oauth/callback?code=…`.
   Codul e schimbat pe loc (fereastră de 60 s) într-un **access token (90 zile)** și un
   **refresh token (365 zile)**, ambele criptate AES-256-GCM în tabela `AnafToken`.
2. **La fiecare factură**, fără certificat: `POST /api/invoices/{id}/efactura/send`
   - politica (`efacturaPolicy`: `auto` | `send` | `skip`) × scopul legal;
   - blocaje locale (județ lipsă pentru RO, EIN sub schema VAT, curs BNR lipsă);
   - rândul `EfacturaSubmission` se creează și devine „curent" **într-o tranzacție, înainte de
     upload** — un timeout sau un dublu click nu pot duce la două facturi la ANAF;
   - `POST webservicesp.anaf.ro/prod/FCTEL/rest/validare/FACT1` (fără token, fără efecte);
   - `POST api.anaf.ro/{test|prod}/FCTEL/rest/upload?standard=UBL&cif=51711091[&extern=DA]`
     → `index_incarcare`;
   - `GET …/stareMesaj?id_incarcare=` la 3 s, 7 s, 12 s; pe `ok`/`nok` →
     `GET …/descarcare?id=<id_descarcare>` → ZIP arhivat în S3 (`efactura/{env}/…`) sau inline.
3. **Cronul zilnic** (`/api/cron/efactura`, 06:00 UTC): reîmprospătează tokenul când mai are
   sub 14 zile, urmărește ce e pe drum, descarcă ce lipsește (ANAF ține ZIP-ul doar 60 de zile),
   împacă rândurile rămase în `uploading` cu `listaMesajeFactura`, trimite email când o factură
   obligatorie are ≤ 2 zile lucrătoare până la termen sau când refresh tokenul mai are sub 30 de zile.

## Setup, o singură dată

1. **Cont de dezvoltator ANAF**: <https://www.anaf.ro/InregOauth/index.xhtml>
   (anaf.ro → Servicii Online → Înregistrare utilizatori → DEZVOLTATORI APLICAȚII).
   Cont cu utilizator + parolă și cod pe email — nu cu certificat.
2. „Autentificare utilizator" → „Editare profil Oauth" → „Gestionare aplicații" → aplicație nouă:
   nume fără spații (ex. `projectcip-invoices`), serviciul **E-Factura**,
   **Callback URL** = `https://house.cefani.com/api/anaf/oauth/callback`.
   **Callback-ul nu se poate edita după creare** — pune domeniul final.
3. Deschide aplicația din listă, copiază **Client ID** și **Client Secret**.
4. Variabile Vercel (Sensitive):

   | Variabilă | Valoare |
   |---|---|
   | `ANAF_CLIENT_ID` / `ANAF_CLIENT_SECRET` | din pasul 3 |
   | `ANAF_REDIRECT_URI` | exact callback-ul înregistrat |
   | `ANAF_ENV` | `test` până trece matricea de mai jos, apoi `prod` |
   | `ANAF_TOKEN_ENC_KEY` | `openssl rand -base64 32` |
   | `CRON_SECRET` | orice string lung; Vercel îl trimite singur la cron |
   | `ANAF_ALERT_EMAIL` | unde vin alertele (folosește `RESEND_API_KEY` + senderEmail) |

5. Redeploy → `Settings → ANAF e-Factura → Connect with certificate` (cu tokenul USB băgat).
6. Verifică: `curl -H "Authorization: Bearer <timelogToken>" https://house.cefani.com/api/anaf/health`
   → `ok: true`, `probe.status: 200`, `token.certSerial` completat.

Certificatul trebuie să fie înrolat în SPV pentru CIF 51711091 (reprezentant legal). Dacă
ANAF răspunde `Nu aveti drept in SPV pentru CIF=51711091`, problema e înrolarea, nu XML-ul;
după reînnoirea certificatului, drepturile se activează a doua zi.

Două convenții care contează în cod:

- **Mediul e al rândului, nu al procesului.** `EfacturaSubmission.env` decide pe ce bază
  (`/test/` sau `/prod/`) se urmărește și se arhivează acel rând, oricare ar fi `ANAF_ENV` acum.
  Un rând de prod „ok" blochează retrimiterea pe prod; un „ok" pe test nu stinge termenul legal.
- **`EFACTURA_SINCE` (2026-09-01)** în `scope.ts`: facturile emise înainte au fost depuse prin
  SmartBill/Oblio, deci nu primesc „overdue" în listă, în panou, în cron sau în health.

## Ce trebuie / ce poate merge la e-Factura

| Client | Scop | `extern` | Politica implicită |
|---|---|---|---|
| Stabilit în RO (CUI românesc) | **obligatoriu** | nu | `auto` → trimite |
| Nestabilit, dar cu cod TVA `RO…` (din 01.01.2026) | **obligatoriu** | nu | `auto` → trimite |
| Străin fără identificator RO (BLNG, netop, curiaself, SPOTLITE) | exceptat expres | `DA` | `auto` → nu trimite; „Send anyway" îl trimite |

Termen: **5 zile lucrătoare** de la emitere (din 2026). Amendă întârziere pentru „celelalte
persoane juridice": 1.000–2.500 lei / lună calendaristică. Sărbătorile legale sunt în
`src/lib/anaf/scope.ts` (`RO_HOLIDAYS`) — de actualizat anual pentru Paște și Rusalii.

## Ce s-a schimbat în XML (și de ce)

- **Neplătitor art. 310 = categoria `O`**, `VATEX-EU-O`, fără `cbc:Percent` (BR-O-05/06), cu
  notă BT-22. Înainte era `E` + `VATEX-EU-D`, care înseamnă *mijloace de transport second-hand*.
- **Sub `O`, nicio parte nu are `PartyTaxScheme/VAT`** (BR-O-02, fatal). CIF-ul vânzătorului
  stă în `PartyLegalEntity/CompanyID` (BT-30) și `PartyIdentification/ID`; J-ul în `CompanyLegalForm`.
- **`CountrySubentity` obligatoriu pentru RO** (BR-RO-111); București = `SECTORn` + `RO-B`
  (BR-RO-101). De aceea clientul are acum câmpul **County** (ISO 3166-2:RO) în Settings.
- **EIN american sub schema VAT pică BR-CO-09** → merge în BT-47, unde nu e verificat.
- Nume articol ≤ 100 (BR-RO-L100), cu restul în `Description`; `PostalZone` omis când e gol.
- UE (AE): vânzătorul cu `RO55415170` (art. 317), cumpărătorul cu cod TVA cu prefix — altfel blocaj.

## Testare pe `ANAF_ENV=test` înainte de prod

Același token merge pe `/test/` și `/prod/`; TEST nu ajunge la nicio contrapartidă.

1. `/api/anaf/health` → 200 (`ok: true` cere și: nicio factură obligatorie peste termen).
   Fără Bearer (timelogToken): HTTP 401, `{"error":"Unauthorized"}`.
2. O factură RO reală (sau copie) → `ExecutionStatus="0"`, `index_incarcare` numeric → `stare="ok"`
   → ZIP cu `^\d+\.xml$` + `^semnatura_\d+\.xml$`.
3. XML stricat intenționat → `nok`; panoul arată mesajele Schematron verbatim.
4. Al doilea „Send" pe aceeași factură → `already: true` (409 logic).
5. Client străin cu și fără `extern=DA` — comportamentul nu e documentat oficial; notează-l.
6. `NODE_PATH=/tmp/efx/node_modules node --import tsx scripts/efactura-fixtures.ts` (cu un stub
   gol pentru `server-only` în acel `node_modules`) + curl pe `/validare/FACT1` pentru cele trei
   forme de XML.

Rezultatele validatorului public pe fixture-uri (01.09.2026):

| Fixture | Răspuns | Ce înseamnă |
|---|---|---|
| client RO cu CUI real (RO38855898, RO-CJ) | `{"stare":"ok"}` | structura O / VATEX-EU-O / BT-30 / CountrySubentity e corectă |
| client RO cu CUI inventat | `ERRIdentif; CUI cumparator incorect` | ANAF verifică CUI-ul în registru; fără CUI valid nu se trimite |
| BLNG (US) și AETHRA (PT) | `ERRIdentif; nu a fost identificat cui cumparator` | validatorul public face și identificarea; pe extern se ignoră doar acest cod, restul blochează |

Abia după 1–5: `ANAF_ENV=prod`, o factură internă reală, verificare manuală în SPV.

## Arhivă și contabil

- Pe `ok`, `<cifre>.xml` + `semnatura_<cifre>.xml` = **exemplarul original** (OUG 120/2021
  art. 4 alin. 6). Se păstrează 5 ani de la 1 iulie al anului următor (Legea 82/1991 art. 25).
  Descărcabile din pagina facturii: *ANAF zip*, *Original XML*, *MF signature*.
- Bucket-ul S3 e în `eu-west-1`. Cod fiscal art. 319 alin. (33)–(34): arhiva electronică în afara
  țării cere acces online garantat și notificarea organului fiscal — de discutat cu contabilul.
- Contabilul citește în continuare SPV-ul. Dispare doar listarea din Oblio. Numerotarea `CP`
  rămâne doar a aplicației.
- Corecții: o factură validată e imuabilă — storno (380 cu cantități negative + `BillingReference`)
  sau notă de credit (381, `standard=CN`).

## Scoaterea Oblio

După prima factură `ok` pe PROD: șterge `src/lib/oblio.ts`, `src/app/api/invoices/[id]/oblio`,
`src/app/api/oblio/**`, cele două intrări din `PUBLIC_PATHS`, `OBLIO_EMAIL` / `OBLIO_SECRET`.
Coloanele `oblioNumber` / `oblioLink` rămân pentru istoric. Până atunci, butonul Oblio dispare doar
când ANAF e configurat **și** `ANAF_ENV=prod` — pe test, Oblio rămâne calea vie, altfel o factură
trimisă doar pe api.anaf.ro/test n-ar ajunge la niciun client. Facturile depuse istoric prin Oblio
(`oblioNumber` setat) sunt considerate depuse de cron, health și lista de facturi.

## Riscuri și cum sunt acoperite

| Risc | Acoperire |
|---|---|
| Refresh token expiră la 365 zile → 401 pe toate → termen ratat | cron reîmprospătează la 76 zile, email la −30 zile, `/api/anaf/health` monitorizabil extern |
| Upload dublu (timeout, dublu click, cron dublu) | rând „curent" în tranzacție înainte de rețea; `indexIncarcare @unique`; stări blocante |
| Plafoane ANAF (100 stareMesaj, 10 descărcări / mesaj / zi, 1000 req/min) | contoare pe zi (20 / 5), backoff pe 429 |
| Callback înghețat | domeniul final de la început; altfel aplicație nouă la ANAF |
| Județ lipsă la client RO după ce a pornit termenul | blocajele apar în panou înainte de trimitere; câmp County pe client |
| ZIP nedescărcat în 60 de zile | descărcare inline pe `ok`, măturare zilnică, `zipInline` când S3 lipsește |
