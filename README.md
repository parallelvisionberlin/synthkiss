# SYNTHKISS

Independent template-first AI marketplace prototype.

## Current project checkpoint: 2026-11-11
- Owner approved publishing the minimal workspace to synthkiss.com.
- Production candidate: `index.html`, `assets/kiss.svg`, `prototype.html` and this README.
- Approved design: warm ivory background, left menu, kiss symbol and centered SYNTHKISS wordmark.
- Five sections: Home, Image, Image to Video, Video to Video, Extend Video.
- Home has an intentionally empty template area for the owner's upcoming templates.
- Hash navigation and mobile collapsible menu are implemented.
- Local browser verification passed on desktop and at 454 CSS px: section navigation, menu open/close, selected state, no horizontal overflow.
- Generation sections state that generation is not available yet.
- Original searchable 12-template demo is preserved at `prototype.html`; visuals are CSS placeholders.
- No accounts, payments, analytics or server uploads are enabled.
- Separate provider-check Preview has verified catalog access for nine SpicyAPI routes. This does not enable generation on production.
- Provider code and Preview secrets remain outside this production release.
- Deployment: approval received; publication and live verification in progress.
- PV LAB credentials, resources and customer data are not used.
- Next: populate approved templates and build the real generation flow in a separate Preview.
- Before further production/domain/DNS changes obtain explicit owner approval. Paid jobs require an approved quote and spending ceiling.

## Source architecture
PV LAB was inspected for conceptual reuse only:
- Existing site: `parallelvisionberlin/parallelvisionberlin.github.io/lab/`
- Existing Worker: `lab-worker/worker.mjs`
- Existing billing logic: `lab-worker/customer-billing.mjs`
- Existing Cloudflare bindings: D1 and R2 in `lab-worker/wrangler.toml`

Do not copy PV LAB production credentials, database IDs, media buckets, billing customer records, or existing authentication into this project. Synthkiss needs separate backend resources and customer records. Review PV LAB payment and recovery edge cases before reusing implementation patterns.

## Existing Cloudflare Pages deployment
Continue using the existing `synthkiss` Pages project connected to `parallelvisionberlin/synthkiss`.
Production branch: `main`. Automatic deployment is enabled.
Build framework: None; build command: empty; output directory: `/`.
Live URLs: https://synthkiss.com and https://synthkiss.pages.dev.
Do not recreate the project or modify PV LAB routing/bindings.

## Before customer launch
- Replace placeholder visuals with approved, licensed template outputs.
- Build standalone Worker, D1, private R2 and auth.
- Add explicit generation confirmation, cost controls, paid generation reconciliation, and server-side safety checks.
- Configure independent Stripe checkout and signed/idempotent webhooks.
- Add privacy, terms, deletion, identity protections, and provider policy review.
- Test actual mobile flows, purchase return, failed generation, duplicate events and refunds.

## Security
The repository was created as **public**. Never commit keys, API tokens, customer data, or private PV LAB information.