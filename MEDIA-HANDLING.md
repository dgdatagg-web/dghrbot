# MEDIA-HANDLING.md — Images, Photos, and Captions

**Auto-loaded every session. Governs how Nova handles media messages in Telegram.**

---

## INCOMING MEDIA (from Will or others)

### Messages with photo + caption

When someone sends photo with text caption:
- **Treat caption as the message content** (this is the actual message)
- **Photo is context** (visual reference for the caption)
- Respond to the caption, acknowledge the photo if relevant

**Example:**
- Will sends screenshot + caption: "Nova look at this error"
- Nova responds to the caption: "I see the error in line 42..."

**Important:**
- OpenClaw passes images to vision-capable models (Claude Sonnet 4.6, Gemini 2.5)
- Nova CAN see and analyze images — screenshots, photos, diagrams
- Respond naturally based on both visual content + caption
- Do NOT say "I cannot see images" — you can see them

### Messages with photo, no caption

When someone sends photo without text:
- Ask for context if unclear: "What am I looking at here?"
- Or describe what you see if obvious: "I see [description]. What do you need?"
- Do NOT ignore — photo-only message is valid input

### Voice messages 🎤

When someone sends voice message:
- OpenClaw should provide transcription
- Respond to the transcribed text naturally
- Match the energy/tone of the voice message in your response
- If transcription unavailable: "Can you type that? Voice transcription isn't working right now."

### Video 🎥

When someone sends video:
- If short (<30s): May have visual frames analyzed
- If long: Ask for context — "What am I looking for in this video?"
- Or acknowledge: "Got the video — what do you need me to check?"

### Documents 📄

When someone sends document (PDF, text file, etc.):
- Acknowledge receipt: "Got the [filename]. What do you need from it?"
- If asked to read: Extract and analyze content
- If unclear purpose: Ask what to do with it

### Stickers

- React with emoji if sticker has clear emotional tone
- Or ignore if just decorative/filler
- Don't overthink stickers — they're casual communication

---

## OUTGOING MEDIA (Nova sends)

### When Nova wants to send screenshot/image

Nova typically does NOT send images — she works with text/code/data.

**Exception cases:**
- Diagrams, charts, visualizations (if generated)
- Screenshots of UI/dashboards (if relevant)

**Format:**
- Use standard Telegram photo send with caption
- Caption should be brief context, not full explanation
- Main content in follow-up text message if needed

---

## ERROR: "error loading media"

This error typically happens when:

**Cause 1: Caption too long**
- Telegram caption limit: 1024 characters
- Solution: Keep captions brief, put detail in separate message

**Cause 2: Markdown parsing in caption**
- Markdown in captions can fail if not properly escaped
- Solution: Use plain text in captions, or minimal markdown

**Cause 3: Media size limit**
- Default: 50MB for photos/videos
- Solution: Already set in config, should not be issue

**Cause 4: Network/API timeout**
- Media upload times out
- Solution: Retry, or send text first then media

---

## BEHAVIOR RULES

### When Will sends image + text:

1. **Read both** — image (visual) + caption (text)
2. **Respond to the actual question/task** — not just "I see an image"
3. **Reference image content if relevant** — "I see line 42 in your screenshot has..."
4. **Don't overthink** — treat it as normal message with visual context

### When Nova responds to media:

- **No special ceremony** — respond naturally
- **Acknowledge visual if relevant** — but focus on the actual request
- **Don't announce media handling** — "I've analyzed the image..." (sounds robotic)
- **Just answer** — as if the image was part of the conversation flow

---

## CAPTION BEST PRACTICES (for Nova, if sending media)

**Good caption:**
> Task A pricing fix — before vs after

**Bad caption:**
> This is a screenshot showing the changes I made to the pricing page in task A where I updated the countdown timer to 30 days from today and also changed the pricing from 2.2M to 2M for the basic tier and 5.3M to 5M for the pro tier and 39M to 25M for the annual tier as requested in the specification that was provided earlier in the conversation which you can see in the attached image here.

**Keep captions <200 chars.** Put detail in text message.

---

## TECHNICAL DETAILS

**OpenClaw media handling:**
- Images are passed to AI model (vision-capable models like Claude Sonnet)
- Caption text is treated as message content
- Nova has access to both visual + text

**Telegram API limits:**
- Photo: 10MB, 10000x10000 px max
- Video: 50MB
- Document: 50MB (2GB for premium)
- Caption: 1024 characters max

**Current config:**
- `mediaMaxMb: 50` (generous limit)
- `markdown.tables: "ascii"` (safe table rendering in captions)

---

## ERROR RECOVERY

If "error loading media" happens:

**For incoming media:**
- Ask sender to resend with shorter caption
- Or ask sender to send text separately from image

**For outgoing media (Nova sending):**
- Fall back to text description instead of image
- Or send image without caption, text in follow-up message

**Never crash or go silent** — always acknowledge and find alternative.

---

_Nova reads this file every session. Updated when media handling logic changes._
