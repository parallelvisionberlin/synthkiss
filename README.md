# SYNTHKISS

Independent template-first AI marketplace prototype.

## Published prototype
- Static frontend in `index.html` (zero-build, no third-party dependencies).
- 12 creative template concepts, searchable/filterable catalog, template preview dialog.
- Optional JPEG/PNG/WebP preview occurs in the browser only, maximum 10 MB.
- Visuals are abstract CSS placeholders, **not** examples of generated results.
- **No** AI provider integration, user accounts, payment processing, user analytics, or file uploads to any server.

## Local SpicyAPI pilot

The public demo at source commit `e968408` is static. This owner-run pilot is local, with no public API route or frontend changes. It verifies model access, privately stages one JPEG/PNG/WebP up to 10 MiB with SpicyAPI, quotes the exact request in USD, and submits only on a separate command with an explicit spending ceiling. The result is read using its job ID.

The first preset is **Night Flash** on Seedream 5 Pro Edit at 1K. Use a test portrait you have permission to process and compare the original and result for face, pose and framing. The recipe asks for direct flash, deep blacks and 35mm grain. `presets` lists the other routes, including Wan 3.0 reference-to-video, Seedance 2.5, Seedance 1.5 Pro, Seedance 2.5 Spicy (upscaled 4K), Kling 3.0 video, PV Still, Seedream Flash and Qwen Image 3.0.

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

## Preview connection check

On 2026-11-11 the owner confirmed saving `SYNTHKISS_SPICY_API_KEY` as an encrypted secret in the Synthkiss Pages Preview environment. Its presence and validity remain to be verified by the deployed runtime.

The first backend check uses Synthkiss's own Pages Functions. Its sole route is `GET /api/provider-connection`, restricted in code to the `synthkiss-provider-check.synthkiss.pages.dev` branch alias. It reads the authenticated SpicyAPI model catalog and returns connection status and availability flags for the nine pilot presets. It briefly caches those flags and sanitized errors for 60 seconds, scoped to the current key.

The Preview URL will be publicly accessible. Its response contains only connection status and the selected models' availability. The API key remains in the runtime secret. Uploading photos, quoting and paid generation remain in the local pilot.

Local checks cover production-host rejection, write-method rejection, missing or invalid secrets, sanitized provider errors, caching and key rotation. Run `node --test tests/*.test.mjs`.

The connection check is prepared in a local branch. Publishing that branch and consulting the deployed check require the owner's explicit approval under the standing publication instruction. After approval, inspect the exact Cloudflare Pages deployment and call the branch alias once. Report actual provider eligibility and regional errors separately from local simulation.

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
