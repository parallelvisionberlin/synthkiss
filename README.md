# SYNTHKISS

Independent template-first AI marketplace prototype.

## Current status
- Static frontend in `index.html` (zero-build, no third-party dependencies).
- 12 creative template concepts, searchable/filterable catalog, template preview dialog.
- Optional JPEG/PNG/WebP preview occurs in the browser only, maximum 10 MB.
- Visuals are abstract CSS placeholders, **not** examples of generated results.
- **No** AI provider integration, user accounts, payment processing, user analytics, or file uploads to any server.

## Source architecture
PV LAB was inspected for conceptual reuse only:
- Existing site: `parallelvisionberlin/parallelvisionberlin.github.io/lab/`
- Existing Worker: `lab-worker/worker.mjs`
- Existing billing logic: `lab-worker/customer-billing.mjs`
- Existing Cloudflare bindings: D1 and R2 in `lab-worker/wrangler.toml`

Do not copy PV LAB production credentials, database IDs, media buckets, billing customer records, or existing authentication into this project. Synthkiss needs separate backend resources and customer records. Review PV LAB payment and recovery edge cases before reusing implementation patterns.

## Deploy to Cloudflare Pages
1. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git.
2. Select `parallelvisionberlin/synthkiss` (grant GitHub app repository permission if needed).
3. Create a **new** Pages project called `synthkiss`.
4. Build framework: None; build command: empty; output directory: `/` (repository root).
5. Validate the new `*.pages.dev` preview on desktop and mobile.
6. After validation, attach `synthkiss.com` under that project's Custom domains and follow Cloudflare's DNS directions. Do not modify `pvlab.studio` routing or bindings.

## Before customer launch
- Replace placeholder visuals with approved, licensed template outputs.
- Build standalone Worker, D1, private R2 and auth.
- Add explicit generation confirmation, cost controls, paid generation reconciliation, and server-side safety checks.
- Configure independent Stripe checkout and signed/idempotent webhooks.
- Add privacy, terms, deletion, identity protections, and provider policy review.
- Test actual mobile flows, purchase return, failed generation, duplicate events and refunds.

## Security
The repository was created as **public**. Never commit keys, API tokens, customer data, or private PV LAB information.