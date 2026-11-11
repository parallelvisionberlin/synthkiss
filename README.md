# SYNTHKISS

Independent template-first AI marketplace prototype.

## Published prototype
- Published production source remains the old static prototype; the new workspace implementation is described below.
- 12 creative template concepts, searchable/filterable catalog, template preview dialog.
- Optional JPEG/PNG/WebP preview occurs in the browser only, maximum 10 MB.
- Visuals are abstract CSS placeholders, **not** examples of generated results.
- The public frontend has no generation, user accounts, payment processing, user analytics, or server uploads. The separate Preview check below verifies provider access only.

## Approved minimal workspace: implementation checkpoint

- Implemented on local branch `synthkiss-minimal-workspace`, based on the verified provider-check tree.
- Approved reference: the warm ivory Home mockup with a left menu and kiss wordmark.
- `index.html`: Home, Image, Image to Video, Video to Video, Extend Video; hash navigation and selected state.
- Home intentionally has an empty `#templates` area beneath the Synthkiss wordmark and kiss symbol.
- `assets/kiss.svg`: local scalable kiss mark, also used as favicon; no external asset/font dependencies.
- Compact screens use a collapsible menu with Escape/outside dismissal and inactive hidden links removed from keyboard navigation.
- Secondary views truthfully indicate that generation is not yet available; this change adds no generation calls.
- The original 12-template demo is preserved at `prototype.html`; its hidden-photo preview CSS issue is corrected there.
- Browser verification passed on desktop and at a 454 CSS px narrow viewport: navigation, menu opening, section selection and automatic menu closure; no horizontal overflow observed.
- Internal review URL: `http://127.0.0.1:4173/` via the managed preview. This is not a production deployment.
- Publication to production still requires explicit owner approval. No production, DNS or PV LAB changes were made.
- Save this branch with `[CF-Pages-Skip]` so source review does not trigger a Cloudflare deployment.
- Next action: owner reviews the implemented Home, then explicitly approves production publication if desired.

## Local SpicyAPI pilot

The public demo at source commit `e968408` is static. The owner-run generation pilot is local, without a public generation route or frontend changes. It verifies model access, privately stages one JPEG/PNG/WebP up to 10 MiB with SpicyAPI, quotes the exact request in USD, and submits only on a separate command with an explicit spending ceiling. The result is read using its job ID.

Nine presets cover Wan 3.0 reference-to-video, Seedance 2.5, Seedance 1.5 Pro, Seedance 2.5 Spicy (upscaled 4K), Kling 3.0 video, PV Still, Seedream Flash, Qwen Image 3.0 and Seedream 5 Pro Edit at 1K. The last route has an optional **Night Flash** example recipe. This recipe is not required for connecting Synthkiss. `presets` lists the exact inputs.

PV LAB source reviewed at `67406019479c5d6953ede11fc2d88be19082ed81`. Its SpicyAPI request patterns can be reused with a new key and payer. Its FAL routes for Krea 3 and Kling Image, Google routes for Nano Banana, and Higgsfield routes for Soul and video tools require their own provider integrations and Synthkiss credentials.

Create a capped API key for Synthkiss under a payer separate from PV LAB. A SpicyAPI team separates keys, logs and caps, and charges the team owner's balance. Store the key as `SYNTHKISS_SPICY_API_KEY` in the ignored private `.env.synthkiss.local` file or inject it into the local environment. Keep test media outside the checkout. Run the pilot with Node.js 20.6 or newer.

```sh
node --test tests/spicy-pilot.test.mjs
node scripts/spicy-pilot.mjs presets
node --env-file=.env.synthkiss.local scripts/spicy-pilot.mjs models
node --env-file=.env.synthkiss.local scripts/spicy-pilot.mjs quote night-flash /path/to/test-portrait.jpg
node --env-file=.env.synthkiss.local scripts/spicy-pilot.mjs submit <plan-id> <approved-max-usd>
node --env-file=.env.synthkiss.local scripts/spicy-pilot.mjs status <job-id>
```

`quote` sends the test photo to SpicyAPI without starting a generation. Confirm its quoted amount before `submit`, which can incur a charge. After an uncertain submission, check the provider Logs before starting a new job. The saved plan binds the exact request, key and idempotency ID.

Verified on 2026-11-10. All nine pilot routes and their input fields matched the public SpicyAPI catalog. Six provider contract tests and a CLI quote, submit and status run passed with simulated responses. Paid verification requires a provider quote and a deliberately approved test job.

