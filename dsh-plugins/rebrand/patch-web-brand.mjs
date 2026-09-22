/**
 * Rebrand the DSH web frontend bundle: remove the DeepSeek whale logo and the
 * "DeepSeek" wordmark, and render the "HARNESS" wordmark in their place.
 *
 * The bundle is minified production output, so the patch is written against
 * exact byte anchors that were verified by inspection. Every step asserts its
 * anchor before touching anything, writes only when all steps succeed, and
 * re-reads the file to confirm the result. Nothing is guessed.
 *
 * Two independent call sites carry the brand mark:
 *
 *   `function cC({size,className})`  — the bare whale glyph (`FishLogo`).
 *   `function uC({size,className,includeMark})` — the full lockup: the word
 *      "DeepSeek" as outlined paths, then the whale, then a rounded badge whose
 *      two glyph paths spell "DS" (drawn with an inverted fill over the badge).
 *
 * Both are replaced. The `FISH_LOGO_PATH` / `FISH_LOGO_VIEWBOX` exports keep
 * their names (other code imports them) but now describe a neutral generic
 * glyph, so no consumer can render the whale.
 *
 * Usage: node patch-web-brand.mjs [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The installed frontend bundle to patch. Override with
 * `DSH_WEB_FRONTEND_BUNDLE` when the dsh install lives elsewhere (the npx cache
 * path embeds a content hash that changes on reinstall).
 */
const BUNDLE =
  process.env.DSH_WEB_FRONTEND_BUNDLE ??
  join(
    'C:',
    'Users',
    'stany',
    'AppData',
    'Local',
    'npm-cache',
    '_npx',
    '1e7f6d9597241db0',
    'node_modules',
    '@deepseek-ai',
    'dsh-web-frontend',
    'dist',
    'assets',
    'index-BKQ_L1z6.js',
  );

/**
 * Pristine pre-patch copy of the bundle, kept here rather than in `dist/`.
 *
 * The frontend-static server serves any file under `dist/` whose extension it
 * does not recognize as `application/octet-stream`, so a backup left beside the
 * live bundle would be downloadable from `/assets/…` — an orphaned copy of the
 * brand we are removing, reachable by URL.
 */
const BACKUP = join(here, 'index-BKQ_L1z6.js.orig-backup');

const CHECK_ONLY = process.argv.includes('--check');
/** The whale path starts with this prefix; it is unique in the bundle. */
const WHALE_PREFIX = 'M22.9168 1.43018C22.6713 1.31018';
/** The badge's "D" glyph path is unique by its distinctive prefix. */
const DS_BADGE_PREFIX = 'M132.848 8.93205H134.08V16.137';
/** First path of the "DeepSeek" lettering. */
const WORDMARK_LETTERING_PREFIX = 'M68.416 18.2447H67.0501V16.1272H68.416';
/** `<defs>` block declaring the wordmark/whale clip paths inside the lockup. */
const WORDMARK_DEFS_PREFIX = 'd.jsxs("defs",{children:[d.jsx("clipPath"';

/** Count non-overlapping literal occurrences. */
function count(haystack, needle) {
  let n = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    n += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return n;
}

/**
 * Replace one whole `function NAME(...) {...}` declaration, found by its exact
 * declared parameter list and terminated by brace balancing over the BODY.
 *
 * The parameter list is skipped before balancing starts, because default
 * parameter values are object/array literals (`{size:t=24}`) whose braces would
 * otherwise be mistaken for the function body. Brace balancing is then
 * string-literal aware: the bundle carries `{` and `}` inside SVG path data and
 * quoted text, so a naive depth counter would stop in the wrong place.
 *
 * @param source - the bundle text.
 * @param signature - the exact `function NAME(params)` prefix, including `function `.
 * @param replacement - the replacement declaration.
 * @returns the patched source.
 */
function replaceFunction(source, signature, replacement) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`anchor missing: ${signature.slice(0, 60)}…`);
  if (source.indexOf(signature, start + 1) !== -1) {
    throw new Error(`anchor not unique: ${signature.slice(0, 60)}…`);
  }

  // Skip the parameter list: from the signature's opening paren to its match.
  const paramsOpen = source.indexOf('(', start);
  const paramsClose = findClosing(source, paramsOpen, '(', ')');
  const bodyOpen = source.indexOf('{', paramsClose + 1);
  if (bodyOpen === -1) throw new Error(`anchor missing function body: ${signature.slice(0, 60)}…`);

  const bodyClose = findClosing(source, bodyOpen, '{', '}');
  return source.slice(0, start) + replacement + source.slice(bodyClose + 1);
}

/**
 * Index of the delimiter matching the one at `open`, string-literal aware.
 *
 * @param source - the bundle text.
 * @param open - index of the opening delimiter.
 * @param opener - the opening character.
 * @param closer - the matching closing character.
 * @returns the index of the matching closing delimiter.
 */
