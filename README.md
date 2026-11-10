# Moonrock

A standalone home café website and two-sided menu. No services, backend, analytics, accounts, or hosting are required. Original JPEG references remain untouched in this folder.

## Open

Open `index.html` directly in a browser, or serve this folder:

```sh
cd /Users/pushp/Documents/Projects/moonrock
python3 -m http.server 4173 --bind 127.0.0.1
```

Visit http://127.0.0.1:4173. The arrival plays once per browser session. Use “Replay the arrival” to see it again. Skip and Escape go straight to the menu. Reduced-motion visitors get the static hero. Sound is off because there is no audio. A failed script leaves the complete menu available.

## Print

`output/pdf/moonrock-menu.pdf` is the finished two-page US Letter menu. Print at **Actual size / 100%**, portrait, double-sided, **flip on long edge**. Front: mains and desserts. Back: drinks. For printing from `print/menu.html`, enable background graphics and disable browser headers/footers. Content stays at least 0.55 inches inside the sheet; background is decorative and does not require borderless printing. Cream stock works well with background graphics turned off in the HTML version.

## Edit the menu

1. Edit `src/menu.json`. Each item is `[English, Chinese]`, with optional English and Chinese choices as the next two fields. Keep HTML out of the content.
2. Run `node scripts/build.mjs`. It regenerates `index.html` and `print/menu.html`; do not edit those generated pages directly.
3. When adding new characters, regenerate font subsets with `python3 scripts/subset-fonts.py` (requires `fonttools` and `brotli`). Full original open-source font files and licenses are included.
4. Regenerate the PDF: install Playwright locally (`npm install --no-save playwright`, then `npx playwright install chromium`) and run `node scripts/render-pdf.mjs`.
5. Run `node scripts/verify.mjs`, then inspect the resulting screenshots and PDF. The scripts accept optional `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` environment variables for an existing installation.

Website styling is in `style.css`, animation behavior in `app.js`, and print styling in `print/menu.css`. The build script contains the page templates. The live menu is static HTML: no fetching JSON or waiting for JavaScript to show food.

## Package

- `BRAND.md`: palette, typography, usage, and artwork prompt.
- `assets/wordmark.svg`: outlined wordmark, usable without fonts.
- `assets/emblem.svg`: simple lunar/orbit emblem.
- `assets/moonrock-source.png`: original generated transparent artwork.
- `assets/moonrock.webp`: optimized transparent web/print artwork.
- `assets/fonts/`: original fonts, subsets, and OFL licenses.
- `qa/`: responsive screenshots, rendered PDF pages, and verification results.

- `assets/qr.svg`: vector QR code bringing guests to https://cafe.peji.ca for table ordering.

Table ordering QR code directs guests to `https://cafe.peji.ca` on page 2 (Drinks) of the printed menus. When deploying, publish the static pages, CSS, JS, optimized assets, print files, and PDF. Original references, source fonts, QA outputs, and scripts need not be served publicly.

## Guest orders and host kitchen

Guests can add items, choose drink variants, review quantities, and provide only their name when sending an order. Orders are stored in Cloudflare D1. The kitchen at https://cafe.peji.ca/back shows individual orders and a group tally, refreshing every five seconds.

The host passcode is in `.host-access.txt` (private, ignored by Git, never copied into deployment). The server secret is `HOST_PASSCODE`. Local development reads `.dev.vars`. To rotate the production passcode, run `npx wrangler secret put HOST_PASSCODE`; existing host sessions become invalid.

In the kitchen, delete one order or delete all current orders. Menus supports creating templates, copying and editing them, archiving/restoring saved menus, and starting a new gathering with a saved menu. The current menu cannot be archived until another is selected. Starting a new gathering gives guests an empty order round; stale carts cannot submit into it. The original printed PDF is offered only for the original menu, so custom menus do not download an outdated PDF.

Deploy: `node scripts/prepare-deploy.mjs`, `npx wrangler d1 migrations apply DB --remote`, then `npx wrangler deploy`.

