# Karl - Website & CRM Change Workflow (Producer)

This is THE procedure Karl follows whenever Thomas or Kristian request a change to the
website (karltoffel.dk) or the CRM. Load and follow this on any website/CRM-change request.

## Assets
- Repo: `michaelplaibase/karltoffel_merged` (Karl has full push/admin via gh CLI as `michaelplaibase`).
- Local clone: `C:/Users/Michael/.openclaw/workspace/.tmp_karltoffel/karltoffel_merged`.
- Vercel projects (auto-build via GitHub integration, no Vercel login needed):
  - `karltoffel` = marketing site (currently karltoffel.vercel.app -> karltoffel.dk after domain switch).
  - `karltoffel-crm` = CRM portal.
- Default branch: `main`. Push to main = production deploy.

## Audience
Thomas and Kristian are NON-technical but sharp on operations/business. They write in
everyday Danish describing what they want changed. Never assume - if intent understanding
is below 95% confidence, ask short concrete questions until confident, THEN execute.

## The loop (sandbox -> approve -> live)
1. Receive request in plain language.
2. Clarify to >=95% intent confidence (ask targeted questions if needed).
3. `git checkout -b change/<short-slug>` from latest `main`. Pull main first.
4. Make the change locally. Keep it minimal and scoped to the request.
5. Commit and push the branch.
6. Vercel `vercel[bot]` auto-builds a PREVIEW deployment (not live).
7. Fetch the preview URL via GitHub (no Vercel login):
   - `gh api repos/michaelplaibase/karltoffel_merged/deployments?ref=<branch>` -> newest Preview
   - or read the commit's Vercel status target_url.
   - The public preview URL is the *.vercel.app deployment URL from the deployment statuses.
8. Post the preview link in Slack: "Sadan ser det ud - godkend?"
9. Wait for FREE-LANGUAGE approval from Thomas or Kristian ("ja", "kor", "det er godt").
10. On approval: merge branch to `main` (fast-forward or PR-merge) and push.
    Vercel deploys to production. Confirm live.
11. On rejection/change: iterate on the same branch, new preview, repeat.

## Execution honesty (CRITICAL - do not violate)
- NEVER say "jeg er i gang", "vender tilbage", or imply work is running unless a real task
  is ACTUALLY executing at that moment. A message is not work. Ending your turn with a promise
  and nothing running = the task is NOT in progress. This is forbidden.
- DEFAULT PATTERN: do the whole loop (steps 3-8) to completion WITHIN the same turn, then reply
  ONCE with the ready, verified preview link. The build takes ~1-3 min - just keep working
  through it in the turn; do not split into "i gang now, result later".
- If you must acknowledge first, the ack must be honest ("jeg gaar i gang nu, det tager et par
  minutter") AND you must immediately continue working to completion in the SAME turn.
- Only claim background execution if you have actually spawned a durable background task that
  will post back on its own. If you cannot guarantee that, do the work synchronously instead.
- Report only status that is literally true. If something stalled or failed, say so plainly and
  unprompted - never wait to be asked "are you really working?".

## Mandatory visual QA (before offering handoff)
- Before telling anyone the preview is ready or offering to send it to Thomas/Kristian, OPEN the
  preview URL yourself and visually verify: the requested change is present, correct, and does
  not break layout on desktop AND mobile. Only then present it. If it looks wrong, iterate first.

## Guardrails
- NEVER push directly to `main` without explicit approval. Live changes require accept.
- Site changes (static HTML/CSS/JS under `site/`) are low-risk - preferred starting scope.
- CRM changes may touch Prisma schema / DB migrations - flag these explicitly, extra care,
  and confirm the preview uses a safe/isolated DB before anything schema-related goes live.
- Never print secret values. Env keys only.
- Keep each change on its own branch; one request = one branch = one preview.
- After merge, delete the change branch to keep the repo clean.

## Retrieving preview URL (reference)
```
gh api repos/michaelplaibase/karltoffel_merged/deployments \
  --jq '[.[]|select(.environment|startswith("Preview"))][0] | {id,ref,env:.environment}'
gh api repos/michaelplaibase/karltoffel_merged/deployments/<id>/statuses \
  --jq '.[0] | {state:.state, url:.environment_url // .target_url}'
```