function findClosing(source, open, opener, closer) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unbalanced ${opener}${closer} starting at ${String(open)}`);
}

/**
 * Neutral generic glyph used wherever the whale used to be: a four-point spark.
 * Deliberately not brand-like, so no consumer renders DeepSeek artwork.
 */
const NEUTRAL_GLYPH = {
  viewbox: { width: 16, height: 16 },
  path:
    'M8 0.5 9.85 6.15 15.5 8 9.85 9.85 8 15.5 6.15 9.85 0.5 8 6.15 6.15Z',
};

/** The wordmark rendered in place of the DeepSeek lockup: just the word HARNESS. */
const HARNESS_WORDMARK =
  'function uC({size:t=24,className:r}){return d.jsx("span",{className:r,style:{fontSize:t*0.68,fontWeight:600,letterSpacing:"0.14em",lineHeight:1,whiteSpace:"nowrap"},children:"HARNESS"})}';

/** The bare-logo component, rendering the neutral glyph instead of the whale. */
const FISH_LOGO =
  'function cC({size:t=24,className:r}){return d.jsx("svg",{width:t,height:t,className:r,viewBox:"0 0 16 16",fill:"none","aria-hidden":true,children:d.jsx("path",{d:"' +
  NEUTRAL_GLYPH.path +
  '",fill:"currentColor"})})}';

function main() {
  const original = readFileSync(BUNDLE, 'utf8');
  let source = original;

  // ── preconditions ─────────────────────────────────────────────────────────
  if (!source.includes(WHALE_PREFIX) && source.includes('children:"HARNESS"')) {
    console.log(`already patched: ${BUNDLE}`);
    return;
  }
  for (const [label, needle, expected] of [
    ['whale path', WHALE_PREFIX, 1],
    ['wordmark lettering', WORDMARK_LETTERING_PREFIX, 1],
    ['DS badge glyph', DS_BADGE_PREFIX, 1],
    ['wordmark defs', WORDMARK_DEFS_PREFIX, 1],
  ]) {
    const found = count(source, needle);
    if (found !== expected) {
      throw new Error(`precondition failed: ${label} expected ${expected} occurrence(s), found ${found}`);
    }
  }
  // The wordmark lockup's first element is the lettering's D. Anchoring on the
  // surrounding `d.jsx("path",{d:"` prefix avoids matching an `M68.416` that
  // occurs inside the whale path's own data.
  const letteringAnchor = 'd.jsx("path",{d:"M68.416 18.2447H67.0501V16.1272H68.416';
  if (count(source, letteringAnchor) !== 1) {
    throw new Error('precondition failed: wordmark lettering first path not uniquely anchored');
  }

  // ── 1. FISH_LOGO_VIEWBOX: keep the export name, drop the mark geometry ────
  source = source.replace(
    /const Mr=\{width:23\.16,height:17\.04\}/,
    `const Mr={width:${String(NEUTRAL_GLYPH.viewbox.width)},height:${String(NEUTRAL_GLYPH.viewbox.height)}}`,
  );

  // ── 2. FISH_LOGO_PATH: keep the export name, drop the whale path ──────────
  const whaleStart = source.indexOf('$6="' + WHALE_PREFIX);
  if (whaleStart === -1) throw new Error('anchor missing: FISH_LOGO_PATH assignment');
  const whalePathEnd = source.indexOf('Z"', whaleStart);
  if (whalePathEnd === -1) throw new Error('anchor missing: end of FISH_LOGO_PATH literal');
  source =
    source.slice(0, whaleStart) +
    '$6="' +
    NEUTRAL_GLYPH.path +
    '"' +
    source.slice(whalePathEnd + 2); // +2 skips the closing `Z"`

  // ── 3. FishLogo component: render the neutral glyph ───────────────────────
  source = replaceFunction(source, 'function cC({size:t=24,className:r})', FISH_LOGO);

  // ── 4. BrandWordmark: render the word only ────────────────────────────────
  source = replaceFunction(
    source,
    'function uC({size:t=24,className:r,includeMark:i=!0})',
    HARNESS_WORDMARK,
  );

  // ── postconditions ────────────────────────────────────────────────────────
  if (source.includes(WHALE_PREFIX)) throw new Error('postcondition failed: whale path still present');
  if (source.includes(WORDMARK_LETTERING_PREFIX)) {
    throw new Error('postcondition failed: DeepSeek lettering still present');
  }
  if (source.includes(DS_BADGE_PREFIX)) throw new Error('postcondition failed: DS badge still present');
  if (source.includes(WORDMARK_DEFS_PREFIX)) throw new Error('postcondition failed: wordmark clip paths still present');
  if (!source.includes('children:"HARNESS"')) throw new Error('postcondition failed: HARNESS wordmark missing');
  if (count(source, 'const Mr={width:16,height:16}') !== 1) {
    throw new Error('postcondition failed: FISH_LOGO_VIEWBOX not rewritten');
  }

  const delta = original.length - source.length;
  if (CHECK_ONLY) {
    console.log(`check: bundle would shrink by ${String(delta)} bytes (already-patched file reports 0)`);
    return;
  }
  writeFileSync(BUNDLE, source);
  console.log(`patched ${BUNDLE}`);
  console.log(`  bytes: ${String(original.length)} -> ${String(source.length)} (${String(-delta)})`);
}

// Run only when invoked as a script; importing this module (the verifier does)
// must not touch the bundle.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export {
  BUNDLE,
  BACKUP,
  NEUTRAL_GLYPH,
  HARNESS_WORDMARK,
  FISH_LOGO,
  WHALE_PREFIX,
  WORDMARK_LETTERING_PREFIX,
  DS_BADGE_PREFIX,
  WORDMARK_DEFS_PREFIX,
  count,
  findClosing,
  replaceFunction,
  main,
};