Local backend preview: `node scripts/prepare-deploy.mjs`, `npx wrangler d1 migrations apply DB --local`, `npx wrangler dev --ip 127.0.0.1 --port 4190`. Open http://127.0.0.1:4190 and /back. The simple static preview on port 4187 does not support order APIs. Browser integration tests are in `scripts/verify-orders.cjs`, using the local database only.

### Ordering transitions

Item buttons show a brief added confirmation and a persistent selected quantity. Review order opens one fixed-size dialog that progresses through review, name, sending, and a receipt; Done dismisses the receipt. Failed submissions retain the name, cart, and retry identifier.

The kitchen updates only changed cards during polling. Saved-menu activation uses an in-page gathering dialog with a success state and View orders.

Browser regression checks: `node scripts/verify-ux.cjs` uses mocked APIs (including all writes); set `CAFE_URL=https://cafe.peji.ca` to check the deployed interface safely. `scripts/verify-orders.cjs` exercises real API operations against the local Wrangler preview on port 4191 only.

### Updating the current café menu

Edit `src/catalog.json` (retain existing item and choice IDs), then run `node scripts/build-storybook.mjs`. It derives `src/menu.json`, the Storybook page, and its editable print layout from the catalog. Run `scripts/subset-fonts.py` with fontTools installed when adding Chinese characters, then `node scripts/render-pdf.mjs` with Playwright configured to regenerate the Storybook PDF. The `--lunar` flag renders the older lunar variant instead.

The live ordering catalog is in D1; apply a guarded menu-data migration to update it without starting a new order round. Migration 0002 adds appetizers and tea to the original menu and leaves existing orders untouched. Use `node scripts/verify-menu-design.cjs` against the local preview on port 4191 for responsive and print checks; `CAFE_URL=https://cafe.peji.ca` checks live page design without submitting orders.

### Café audio

The record control is generated by `scripts/build-storybook.mjs` and managed by `cafe-music.js`. Music starts only after a guest presses play, uses a gentle initial volume, and reports loading or a retryable failure. Media events keep the control synchronized with playback. `assets/order-ping.mp3` plays only after an order is accepted; the receipt remains the confirmation if browser audio playback is unavailable. The mobile music position clears the cart and confirmation toast, and print hides the control.

`node scripts/verify-media-ux.cjs` checks responsive media UX locally; set `CAFE_URL=https://cafe.peji.ca` to check live without submitting orders.

### Invitations

Unlock the back office at `/back` and choose **Invite friends** beside the section
tabs to prepare an email invitation or share the café link. Add up to 20 email
addresses, separated by commas, semicolons,
spaces, or new lines, and an optional personal note. **Open email app** creates a draft
with recipients in BCC; review and send it in your email app. Moonrock does not store
the addresses or send email itself.

**Copy link** shares `https://cafe.peji.ca/#home`. **Share…** uses the device share sheet
when supported and includes the personal note. Anyone with the link can view the café;
it does not create an account or grant kitchen access.

The invite editor in `invites.js` loads only in `back.html`. The guest welcome uses `invite-welcome.js` and shares `invites.css`.
The dialog closes and clears its fields when the kitchen is locked or its session
expires. Guests do not see invitation controls on the public home page.
`scripts/prepare-deploy.mjs` packages both files. After preparing the site, serve
`.cloudflare-dist` on port 4193 and run
`node scripts/verify-invites.cjs` for mocked desktop, tablet, and mobile browser checks.
The verification never sends email or writes orders. Set `CAFE_URL` to use another
preview URL.

Personalized invitations support a title, message, gathering date/time, and guest preview. Generated links display a welcome on the public home page; the invitation details travel in the link, so anyone receiving it can read them. Date/time includes the host’s time zone. Existing generic café links continue to work.

History includes **Delete event** for completed events. Confirmation permanently removes that event and its saved orders; active events and saved menu templates remain intact. `node scripts/verify-event-deletion.mjs` verifies the API against an isolated in-memory database.

Choose **Create short link** in the invite editor, then copy/share it or open an email draft. The short URL stores the current invitation on the café server; editing the invitation requires creating a new link. Existing short links keep their original welcome details.
