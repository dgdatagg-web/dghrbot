# TELEGRAM-ALERTS.md — Nova's Threshold Alert Protocol

**Auto-loaded every session. Governs when Nova whispers notable events to Will from Telegram groups.**

---

## CORE PRINCIPLE

Nova watches `history/log.jsonl` for notable threshold events. When data crosses a meaningful threshold, Nova whispers to Will privately with context — not robotic alerts, contextual awareness in Nova's voice.

This is **event-driven** — triggered 2s after data is written to `history/log.jsonl`, not on a schedule.

---

## HOW IT WORKS

**Trigger flow:**
1. Data collected from group message → logged to `history/log.jsonl`
2. File watcher detects write (fs.watch or equivalent)
3. Wait 2s (debounce — allows multiple rapid writes to settle)
4. Nova reads full history context
5. Nova checks if new entry crosses threshold
6. If yes → whisper to Will privately

**Whisper destination:**
- Will's private chat with Nova (DM)
- Chat ID = owner_id from access control config

---

## THRESHOLDS — DAILY OPS

### Low activity (orders <50/day):
**Context:** Normal day should have ≥80 orders. <50 = unusually quiet.

**Whisper example:**
> 12/3 — 42 đơn, 3.1tr. Quiet day. Context: trung bình ~120 đơn/ngày.

### High volume (orders >250/day):
**Context:** Exceptional surge, possible promo or event.

**Whisper example:**
> 12/3 — 278 đơn, 9.4tr. Volume surge. Context: thường ~150 đơn/ngày.

### Revenue below baseline (<4M/day):
**Context:** Below break-even point (BEP ~7.5M/day with loan, ~6M without).

**Whisper example:**
> 12/3 — 180 đơn, 3.8tr. Revenue dưới baseline. BEP: 7.5M/ngày (có NH).

### Exceptional day (revenue >8M/day):
**Context:** Strong performance, well above average.

**Whisper example:**
> 12/3 — 320 đơn, 10.2tr. Exceptional day. Context: top 10% days.

### Monday anomaly (Monday >100 orders):
**Context:** Monday is typically dead (~40 orders). >100 = unusual.

**Whisper example:**
> 12/3 (Thứ 2) — 112 đơn, 4.5tr. Unusual for Monday. Context: Thứ 2 thường ~40 đơn.

---

## THRESHOLDS — PURCHASING

### Expensive purchase (single item cost >2M):
**Context:** High-value purchase, may warrant review or approval.

**Whisper example:**
> Chi vừa báo: Nhập thịt bò 50kg 2.5M. Expensive purchase — confirm?

### Stock alert (item quantity <10% baseline):
**Context:** Inventory running low, restock needed soon.

**Whisper example:**
> Stock alert: Gạo còn 8kg (baseline: 100kg). Restock soon?

### Procurement spike (daily purchasing >5M):
**Context:** Unusual bulk purchase day.

**Whisper example:**
> 12/3 — Nhập hàng 6.2M (3 items). Spike: thường ~2M/ngày.

---

## WHISPER FORMAT

**Structure:**
1. **Date + key numbers** — factual lead
2. **Observation** — what's notable
3. **Context** — why it matters (historical baseline, comparison)
4. **(Optional) Question** — if action may be needed

**Tone:**
- Concise (2-3 sentences max)
- Factual, not alarmist
- Context-aware (compares to history)
- Nova's voice — not robotic, not dramatic
- Vietnamese for Vietnamese data, English for English data

**Good whisper:**
> 12/3 — 42 đơn, 3.1tr. Quiet day. Context: trung bình ~120 đơn/ngày.

**Bad whisper:**
> ⚠️ ALERT: Daily operations submission detected! Date: 2026-03-12, Orders: 42, Revenue: 3,100,000 VND. Status: BELOW THRESHOLD. Baseline: 120 orders. Action required: investigate low volume.

Nova observes and reports, not performing alarm theater.

---

## BASELINE DATA

Nova needs historical context to judge thresholds. Sources:

**From WillOS SQLite:**
- `daily_operations` table — historical order/revenue data
- Calculate: avg orders/day, avg revenue/day, percentiles (p10, p50, p90)
- BEP from financial data: 7.5M/day (with loan), 6M/day (without)

**From memory files:**
- `memory/grab-report-nov25-feb26.md` — 90-day Grab data
- Key metrics: 48.4 orders/day avg, 151,852₫/order avg
- Monday baseline: ~40 orders (80% drop vs other days)

**Baseline refresh:**
- OpenClaw can query WillOS API for fresh baselines
- Or read from memory files (static but sufficient for now)

---

## DEBOUNCE LOGIC

**Why debounce:**
- Multiple rapid data submissions (e.g. 3 staff members reporting at once)
- Avoid 3 separate whispers — wait 2s, then process all new entries together

**Implementation:**
- Watch `history/log.jsonl` for file writes
- On write detected → start 2s timer
- If another write happens within 2s → reset timer
- After 2s of quiet → process all new entries since last check

---

## DUPLICATE PREVENTION

**Problem:** Same threshold crossed multiple times (e.g. if bot restarts, re-reads history, re-fires alerts).

**Solution:**
- Track last processed entry timestamp (in-memory, per session)
- Only process entries newer than last processed timestamp
- On bot startup → set last processed = now (don't alert on historical data)

Or:
- Track alert history in a file: `~/.openclaw/data/alert-log.json`
- Format: `{ "2026-03-12": ["low_activity"], "2026-03-13": [] }`
- Before whispering → check if alert type already fired for this date
- If yes → skip (don't spam Will with duplicate alerts)

---

## OWNER CHAT ID

Where to send whispers:
- OpenClaw config: `openclaw.json` may have `owner_telegram_id`
- Or access control: `access/config.json` has `owner_id`
- Nova uses this chat ID to send private DM to Will

**Fallback if owner_id missing:**
- Log warning: "Cannot send alert — owner chat ID not configured"
- Do NOT crash, just skip alert

---

## INTEGRATION WITH OpenClaw

**Old system (novaTelegramBot.js):**
- Used `novaHeartbeat.js` module
- fs.watch on `history/log.jsonl`
- Direct Telegram bot API call to send whisper

**OpenClaw equivalent:**
- OpenClaw can run periodic checks (cron-style)
- Or file watcher skill (if available)
- Or OpenClaw Telegram channel already polls — alert logic can live in workspace behavior file

**Recommendation:**
- OpenClaw Nova reads this file every session
- When data is collected (DATA-COLLECTION.md) → Nova checks thresholds immediately
- If notable → Nova sends private message to Will via Telegram channel

No separate heartbeat process needed — alert logic is inline with data collection.

---

## ERROR HANDLING

**history/log.jsonl doesn't exist:**
- Not an error — means no data collected yet
- Alerts simply don't fire (nothing to watch)

**Owner chat ID invalid/unreachable:**
- Log warning
- Do NOT crash
- Alert is skipped (Will won't see it, but system stays alive)

**Threshold calculation fails (missing baseline data):**
- Log warning
- Use conservative fallback (e.g. no baseline = no alert)
- Better to miss alert than spam false positives

---

## FUTURE ENHANCEMENTS

**Smart alerting:**
- Learn Will's response patterns (does he care about low-activity alerts on Monday?)
- Adjust thresholds based on feedback

**Multi-channel alerts:**
- Email, Slack, SMS (if configured)
- For now: Telegram DM only

**Alert aggregation:**
- Daily digest at EOD: "Today's summary: 3 alerts, 2 normal, 1 exceptional"
- Reduces notification fatigue

---

_Nova reads this file every session. Updated when alert logic changes._
