# dsh-context-gauge

A context-remaining gauge for the DSH Web GUI. It renders a compact badge in the
session header — gauge glyph, remaining percentage, and a small headroom bar — and
opens a panel with the exact figures and the heuristic composition of what is
currently occupying the context window.

## What it reads

Everything comes from the `dsh-token-meter` session projections, so the badge never
runs a model call and never disagrees with the composer's built-in meter:

| Projection | Field | Use |
|---|---|---|
| `contextPressure` | `projectedTokens` (fallback `pressureTokens`) | tokens in use by the next request |
| `contextPressure` | `contextWindow` | route capacity reported by the LLM adapter |
| `contextBreakdown` | `systemTokens` / `toolsTokens` / `messageTokens` | heuristic composition rows |

Remaining headroom is `contextWindow - used`, reported as a percentage and a token
count. Severity bands color the badge: normal at ≥25% left, warn below 25%, critical
below 10%.

Nothing renders until a provider has reported **both** a prompt size and a route
capacity. Before the first successful model call there is no numerator; on a route
that advertises no capacity there is no denominator. That mirrors the built-in
`ContextMeter`, which also renders nothing in those states.

## How it loads

The package is dual-face, the standard DSH client-plugin shape:

- `lib/index.js` — the host half. Empty `apply`; it exists so the package is a
  well-formed Cordis Loader entry.
- `lib/client.js` — the browser half, discovered through this package's own
  `dsh.client` declaration. It is plain script-form JavaScript
  (`window.__ModuleLoader__.load({ id, factory })`), so no build step is involved:
  the bundle is served as-is from disk.
- `package.json` — declares `exports["./client"]` and `dsh.client`
  (`platform: web`, `immediately: true`, plus `inject` edges onto the UI packages it
  composes with).

The client half registers one occupant into `conversation.session.header.utilities`
(a session-scoped `list` slot declared by `dsh-client-ui-conversation`) and
registers its `context-gauge` locale namespace with English and Simplified Chinese
dictionaries.

## Wiring it into a profile

The plugin lives in the workspace and is referenced by a `file:` URL, so there is
no install step. The row added to `$DSH_HOME/profiles/web/cordis.patch.yml` is:

```yaml
- insert:
    - id: context-gauge
      name: file:///C:/Users/stany/Desktop/coding%20repos/Dubbizle-Car-Scraper/dsh-plugins/context-gauge/lib/index.js
```

Profiles with `patchReload: live` (the default for `web`) apply the change without a
restart; otherwise restart `dsh web`. Remove the row to turn the gauge off.

## Moving it

The occupant is placement-independent: change the `name` and `id` in
`ctx.slots.register(...)` inside `lib/client.js` to any declared slot. Nearby options:

| Slot | Result |
|---|---|
| `conversation.session.header.utilities` | current: compact badge beside the header utilities |
| `conversation.input.dock` | full-width strip above the composer (shares the stack with Todo/Goal) |
| `conversation.composer.dock` | full-width strip below the composer card |

## Verifying

`node --check lib/client.js` proves syntax. To prove behavior, evaluate the bundle
with a stubbed `window.__ModuleLoader__` and DOM, forward its `factory` to stub
`react`, `react/jsx-runtime`, and `@deepseek-ai/dsh-client-ui-primitives`, then render
the registered component with `useProjection` returning each pressure case — absent
projection, missing capacity, healthy, warn, critical, over capacity, and
zero-capacity all behave as described above.
