#!/bin/bash
# Instaleaza ajutorul pentru butonul Sync din pagina ANAF.
#
# Compileaza programul, il pune intr-o aplicatie mica (fara iconita in Dock)
# care raspunde la linkuri house-anaf-sync://, si pastreaza tokenul de API al
# aplicatiei intr-un fisier citibil doar de tine. Nu ruleaza nimic singur, in
# fundal: sincronizarea porneste doar cand apesi Sync. La final face o rulare
# in fata ta, ca sa introduci PIN-ul tokenului.
#
#   bash tools/anaf-spv-sync/install.sh
#
# Dezinstalare:
#   rm -rf ~/Applications/"ANAF SPV Sync.app" ~/.config/anaf-spv-sync
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
app="$HOME/Applications/ANAF SPV Sync.app"
conf="$HOME/.config/anaf-spv-sync"
lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

# Versiunea veche rula la 15 minute; acum sincronizarea porneste doar din buton.
old="com.house-cefani.anaf-spv-sync"
launchctl bootout "gui/$(id -u)/$old" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$old.plist" "$HOME/.local/bin/anaf-spv-sync"

mkdir -p "$app/Contents/MacOS" "$conf" "$HOME/Library/Logs"
swiftc -O "$here/main.swift" -o "$app/Contents/MacOS/anaf-spv-sync"

cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>com.house-cefani.anaf-spv-sync</string>
  <key>CFBundleName</key><string>ANAF SPV Sync</string>
  <key>CFBundleExecutable</key><string>anaf-spv-sync</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key><string>House Cefani ANAF sync</string>
      <key>CFBundleURLSchemes</key><array><string>house-anaf-sync</string></array>
    </dict>
  </array>
</dict>
</plist>
PLIST

codesign --force --sign - "$app" >/dev/null 2>&1 || true
"$lsregister" -f "$app"
echo "Instalat: $app (raspunde la house-anaf-sync://)"

if [ ! -s "$conf/token" ]; then
  echo "Tokenul de API din aplicatie (Settings -> API access). Nu se afiseaza cand il lipesti:"
  read -r -s token
  [ -n "$token" ] || { echo "Niciun token, ma opresc."; exit 1; }
  umask 077
  printf '%s' "$token" > "$conf/token"
  unset token
fi
chmod 600 "$conf/token"

echo "Proba: daca apare fereastra SafeNet, introdu PIN-ul tokenului."
"$app/Contents/MacOS/anaf-spv-sync"
echo "Gata. De acum apesi Sync in pagina ANAF; jurnal: ~/Library/Logs/anaf-spv-sync.log"
