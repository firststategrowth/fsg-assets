# fsg-assets

Portfolio web assets published by **First State Growth LLC**.

## Structure

```
assets/<asset-slug>/index.html   ← one self-contained static asset per folder
```

Every asset is vanilla HTML/CSS/JS in a single file. No build step, no dependencies.

## Deploying an asset (Cloudflare Pages)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Project name: the asset slug (e.g. `freelance-rate-calculator`).
3. Build command: **leave empty**. Build output directory: `assets/<asset-slug>`.
4. Save and Deploy → live at `<project>.pages.dev` in ~30s.
5. Custom domain: Pages project → Custom domains → add the `.us` domain (DNS is automatic when the domain is on the same Cloudflare account).

One Pages project per asset, all pointing at the same repo with a different output directory.

## Live assets

| Asset | Folder | Domain | Status |
|---|---|---|---|
| Freelance Rate Calculator | `assets/freelance-rate-calculator` | freelancerate.us | pending domain |
