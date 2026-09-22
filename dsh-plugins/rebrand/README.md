# dsh-plugins/rebrand

Removes the DeepSeek wordmark and logo from the DSH Web GUI and renames the
application to **Harness**.

The GUI ships as built artifacts inside the installed `@deepseek-ai/dsh-web-frontend`
package, so there is no source tree to edit: the rebrand is applied to the published
`dist/` in place, and the patch scripts here are the record of exactly what changed.

## What was changed

| Artifact | Change |
|---|---|
| `dist/index.html` | `<title>DeepSeek Harness</title>` → `<title>Harness</title>` |
| `dist/manifest.webmanifest` | `name` and `short_name` → `Harness` |
| `dist/favicon.svg` | DeepSeek whale replaced with a neutral rounded-square "H" mark |
| `dist/assets/index-*.js` | The whale glyph and the outlined "DeepSeek" lockup removed |

Inside the bundle, three exported primitives carried the brand:

| Export | Was | Now |
|---|---|---|
| `FishLogo` (`cC`) | the whale glyph | a neutral four-point spark |
| `BrandWordmark` (`uC`) | whale + outlined "DeepSeek" + a rounded badge whose glyph paths spell "DS" | the word `HARNESS` |
| `FISH_LOGO_PATH` / `FISH_LOGO_VIEWBOX` (`$6` / `Mr`) | the whale path and its 23.16 × 17.04 box | the neutral glyph and its 16 × 16 box |

The `FISH_LOGO_PATH` / `FISH_LOGO_VIEWBOX` export **names** are kept even though the
brand is gone: they are part of the published `ui-primitives` surface, so renaming
them would break any consumer that imports them. Their values no longer describe
DeepSeek artwork, which is what makes the mark unreachable from anywhere in the UI.

References to `@deepseek-ai/*` package names, CSS custom properties such as
`--dsw-static-deepseek-450` (a color token, never rendered as text), and module ids
are intentionally untouched: they are not user-visible branding, and changing them
would break the plugin and module graph.

## Applying it

```sh
# Dry run: report what would change, touch nothing.
node patch-web-brand.mjs --check

# Apply (idempotent: an already-patched bundle is reported and skipped).
node patch-web-brand.mjs
```

The installed bundle path is discovered by default. Point at another install with:

```sh
DSH_WEB_FRONTEND_BUNDLE=/path/to/index-<hash>.js node patch-web-brand.mjs
```

`patch-web-brand.mjs` is written against exact byte anchors rather than line numbers
or formatting, because the bundle is minified production output on one line. It
asserts every anchor before touching anything, refuses to run when an anchor is
missing or ambiguous, writes only after all replacements succeed, and re-checks the
result. It also terminates declarations by brace balancing that is string-literal
aware — the bundle carries `{` and `}` inside SVG path data and quoted text — and
skips a function's parameter list before balancing, because default parameter values
are object literals (`{size:t=24}`) whose braces would otherwise be mistaken for the
function body.

## Verifying

```sh
node verify-web-brand.mjs
```

`node --check` only proves the patched bundle parses. `verify-web-brand.mjs` closes
the gap: it slices the patched `BrandWordmark` and `FishLogo` declarations and their
shared path constants out of the live bundle, evaluates them against a minimal React
stub, and asserts on the resulting element trees — that the whale path is gone, that
`BrandWordmark` renders exactly the string `HARNESS` with no SVG paths, that
`FishLogo` renders one non-whale path in a 16 × 16 box, and that both still honor
`size` and `className`.

It also scans the whole bundle for residual brand geometry and for a user-visible
`"DeepSeek` literal.

## After applying

The frontend dist is served straight from disk, so the rebrand takes effect when the
page reloads — no server restart is needed for the shell files.

Two browser caches are worth knowing about:

- **favicon.svg** is cached aggressively. If the old mark is still showing, hard-reload
  (Ctrl+Shift+R) or add the page to a fresh tab.
- The **app title** likewise comes from `index.html`, so a reload picks it up.

Reinstalling or upgrading `@deepseek-ai/dsh-web-frontend` replaces `dist/` and the
rebrand is lost; re-run `patch-web-brand.mjs`. The bundle's content-hashed filename
changes on upgrade, so pass `DSH_WEB_FRONTEND_BUNDLE` if the default path no longer
resolves.

A pre-patch copy of the bundle is kept here as
`index-BKQ_L1z6.js.orig-backup` (the `BACKUP` constant in `patch-web-brand.mjs`), so
the original can be restored or diffed. It lives in this directory rather than beside
the live bundle on purpose: the frontend-static server serves **any** file under
`dist/` whose extension it does not recognize as `application/octet-stream`, so a
backup left in `dist/assets/` would be downloadable from `/assets/…` even though
nothing references it.

`patch-web-brand.mjs` skips an already-patched bundle rather than patching twice, so
re-running it is safe.
