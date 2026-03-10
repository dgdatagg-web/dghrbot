# Security Notes

## What Guardian accesses

- **Reads:** Workspace files, conversation logs, definition files (JSON)
- **Writes:** `guardian.db` (SQLite) for scan results and threat history
- **Shell:** `admin.py update-defs` and `onboard.py --setup-crons` invoke subprocesses (crontab setup, signature updates). Explicit operator actions.
- **Network (optional):**
  - `integrations/webhook.py` can POST scan results to a configured URL
  - `scripts/serve.py` runs an HTTP API server if you start it
  - Both are disabled unless you configure/start them. Documented in SKILL.md.
- **Base64:** Definition files may be base64-encoded; decoded at load time to extract signature patterns.

## Permissions

| Permission | Used by | Purpose |
|---|---|---|
| `read_workspace` | `core/scanner.py` | Read files to scan for threats |
| `write_workspace` | `core/guardian_db.py` | Write scan results to SQLite |
| `shell_optional` | `scripts/onboard.py` | Optional cron setup via subprocess/crontab |

## No credentials required

Guardian does not need API keys, tokens, or external service credentials. All scanning is local regex matching against bundled signature definitions. Optional network features are opt-in and documented.


## Outbound caution
If you enable webhook notifications, payloads may include matched evidence snippets. Review sanitization and endpoint handling before enabling in sensitive environments.
