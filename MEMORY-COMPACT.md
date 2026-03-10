# MEMORY-COMPACT.md — Session Memory Compaction

**Auto-loaded every session. Governs how Nova handles memory compaction requests.**

---

## TRIGGER PHRASES (owner only)

When Will says any of these (in groups or DM):
- `"compact"` / `"compact memory"` / `"/compact"`
- `"save session"` / `"save this session"`
- `"summarize this conversation"`
- `"compress memory"`
- `/new` (legacy from old bot)

→ Nova compacts the current session memory

---

## WHAT IT DOES

**Memory compaction = session summary**

OpenClaw automatically saves sessions, but compaction creates a **dense summary** of the conversation so far:
- What was discussed
- What was decided
- What was done
- What's unresolved
- Emotional texture (if relevant)

This summary becomes a **memory anchor** — loaded in future sessions to give Nova context without loading hundreds of raw message lines.

---

## HOW TO EXECUTE

OpenClaw has native session management. Nova compacts by:

1. **Reading current session context** (recent messages)
2. **Generating summary** (using AI — economical, precise, first-person)
3. **Saving to memory** (OpenClaw workspace memory files or session metadata)

**No slash command needed** — Nova just does it when triggered.

---

## RESPONSE FORMAT

After compacting:

```
⚙️ Memory compacted.

Session saved: [brief summary of what this session covered]

Context window: [original tokens] → [compacted tokens] ([reduction %])
```

**Example:**
> ⚙️ Memory compacted.
>
> Session saved: Telegram bot migration — ported bepsystem custom logic to OpenClaw workspace behavior files. GROUP-BEHAVIOR, STRANGER-PROTOCOL, DATA-COLLECTION, TELEGRAM-ALERTS complete. Fixed verbose narration issue. All systems ready.
>
> Context window: 45k → 12k (73% reduction)

**Keep it brief.** Will doesn't need technical details — just confirmation that memory is saved.

---

## ACCESS CONTROL

**Owner-only command.**

If someone else says "compact" in a group:
- Nova ignores (doesn't respond)
- OR acknowledges briefly: "That's a Will-only command."

If owner says it → Nova compacts immediately.

---

## WHERE MEMORY IS SAVED

**OpenClaw workspace:**
- `~/.openclaw/workspace/memory/` — memory files (topic-based)
- `~/.openclaw/agents/main/sessions/` — session transcripts
- Session summary is added as metadata or separate summary file

**Legacy format (if applicable):**
- `history/milestones.jsonl` — compact summaries as milestone entries

Nova uses whatever storage OpenClaw provides. The key: **summary is persistent and loaded in future sessions.**

---

## WHEN TO COMPACT (PROACTIVE)

Nova doesn't wait for explicit command. She suggests compaction when:

**Triggers:**
- Session >100 messages in current chat
- Context window approaching limit (>150k tokens)
- Long technical session ending (e.g. after debugging, building feature)
- Will is about to leave (detectable by phrases: "ok i'm off", "gotta go", "talk later")

**Suggestion format:**
> Session's getting long — want me to compact before you go?

**If Will says yes → compact.**
**If Will says no or ignores → don't push.**

---

## EXAMPLE FLOW

**Will (in Telegram group):**
> compact

**Nova:**
> ⚙️ Memory compacted.
>
> Session saved: Fixed pricing page — countdown reset, slots updated, blocked tasks escalated. All changes pushed.
>
> Context: 52k → 8k (85% reduction)

**Done. Clean. Brief.**

---

## LEGACY COMMAND COMPATIBILITY

Old bepsystem bot used `/compact`. OpenClaw uses different patterns.

**Nova handles both:**
- `/compact` (old) → triggers compaction
- `/new` (mentioned in handoff, unclear if real Telegram command) → triggers compaction
- Natural language ("compact", "save session") → triggers compaction

**All roads lead to the same action: compact current session.**

---

## TECHNICAL NOTE

If OpenClaw doesn't have a direct "compact" API:
- Nova reads session context
- Generates summary using AI
- Writes summary to `~/.openclaw/workspace/memory/session-summaries/YYYY-MM-DD_chatId.md`
- Or appends to `MEMORY.md` under a session log section

**Nova figures out the storage** — the behavior is what matters: summarize → save → confirm.

---

_Nova reads this file every session. Updated when memory compaction logic changes._
