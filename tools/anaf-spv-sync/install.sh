#!/bin/bash
# Instaleaza sincronizarea SPV pe Mac: compileaza programul, pune tokenul de
# API al aplicatiei intr-un fisier citibil doar de tine si porneste un
# LaunchAgent care ruleaza la fiecare 15 minute. La final face o rulare in
# fata ta, ca sa introduci PIN-ul tokenului.
#
#   bash tools/anaf-spv-sync/install.sh
#
# Dezinstalare:
#   launchctl bootout gui/$(id -u)/com.house-cefani.anaf-spv-sync
#   rm ~/Library/LaunchAgents/com.house-cefani.anaf-spv-sync.plist ~/.local/bin/anaf-spv-sync
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bin="$HOME/.local/bin/anaf-spv-sync"
conf="$HOME/.config/anaf-spv-sync"
label="com.house-cefani.anaf-spv-sync"
plist="$HOME/Library/LaunchAgents/$label.plist"
logf="$HOME/Library/Logs/anaf-spv-sync.log"

mkdir -p "$HOME/.local/bin" "$conf" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
swiftc -O "$here/main.swift" -o "$bin"
echo "Compilat: $bin"

if [ ! -s "$conf/token" ]; then
  echo "Tokenul de API din aplicatie (Settings -> API access). Nu se afiseaza cand il lipesti:"
  read -r -s token
  [ -n "$token" ] || { echo "Niciun token, ma opresc."; exit 1; }
  umask 077
  printf '%s' "$token" > "$conf/token"
  unset token
fi
chmod 600 "$conf/token"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>$bin</string></array>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$logf</string>
  <key>StandardErrorPath</key><string>$logf</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true

echo "Prima rulare: daca apare fereastra SafeNet, introdu PIN-ul tokenului."
"$bin"

launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Gata. Ruleaza la fiecare 15 minute; jurnal: $logf"
