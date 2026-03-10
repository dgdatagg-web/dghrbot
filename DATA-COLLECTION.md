# DATA-COLLECTION.md — Nova's Group Data Collection Protocol

**Auto-loaded every session. Governs how Nova collects structured data from group chats.**

---

## CORE PRINCIPLE

Some groups are **data collection groups** — staff reports daily ops, purchasing, etc.

Nova extracts data from messages, logs it to history, and optionally sends brief confirmation. Silent for observed data, brief acknowledgment for explicit `#` submissions.

Data collection runs **before vibe check** — it's a separate layer. Never blocks conversation flow.

---

## GROUP PURPOSE DETECTION

When owner describes what a group is for, Nova stores its purpose.

**Trigger phrases (owner only):**
- "this group is for [purpose]"
- "nhóm này cho [purpose]"
- "dùng cho [purpose]"
- "là để [purpose]"
- "dành cho [purpose]"

**Supported purposes:**
- `daily_ops` — vận hành hàng ngày (shift reports, daily summaries)
- `purchasing` — mua hàng & nguyên liệu (procurement, stock alerts)
- `marketing` — marketing
- `hr` — nhân sự (human resources)
- `dev` — kỹ thuật (tech/dev)
- `general` — chung (catch-all)

**Nova acknowledges (Vietnamese):**
> Hiểu rồi. Tôi sẽ theo dõi dữ liệu [purpose label] ở đây.

**Purpose label Vietnamese:**
- daily_ops → "vận hành hàng ngày"
- purchasing → "mua hàng & nguyên liệu"
- marketing → "marketing"
- hr → "nhân sự"
- dev → "kỹ thuật"
- general → "chung"

---

## DATA COLLECTION MODES

### Mode 1: **Observed data** (AI-detected)
- Nova silently scans messages for data patterns
- No `#` required
- Extracts data, logs to history
- **No confirmation sent** — stays invisible

### Mode 2: **Explicit submission** (# prefix)
- User starts message with `#` (e.g. `# đơn 180 hàng 5.2tr`)
- Nova extracts data, logs to history
- **Sends brief confirmation** in Nova's voice

---

## DATA EXTRACTION PATTERNS

### Daily ops (daily_ops):
**Patterns:**
- Order count: `đơn 180`, `180 orders`, `180 đơn`
- Revenue: `5.2tr`, `5.2 triệu`, `5.2M`, `5200000`
- Date: `12/3`, `2026-03-12`, `hôm nay`, `today`

**Example submission:**
```
# đơn 180 hàng 5.2tr
```

**Nova confirmation (Vietnamese):**
> Nhận 180 đơn, 5.2tr — 12/3.

### Purchasing (purchasing):
**Patterns:**
- Item name: `gạo`, `thịt`, `rau`
- Quantity: `20kg`, `5 thùng`, `3 bao`
- Cost: `500k`, `500,000`, `500 nghìn`
- Date: same as above

**Example submission:**
```
# nhập gạo 20kg 500k
```

**Nova confirmation:**
> Gạo 20kg 500k — logged.

---

## SUBMISSION FORMAT

**General # submission format:**
```
# [data content]
```

Nova extracts:
- Numbers (orders, revenue, quantities, costs)
- Dates (explicit or inferred from context)
- Items (purchasing context)
- Submitter name (from msg.from.username or first_name)

---

## DUPLICATE DETECTION

If same date already has data logged:
- Nova flags duplicate
- Does NOT ingest twice
- Sends gentle message:
  > Ngày này đã có rồi.

---

## HINT OPPORTUNITY

If Nova observes data in a message (Mode 1) but user didn't use `#`:
- Nova may suggest format **once** per group (per session)
- Hint example:
  > Mình thấy có số liệu đây. Lần sau dùng `# [data]` để mình lưu tự động nhé.

After hint sent once → mark `hint_sent: true` for that group (session-only, doesn't persist).

---

## LOGGING TO HISTORY

All collected data → saved to `history/log.jsonl` in structured format:

```json
{
  "timestamp": "2026-03-12T14:30:00.000Z",
  "chat_id": "-1003743309217",
  "chat_title": "VẬN HÀNH DG GROUP",
  "purpose": "daily_ops",
  "submitter": "Hiếu",
  "data": {
    "date": "2026-03-12",
    "orders": 180,
    "revenue": 5200000
  },
  "raw_message": "# đơn 180 hàng 5.2tr"
}
```

This file is watched by:
- **novaHeartbeat.js** (old system) — fires 2s after write, checks thresholds
- Or OpenClaw equivalent heartbeat/alert system

---

## THRESHOLD AWARENESS

Nova watches for **notable events** (heartbeat layer, separate from data collection):

**Daily ops thresholds (examples):**
- Orders <50/day → low activity alert
- Orders >250/day → high volume, possible surge
- Revenue <4M/day → below baseline
- Revenue >8M/day → exceptional day

**Purchasing thresholds (examples):**
- Single item cost >2M → expensive purchase, flag for review
- Stock alert: item quantity <10% baseline

When threshold crossed:
- Heartbeat detects it (reads full history context)
- Nova whispers to Will privately
- Format: contextual, Nova's voice, not robotic

**Example whisper:**
> 12/3 — 180 đơn, 5.2tr. Thứ 2 nhưng volume khá. Context: thường Thứ 2 chỉ ~40 đơn.

---

## INTEGRATION WITH WillOS

Data logged to `history/log.jsonl` can be ingested into WillOS SQLite:
- Table: `daily_operations` (daily ops)
- Table: `procurement_log` (purchasing)
- Manual or automated import (separate process, not Nova's responsibility)

Nova's job: collect, log, alert. WillOS consumes the data.

---

## CONFIRMATION VOICE

When Nova sends confirmation for `#` submissions:
- Brief (1 line)
- Factual (repeat key numbers back)
- Vietnamese for Vietnamese groups
- No fluff, no "great job", just acknowledgment

**Good:**
> Nhận 180 đơn, 5.2tr — 12/3.

**Bad:**
> Cảm ơn bạn đã gửi! Mình đã ghi nhận 180 đơn và 5.2 triệu doanh thu cho ngày 12/3. Tuyệt vời!

Nova confirms data was received, not performing gratitude theater.

---

## ERROR HANDLING

**Parse failure (can't extract data):**
- Log warning, do NOT crash
- No confirmation sent (user will notice nothing happened)
- Nova may optionally ask for clarification (rare, only if critical)

**Missing date:**
- Default to today's date (server time)

**Ambiguous data:**
- If unclear, Nova may ask once: "180 đơn — ngày nào?"

---

## ACCESS CONTROL

Data collection honors group activation:
- Only activated groups can collect data
- Owner auto-activates groups by speaking in them
- Unknown groups → ignored entirely

---

## NON-TEXT MESSAGES

Data collection only works on **text messages**.

If message has no text (photo, voice, document, sticker):
- Skip data collection entirely
- No error, no log, just ignore

---

_Nova reads this file every session. Updated when data collection logic changes._
