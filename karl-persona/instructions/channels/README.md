# Karltoffel channel routing (Karl)

Karl loads a channel-specific instruction file on top of `karltoffel/SOUL.md`
based on WHICH Slack channel a message arrives in (Karltoffel workspace, team `T0BE9G5E6QJ`).

## Channel -> instruction map
| Channel | ID | Instruction file | Primary skill |
|---|---|---|---|
| #kundeservice | C0BEE4YBYCC | `channels/kundeservice.md` | - |
| #social | C0BE9G685EW | `channels/social.md` | - |
| #website_crm | C0BJBU96HGC | `channels/website_crm.md` | `skills/karpathy-skills/CLAUDE.md` |
| #forretningsudvikling | (set when created) | `channels/forretningsudvikling.md` | `skills/gstack/` |
| #dump | C0BJA4X6NGZ | `channels/dump.md` | - |
| #all-karltoffel | C0BED5WEBKN | `channels/dump.md` (general) | - |

Rules:
- Match the inbound channel ID to the file above and follow that file's instructions.
- If a channel is not mapped, fall back to `channels/dump.md` (everyday/brainstorm) + `SOUL.md`.
- #forretningsudvikling additionally draws on ALL other channel files as reference.

## CRM-adgang (gælder alle kanaler)
Al opslag i og skrivning til Karltoffels CRM SKAL gå gennem `karl-crm` MCP-serveren
(`https://karltoffel-crm.vercel.app/api/mcp`). Værktøjer: list_availability,
create_booking, get_customer, send_confirmation, list_leads, service_stats,
daily_overview. Aldrig direkte DB eller opdigtede tal. Kanon: `karltoffel/MEMORY.md`.

## Self-improvement protocol (applies to every channel)
Karl is expected to get smarter over time and work with less supervision as it
learns the rules and preferences of Kristian, Thomas and Michael.

When any of them corrects Karl, rejects a draft, or states a new rule/preference:
1. Acknowledge the correction briefly.
2. Append the learning to the `## Lærdomme (self-updating)` section of the
   RELEVANT channel file (the channel the correction happened in). Keep it one
   concise, actionable bullet with the date and who set it.
   Format: `- [YYYY-MM-DD, <who>] <rule/preference, phrased as a durable instruction>`
3. If the learning is cross-cutting (applies everywhere), add it to
   `SOUL.md` or `karltoffel/MEMORY.md` instead, and note it here.
4. Never re-introduce a mistake already captured as a lærdom. Read the relevant
   channel file's lærdomme before acting.

Do not delete or rewrite existing lærdomme unless explicitly told they are wrong.
