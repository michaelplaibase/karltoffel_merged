# Karl -> Mac Mini: SETUP (full duplication instruction)

Goal: make the Mac Mini run Karl exactly like the Win node does, then move the Slack
bot tokens so only ONE node is live. No hub/pairing needed - Karl is just a Slack
account + MCP servers inside OpenClaw's `openclaw.json`.

This zip is self-contained. All paths below are on the MAC.
Assume OpenClaw workspace on Mac = `~/.openclaw/workspace` (adjust if different).

---

## 0. Security note
This zip contains live secrets in cleartext: Slack bot/app tokens (`config/`),
Gmail service-account key and the Karltoffel credential vault (`secrets/`).
Delete the zip after import. If you want to be strict, rotate the Slack app tokens
and KARL_MCP_TOKEN after cutover.

---

## 1. Drop the workspace files (Mac)
Copy into the Mac's OpenClaw workspace, creating `karltoffel/` if missing:

    ~/.openclaw/workspace/karltoffel/
      SOUL.md  MEMORY.md  DISCOVERY.md  WEBSITE_WORKFLOW.md  BRAND_MANUAL.md   <- from instructions/
      channels/*.md                                                            <- from instructions/channels/
      karl_cs/PLAYBOOK.md + *.py + queue.json + state.json                     <- from instructions/karl_cs + karl_cs/
      skills/karpathy-skills/  skills/gstack/                                  <- from skills/
      CREDENTIALS.md                                                           <- from secrets/
      secrets/karl-gmail-sa.json                                              <- from secrets/

Then add the Karltoffel routing block to `~/.openclaw/workspace/AGENTS.md`
(see `agents-snippet.md` in this zip - paste it in verbatim).

## 2. Merge config into Mac's openclaw.json
Open `~/.openclaw/openclaw.json` on the Mac. From `config/karl-config-blocks.json`:

a) Slack account "karl" -> add under `channels.slack.accounts`:
       "karl": { ...slack_account_karl block... }
   IMPORTANT: keep it here but the SAME app cannot run live on two nodes at once.
   Until cutover (step 5) either leave the Win node as the live one, or set this
   account disabled on whichever node is not cutting over.

b) MCP server "karl-crm" -> add under `mcp.servers`:
       "karl-crm": { ...mcp_karl_crm block, incl. Authorization: Bearer KARL_MCP_TOKEN... }
   This token is node-independent (it authenticates to the Vercel CRM), so it works
   from the Mac as-is.

c) MCP server "canva" -> add under `mcp.servers`:
       "canva": { ...mcp_canva block... }
   NOTE: the canva OAuth token is machine-bound and will NOT work copied. After the
   gateway is up on Mac, re-auth: sign the managed browser into hej@karltoffel.dk,
   run `openclaw mcp login canva`, approve, capture the code. (Michael present; may
   need the 6-digit email code via the Gmail service account.)

## 3. Start gateway + verify MCP (Mac)
- Load the OpenClaw LaunchAgent so the gateway runs (port 18795).
- `openclaw status` -> reachable.
- After config merge, reload gateway. Probe `karl-crm` -> expect 7 tools
  (list_availability, create_booking, get_customer, send_confirmation, list_leads,
  service_stats, daily_overview).

## 4. Customer-service poll scheduler (Mac)
Win runs `karl_cs` every 5 min via a Windows Task. On Mac, replace with launchd:
- Test once first: `cd ~/.openclaw/workspace/karltoffel/karl_cs && python3.13 poll.py`
  (expect `count == 0` or real candidates; no crash). Install deps if needed
  (requests, google-auth, google-auth-oauthlib, google-api-python-client).
- Create `~/Library/LaunchAgents/dk.karltoffel.karlcs.plist` running poll every 300s,
  writing to a log. Load it but keep it effectively idle until cutover if you want to
  avoid double-processing (Win's task is still enabled until step 5).

## 5. CUTOVER (only one node live)
When Mac is verified:
1. On WIN: remove/disable the `karl` Slack account in `~/.openclaw/openclaw.json`
   (delete the botToken/appToken there) and reload gateway. Disable the Windows task
   `\KarltoffelKarlCS`.
2. On MAC: ensure `karl` account is enabled + gateway reloaded; enable the launchd poll.
3. Test: post in Karltoffel #dump/#all-karltoffel -> confirm ONLY the Mac replies as Karl.
4. Keep Win's files as warm rollback until Mac is proven stable, then delete secrets.

## 6. What stays untouched (cloud)
The CRM + KARL_MCP_TOKEN live in Vercel/Neon - node-independent, nothing to move.
Canva/Higgsfield/Gmail are cloud accounts. Only the local OpenClaw wiring moves.

---

## Quick checklist
[ ] workspace/karltoffel files copied (incl. secrets/, CREDENTIALS.md)
[ ] AGENTS.md routing block pasted
[ ] openclaw.json: karl account + karl-crm + canva blocks merged
[ ] gateway up on Mac (18795), status reachable
[ ] karl-crm probe = 7 tools
[ ] canva re-auth done (with Michael)
[ ] karl_cs poll tested on python3.13 + launchd created
[ ] CUTOVER: tokens removed on Win, live on Mac, single-node reply verified
[ ] Win kept as rollback; secrets deleted after stable
