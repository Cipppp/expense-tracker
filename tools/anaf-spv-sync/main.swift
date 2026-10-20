// Aduce mesajele din SPV (recipise, notificari, decizii) si le urca in aplicatie.
//
// SPV (webserviced.anaf.ro/SPVWS2) se autentifica direct cu certificatul
// calificat, iar cheia lui sta pe tokenul USB si nu iese niciodata de acolo.
// De-aia sincronizarea ruleaza pe Mac, nu pe server: macOS vede certificatul
// prin CryptoTokenKit (SafeNet), iar URLSession il prezinta la conexiune.
//
// Pasii: listaMesaje pe ultimele 60 de zile -> POST /api/anaf/spv/sync, care
// raspunde cu mesajele fara PDF -> descarcare?id= pentru fiecare -> PUT
// /api/anaf/spv/pdf. Ruleaza o data si se inchide: il porneste butonul Sync
// din pagina ANAF, prin schema house-anaf-sync:// (vezi install.sh), sau il
// rulezi tu din terminal. Fara token in laptop iese linistit.
//
// Configurare (vezi install.sh):
//   ~/.config/anaf-spv-sync/token   tokenul de API din Settings -> API access
//   ANAF_SPV_APP_URL                adresa aplicatiei (implicit house.cefani.com)
//   ANAF_SPV_SUBJECT                parte din numele de pe certificat, daca pe
//                                   token sunt mai multe

import Foundation
import Security

let appURL = URL(string: ProcessInfo.processInfo.environment["ANAF_SPV_APP_URL"] ?? "https://house.cefani.com")!
let subjectFilter = ProcessInfo.processInfo.environment["ANAF_SPV_SUBJECT"]?.uppercased()
let tokenPath = FileManager.default.homeDirectoryForCurrentUser
  .appendingPathComponent(".config/anaf-spv-sync/token")

let logURL = FileManager.default.homeDirectoryForCurrentUser
  .appendingPathComponent("Library/Logs/anaf-spv-sync.log")

/// Pornit din browser n-are terminal, deci jurnalul merge si intr-un fisier.
func log(_ s: String) {
  let line = "\(ISO8601DateFormatter().string(from: Date())) \(s)\n"
  FileHandle.standardOutput.write(Data(line.utf8))
  if let h = try? FileHandle(forWritingTo: logURL) {
    h.seekToEndOfFile()
    h.write(Data(line.utf8))
    try? h.close()
  } else {
    try? Data(line.utf8).write(to: logURL)
  }
}

func fail(_ s: String) -> Never {
  log("eroare: \(s)")
  exit(1)
}

/// Identitatea (certificat + cheie) de pe tokenul hardware, nu din keychain-ul local.
func tokenIdentity() -> SecIdentity? {
  let q: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecAttrAccessGroup as String: kSecAttrAccessGroupToken,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnRef as String: true,
  ]
  var out: CFTypeRef?
  guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess,
    let ids = out as? [SecIdentity]
  else { return nil }
  for id in ids {
    var cert: SecCertificate?
    SecIdentityCopyCertificate(id, &cert)
    guard let c = cert else { continue }
    let name = (SecCertificateCopySubjectSummary(c) as String?)?.uppercased() ?? ""
    if subjectFilter == nil || name.contains(subjectFilter!) { return id }
  }
  return nil
}

final class ClientCert: NSObject, URLSessionDelegate {
  let identity: SecIdentity
  init(_ identity: SecIdentity) { self.identity = identity }
  func urlSession(
    _ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodClientCertificate {
      completionHandler(.useCredential, URLCredential(identity: identity, certificates: nil, persistence: .forSession))
    } else {
      completionHandler(.performDefaultHandling, nil)
    }
  }
}

/// Cerere sincrona; scriptul ruleaza de sus in jos, fara nimic altceva de facut intre timp.
func send(_ session: URLSession, _ req: URLRequest) -> (Data, Int) {
  let sem = DispatchSemaphore(value: 0)
  var result: (Data, Int) = (Data(), 0)
  session.dataTask(with: req) { data, resp, err in
    if let err = err { log("cerere esuata \(req.url?.path ?? ""): \(err.localizedDescription)") }
    result = (data ?? Data(), (resp as? HTTPURLResponse)?.statusCode ?? 0)
    sem.signal()
  }.resume()
  sem.wait()
  return result
}

// --- start ---

guard let apiToken = (try? String(contentsOf: tokenPath, encoding: .utf8))?
  .trimmingCharacters(in: .whitespacesAndNewlines), !apiToken.isEmpty
else { fail("lipseste \(tokenPath.path); ruleaza install.sh") }

guard let identity = tokenIdentity() else {
  log("tokenul nu e in laptop, nimic de facut")
  exit(0)
}

// PIN-ul il cere macOS la prima conexiune; SafeNet tine apoi tokenul deblocat.
let cfg = URLSessionConfiguration.ephemeral
cfg.timeoutIntervalForRequest = 180
cfg.timeoutIntervalForResource = 600
let anaf = URLSession(configuration: cfg, delegate: ClientCert(identity), delegateQueue: nil)
let app = URLSession(configuration: .ephemeral)

func appRequest(_ path: String, method: String, body: Data, type: String) -> (Data, Int) {
  var r = URLRequest(url: URL(string: path, relativeTo: appURL)!)
  r.httpMethod = method
  r.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
  r.setValue(type, forHTTPHeaderField: "Content-Type")
  r.httpBody = body
  return send(app, r)
}

let (listData, listStatus) = send(
  anaf, URLRequest(url: URL(string: "https://webserviced.anaf.ro/SPVWS2/rest/listaMesaje?zile=60")!))
guard listStatus == 200,
  let list = try? JSONSerialization.jsonObject(with: listData) as? [String: Any]
else { fail("listaMesaje a raspuns HTTP \(listStatus)") }

let messages = list["mesaje"] as? [[String: Any]] ?? []
if messages.isEmpty, let e = list["eroare"] as? String { log("ANAF: \(e)") }

let payload = try! JSONSerialization.data(withJSONObject: ["mesaje": messages])
let (syncData, syncStatus) = appRequest("/api/anaf/spv/sync", method: "POST", body: payload, type: "application/json")
guard syncStatus == 200,
  let sync = try? JSONSerialization.jsonObject(with: syncData) as? [String: Any]
else { fail("aplicatia a raspuns HTTP \(syncStatus) la /sync") }

let need = sync["needPdf"] as? [String] ?? []
log("\(messages.count) mesaje in SPV, \(sync["created"] ?? 0) noi, \(need.count) PDF-uri de adus")

var uploaded = 0
for id in need {
  let (pdf, st) = send(
    anaf, URLRequest(url: URL(string: "https://webserviced.anaf.ro/SPVWS2/rest/descarcare?id=\(id)")!))
  guard st == 200, pdf.starts(with: Data("%PDF-".utf8)) else {
    log("mesajul \(id): ANAF n-a dat PDF-ul (HTTP \(st))")
    continue
  }
  let (_, up) = appRequest("/api/anaf/spv/pdf?anafId=\(id)", method: "PUT", body: pdf, type: "application/pdf")
  if up == 200 { uploaded += 1 } else { log("mesajul \(id): aplicatia a raspuns HTTP \(up)") }
}
log("gata: \(uploaded)/\(need.count) PDF-uri urcate")
