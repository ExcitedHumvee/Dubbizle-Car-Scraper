# dsh-plugins

Workspace-local plugins and patches for the DSH Web GUI. Each directory is
self-contained and referenced from `$DSH_HOME/profiles/web/cordis.patch.yml` by a
`file:` URL, so nothing here needs an install step.

| Directory | What it is |
|---|---|
| [`context-gauge/`](./context-gauge/README.md) | Context-remaining badge in the session header |
| [`sound-alerts/`](./sound-alerts/README.md) | Notification sounds for a completed response and for "your input is needed", with a header control |
| [`rebrand/`](./rebrand/README.md) | Patch scripts that remove the DeepSeek wordmark and logo from the shipped web frontend and rename it to **Harness** |

`verify-plugin-wiring.mjs` in this directory checks the wiring contract shared by every
plugin here: that each one declares a valid `dsh.client` block, exports its client
subpath, ships both halves, and exposes the `apply` binding the Loader expects.

```sh
node verify-plugin-wiring.mjs
```

## Profile rows

Both plugins are mounted by `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: context-gauge
      name: file:///C:/Users/stany/Desktop/coding%20repos/Dubbizle-Car-Scraper/dsh-plugins/context-gauge/lib/index.js
    - id: sound-alerts
      name: file:///C:/Users/stany/Desktop/coding%20repos/Dubbizle-Car-Scraper/dsh-plugins/sound-alerts/lib/index.js
```

Spaces in the path are `%20`-escaped in the URL form. The `web` profile uses
`patchReload: live`, so editing that file re-composes the tree and re-renders the
client boot graph without restarting the server; the browser then needs a reload.
