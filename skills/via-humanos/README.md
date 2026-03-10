# VIA Humanos — Human Approval for AI Agent Actions

An [OpenClaw](https://openclaw.ai) skill that gives AI agents the ability to request, verify, and enforce human authorization before performing sensitive operations.

When an agent needs to make a payment, sign a document, access personal data, or execute any high-stakes action, this skill sends a secure approval request to the right person. They review, approve or reject, and the result comes back as a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model/) with cryptographic proof.

## Install

```bash
clawhub install via-humanos
```

Or install locally:

```bash
git clone https://github.com/Humanos-App/via-humanos.git
ln -s $(pwd)/via-humanos ~/.openclaw/skills/via-humanos
```

## Configure

1. Get an API key from [app.humanos.id](https://app.humanos.id)
2. Add credentials to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "via-humanos": {
        "enabled": true,
        "env": {
          "VIA_API_KEY": "your-api-key",
          "VIA_SIGNATURE_SECRET": "your-signing-secret"
        }
      }
    }
  }
}
```

3. Verify the skill loads:

```bash
openclaw skills list --eligible
```

## Usage

Talk to your OpenClaw agent naturally:

```
"I need approval from john@company.com to book a hotel for EUR 450"
"Send this NDA to partner@example.com for signing"
"Check if the approval request has been signed"
"Get consent from user@example.com for data processing"
"Cancel the pending approval request"
```

## First-run payload rules

To avoid generic `400 Bad Request` errors on create:

- Use `consent`, `json`, or `document` in `--type` (inline `form` is not supported).
- For `consent`, include a `text` field in `data`.
- For `document`, include a `pdf` field in `data` with base64 content.
- Keep `data` as an array of fields (`[{label,type,value,hidden}]`).

Example (`consent`):

```bash
./scripts/create-request.sh \
  --contact "+351919307983" \
  --type "consent" \
  --name "Football approval" \
  --data '[{"label":"text","type":"string","value":"I approve football tomorrow.","hidden":false}]'
```

## What It Does

| Operation | Description |
|-----------|-------------|
| **Create request** | Send approval request with OTP to a contact |
| **Check status** | Poll for PENDING / APPROVED / REJECTED |
| **Find requests** | Search by contact, DID, or internal ID |
| **Get credential** | Retrieve signed W3C Verifiable Credential with proofs |
| **Get mandate** | Check mandate scope, validity, and constraints |
| **Resolve DID** | Look up DID Document with verification methods |
| **Cancel request** | Revoke a pending approval |
| **Resend OTP** | Re-send verification code |

## Credential Types

| Type | What the person sees |
|------|---------------------|
| `document` | PDF to review and sign with drawn signature |
| `form` | Dynamic form with fields to fill |
| `json` | Structured data to approve or reject |
| `consent` | Terms to read and accept |

## Security Levels

| Level | When to use |
|-------|------------|
| `CONTACT` | Low-risk: OTP verification only |
| `ORGANIZATION_KYC` | Medium-risk: organization-level identity check |
| `HUMANOS_KYC` | High-risk: full KYC with identity verification |

## How It Works

```
Agent needs approval
    |
    v
Create request ──> Person receives secure link
                        |
                        v
                   Enter OTP, review details
                        |
                   ┌────┴────┐
                   v         v
              APPROVED   REJECTED
                   |         |
                   v         v
           Agent proceeds   Agent stops
           with proof       and informs user
```

## Optional: Mandate Guard Hook

For automatic enforcement, install the included hook that intercepts tool calls and blocks unauthorized actions:

```bash
cp -r hooks/via-humanos-guard/ ~/.openclaw/hooks/via-humanos-guard
openclaw hooks enable via-humanos-guard
```

This listens for `tool.pre` events and blocks sensitive operations (payments, transfers, signing) unless a valid mandate exists.

## Security

- All requests signed with HMAC-SHA256
- API keys stored in environment variables only
- No local data storage
- W3C Verifiable Credentials with EdDSA proofs
- OTP verification for all approval flows

## Requirements

- [OpenClaw](https://openclaw.ai) installed
- `curl`, `jq`, and `openssl` on PATH
- VIA Protocol API key from [app.humanos.id](https://app.humanos.id)
- Optional: `VIA_API_URL` only if you need a non-default API base URL

## License

MIT
