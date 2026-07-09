# Karltoffel — combined repo

This repository holds **both** Karltoffel apps. They are consolidated here so there is a
single place to work, but they remain **two independent Vercel deployments** on two domains.

```
/            → Karltoffel Portal — the CRM (Next.js 16, App Router, Prisma/Neon Postgres)
  app/  lib/  prisma/  components/  middleware.ts  next.config.ts  vercel.json (nightly cron)
site/        → karltoffel.dk — the static marketing site (buildless HTML/CSS/JS + one function)
  index.html  assets/  p/  c/  api/lead.js  vercel.json (redirects)
```

## The two apps

### CRM (repo root)
Internal CRM + field-scheduling app. Next.js 16.2.10, React 19, Prisma 6 on Neon Postgres,
Tailwind v4. Read `AGENTS.md` before writing code — this Next.js version has breaking changes
vs. older releases.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build
```

Deploy: Vercel project with **Root Directory = repo root**. `vercel-build` runs
`prisma generate` → prod migrations → `next build`. A nightly cron hits `/api/plan` (see
root `vercel.json`).

### Marketing site (`site/`)
A pixel-perfect static mirror of karltoffel.dk plus the custom **tilbudsmotor** (quote
engine). No framework, no build step — plain files served from the folder root, plus one
zero-config Vercel function at `site/api/lead.js`. All asset paths are **root-relative**, so
it must serve from the root of its own domain.

```bash
cd site
python3 -m http.server 8099   # http://localhost:8099
# (use `vercel dev` if you need the /api/lead function locally)
```

Deploy: a **separate** Vercel project with **Root Directory = `site`**, framework preset
"Other" (no build). It reads `site/vercel.json` and deploys `site/api/lead.js` as `/api/lead`.

## How the two connect

The site's quote engine POSTs a lead to its own `/api/lead`, which relays it (with a shared
secret) to the CRM's `/api/leads` webhook. This stays **cross-origin** between the two
deployments — set `LEAD_WEBHOOK_SECRET` to the same value on both Vercel projects.

## Notes

- The CRM build ignores `site/` — it is excluded from `tsconfig.json` and from
  `eslint.config.mjs`, so `npm run lint` / `next build` never scan the static site.
- The marketing site's git history was preserved when it was merged in under `site/`.
