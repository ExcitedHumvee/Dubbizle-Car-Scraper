/**
 * Node half of the context-gauge plugin.
 *
 * This is a pure UI plugin: everything it does happens in the browser half,
 * which ships through `exports["./client"]` and is discovered by
 * `@deepseek-ai/dsh-client-modules` through this package's `dsh.client`
 * declaration. The empty `apply` exists only so the package is a well-formed
 * Cordis Loader entry and therefore appears in the entry scan that composes
 * `window.__DSH_BOOT__`.
 *
 * @module dsh-context-gauge
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}
