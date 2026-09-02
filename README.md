# fsg-assets

Portfolio web assets published by **First State Growth LLC**.

## Structure

```
assets/<asset-slug>/index.html   ← one self-contained static asset per folder
```

Every asset is vanilla HTML/CSS/JS in a single file. No build step, no dependencies.

## Deploying an asset (Cloudflare Pages, via CLI)

Two commands per asset. The dashboard Git-connect flow is not used — direct upload from the CLI is faster and scriptable.

```sh
wrangler pages project create <asset-slug> --production-branch=main
wrangler pages deploy assets/<asset-slug> --project-name=<asset-slug> --branch=main --commit-dirty=true
```

Redeploys are just the second command. Custom domain: Pages project → Custom domains → add the `.us` domain (DNS is automatic when the domain sits on the same Cloudflare account).

Note: projects created this way are direct-upload, which cannot later be converted to Git auto-deploy. Deploys are explicit CLI runs, not push-triggered.

## Live assets

| Asset | Folder | Domain | Status |
|---|---|---|---|
| Freelance Rate Calculator | `assets/freelance-rate-calculator` | freelancerate.us (not yet bought) | live at https://freelance-rate-calculator-bl5.pages.dev |
| Certification Partner Intake | `assets/partner-intake` | — (internal, noindex) | live at https://partner-intake-6ry.pages.dev |

## Services

`services/intake-collector` — Cloudflare Worker receiving partner intake submissions into KV.
Deployed at `https://intake-collector.yellow-pond-831d.workers.dev`. Deploy with `wrangler deploy` from that folder.

Read submissions (there is deliberately no HTTP read endpoint — they hold commercial pricing data):

```sh
cd services/intake-collector
wrangler kv key list --namespace-id=f24bdeabd089483d8f99a954dcf82e70 --remote
wrangler kv key get "sub:<id>" --namespace-id=f24bdeabd089483d8f99a954dcf82e70 --remote
```
