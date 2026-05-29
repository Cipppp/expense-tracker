# Auto-logging time from Conductor / Claude Code

The expense tracker exposes a token-authenticated endpoint so an agent (or any
script) can log hours into the time tracker without a browser session.

## 1. Get a token

Settings → **API access** → **Generate token**. Copy it. Treat it like a
password — anyone with it can create income entries. Regenerate any time to
invalidate the old one.

Base URL: `https://expense-tracker-sigma-blue-99.vercel.app`

## 2. The endpoint

`POST /api/timelog` with `Authorization: Bearer <token>`.

Three body shapes:

```jsonc
// free-form (parsed like the Cmd+K quick-logger)
{ "text": "30m safeINIT fixed the auth race" }
{ "text": "9-17 netop migrated billing" }

// append to today's block for a client (accumulates across calls)
{ "client": "safeINIT", "minutes": 30, "description": "..." }

// exact block (idempotent — safe to retry)
{ "client": "netop", "start": "10:00", "end": "18:00" }
```

- `date` is optional: `today` (default), `yesterday`, or `yyyy-mm-dd`. Resolved
  in Europe/Bucharest so late-night work lands on the right day.
- **Append mode** (a bare duration or `minutes`) grows the day's single block
  for that client — call it after each prompt and the block extends.
- **Range mode** (`start`+`end`, or `text` with a clock range) sets a precise
  block.

Response echoes what was logged and the running day total:

```json
{ "ok": true, "action": "extended",
  "entry": { "client": "safeINIT", "date": "2026-05-29", "start": "09:00", "end": "11:30", "hours": 2.5 },
  "dayTotalHours": 2.5,
  "message": "Extended 2.5h on safeINIT — 2.5h total today" }
```

## 3. Wire it into a Conductor workspace

Conductor runs Claude Code under the hood, so it honors `.claude/settings.json`
**hooks**. Each client gets its own workspace; bake the client name + token in.

### Option A — automatic, elapsed-time (recommended)

A `Stop` hook fires when the agent finishes each turn. This script logs the
wall-clock minutes since the previous turn (capped, so an idle gap doesn't dump
hours).

`.claude/hooks/log-time.sh` in the client workspace:

```bash
#!/usr/bin/env bash
set -euo pipefail
CLIENT="safeINIT"   # <- this workspace's client
TOKEN="tl_xxxxxxxx" # <- Settings → API access
BASE="https://expense-tracker-sigma-blue-99.vercel.app"
MAX_GAP_MIN=45      # ignore gaps longer than this (you stepped away)

stamp="${TMPDIR:-/tmp}/timelog-$CLIENT.last"
now=$(date +%s)
if [[ -f "$stamp" ]]; then
  mins=$(( (now - $(cat "$stamp")) / 60 ))
  if (( mins >= 1 && mins <= MAX_GAP_MIN )); then
    curl -s -X POST "$BASE/api/timelog" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"client\":\"$CLIENT\",\"minutes\":$mins}" >/dev/null || true
  fi
fi
echo "$now" > "$stamp"
```

`.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "bash .claude/hooks/log-time.sh" } ] }
    ]
  }
}
```

`chmod +x .claude/hooks/log-time.sh`. From then on, every turn in that workspace
appends the elapsed minutes to that client's block for the day.

### Option B — agent-driven, on request

Drop a line in the workspace `CLAUDE.md`:

> This workspace bills to **safeINIT**. When I ask you to "log time", run:
> `curl -X POST https://expense-tracker-sigma-blue-99.vercel.app/api/timelog -H "Authorization: Bearer tl_xxx" -H "Content-Type: application/json" -d '{"client":"safeINIT","minutes":30}'`

Then you trigger it explicitly ("log 30 min", "log this session"). Less magic,
full control over what gets billed.

## Notes

- The token only logs hours. It can't read or delete anything.
- Append accumulates per (client, day); the calendar block grows. Adjust the
  exact start/end later by dragging in the UI if needed.
- Currency, rate, and color come from the client's settings — the API just
  needs the client name and the minutes.