## Current project checkpoint: 2026-11-11

- Goal: connect Synthkiss's own provider account, then build real template generation.
- Cloudflare Pages project `synthkiss` is already connected to `parallelvisionberlin/synthkiss`.
- Production branch is `main`; automatic deployments are enabled.
- Production remains at `e9684081008d7c33c46fb66f86ce4dd42edacbf5`.
- The owner explicitly approved publishing the read-only connection check to Preview.
- Verified deployed code: `c3d62ac572404d1568fe67310641826d6ff1ef6a` on `synthkiss-provider-check`.
- Cloudflare deployment: `cce6d2d2-e6ed-4bd7-b6f1-c84e9fa11a8c`; GitHub Cloudflare Pages check succeeded.
- Immutable Preview: <https://cce6d2d2.synthkiss.pages.dev>.
- Working check: <https://synthkiss-provider-check.synthkiss.pages.dev/api/provider-connection>.
- At `2026-11-11T00:53:00.875Z`, the live check returned `connected: true`.
- All nine presets returned `enabled: true` and `available: true`; the browser independently displayed the successful report.
- This confirms authenticated catalog access, not successful image/video generation.
- The owner saved the dedicated `SYNTHKISS_SPICY_API_KEY` secret in Pages **Preview**; its value was never read or committed.
- `functions/api/provider-connection.js` exposes only this read-only GET route, guarded to the exact branch alias.
- `_routes.json` limits function invocation to `/api/provider-connection`.
- Public responses contain connection status and selected model availability only, with a 60-second key-scoped cache and sanitized errors.
- Photos, quotes and paid submissions remain confined to the local pilot; no paid generation was performed.
- Cloudflare runtime fixes: use manual redirects and bind native fetch to the global receiver.
- `X-Synthkiss-Connection-Version: 3` confirms the corrected function is serving the report.
- Validation: all 12 tests passed using `node --test tests/*.test.mjs`; `git diff --check` passed.
- Desktop browser: filters returned three Cinematic looks, search narrowed to Lost Tape, and the template dialog opened.
- Responsive browser check: at 454 CSS px the grid used two columns without horizontal overflow; the stacked dialog remained scrollable.
- Physical mobile/touch behavior and photo selection were not verified in this pass.
- The original hidden preview CSS issue is corrected in the preserved `prototype.html` on the workspace implementation branch.
- The deployed frontend is still the original demo; the new workspace exists only on its review branch until approved.
- No production, domain, DNS, PV LAB credentials, resources or customer data were modified.
- Next: implement the template generation flow in a separate Preview, with private server credentials, access controls, cost confirmation and job recovery before exposing paid generation.
- Publishing or modifying production/domain/DNS requires the owner's explicit approval; a paid job requires an approved quote and spending ceiling.

## Source architecture
PV LAB was inspected for conceptual reuse only:
- Existing site: `parallelvisionberlin/parallelvisionberlin.github.io/lab/`
- Existing Worker: `lab-worker/worker.mjs`
- Existing billing logic: `lab-worker/customer-billing.mjs`
- Existing Cloudflare bindings: D1 and R2 in `lab-worker/wrangler.toml`

Do not copy PV LAB production credentials, database IDs, media buckets, billing customer records, or existing authentication into this project. Synthkiss needs separate backend resources and customer records. Review PV LAB payment and recovery edge cases before reusing implementation patterns.

## Existing Cloudflare Pages deployment

Continue using the existing `synthkiss` Pages project and repository connection. The project is buildless: framework None, build command empty, output directory `/` (repository root). The dashboard lists both `synthkiss.com` and `synthkiss.pages.dev`; the custom domain served the original static HTML successfully.

Use an isolated Preview branch for development. Pushing or merging into `main` automatically updates production and therefore requires the owner's explicit approval. Do not recreate the project or change domains, DNS or `pvlab.studio` routing/bindings.

## Before customer launch
- Replace placeholder visuals with approved, licensed template outputs.
- Build standalone Worker, D1, private R2 and auth.
- Add explicit generation confirmation, cost controls, paid generation reconciliation, and server-side safety checks.
- Configure independent Stripe checkout and signed/idempotent webhooks.
- Add privacy, terms, deletion, identity protections, and provider policy review.
- Test actual mobile flows, purchase return, failed generation, duplicate events and refunds.

## Security
The repository was created as **public**. Never commit keys, API tokens, customer data, or private PV LAB information.
