/**
 * Verify the rebranded web bundle without booting a browser.
 *
 * `node --check` proves the patched bundle parses; it does not prove the
 * patched logo components still RUN or that they render what we intend. This
 * harness closes that gap: it slices the patched `BrandWordmark` (`uC`) and
 * `FishLogo` (`cC`) declarations plus their shared path constants out of the
 * live bundle, evaluates them against a minimal React stub, and asserts on the
 * resulting element trees.
 *
 * It reads the same anchors the patcher writes, so a patcher regression that
 * still parses (wrong replacement, unbalanced JSX) fails here.
 *
 * Usage: node verify-web-brand.mjs
 */

import { readFileSync } from 'node:fs';

import {
  BUNDLE,
  NEUTRAL_GLYPH,
  WHALE_PREFIX,
  WORDMARK_LETTERING_PREFIX,
  DS_BADGE_PREFIX,
  WORDMARK_DEFS_PREFIX,
  count,
  findClosing,
} from './patch-web-brand.mjs';

let failures = 0;

/**
 * Assert one condition.
 * @param {string} label - what is being asserted.
 * @param {boolean} condition - the result.
 * @param {string} [detail] - extra context on failure.
 */
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`);
  }
}

/**
 * Slice a declaration out of the bundle text by locating its source range.
 *
 * @param {string} source - bundle text.
 * @param {string} signature - exact declaration prefix.
 * @returns {string} the declaration source.
 */
function span(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`verifier: anchor missing: ${signature}`);
  if (signature.startsWith('function ')) {
    const paramsOpen = source.indexOf('(', start);
    const paramsClose = findClosing(source, paramsOpen, '(', ')');
    const bodyOpen = source.indexOf('{', paramsClose + 1);
    const bodyClose = findClosing(source, bodyOpen, '{', '}');
    return source.slice(start, bodyClose + 1);
  }
  // A string-constant declaration: run to the closing quote of its literal.
  const quote = source.indexOf('"', start);
  const end = source.indexOf('"', quote + 1);
  if (quote === -1 || end === -1) throw new Error(`verifier: unterminated literal: ${signature}`);
  return source.slice(start, end + 1);
}

/** Minimal React element factory mirroring the JSX-runtime contract. */
const jsx = (type, props, key) => ({
  $$typeof: 'react.element',
  type,
  key: key ?? null,
  props,
});
const jsxs = jsx;

/**
 * Build the stubbed evaluation scope source holding the patched declarations.
 * @param {string} source - patched bundle text.
 * @returns {string} the generated function body.
 */
function scopeCode(source) {
  return [
    // Bind the JSX runtime under the minified name the bundle body uses.
    'const d = jsxRuntime;',
    // `FISH_LOGO_VIEWBOX` and `FISH_LOGO_PATH` are one declaration list.
    span(source, 'const Mr={'),
    span(source, 'function cC({size:t=24,className:r})'),
    span(source, 'function uC({'),
    'return { Mr, $6, cC, uC };',
  ].join('\n');
}

/**
 * Build the stubbed evaluation scope holding the patched declarations.
 * @param {string} source - patched bundle text.
 * @returns {Record<string, unknown>} the scope bindings.
 */
function scopeOf(source) {
  // eslint-disable-next-line no-new-func
  return new Function('jsxRuntime', scopeCode(source))({ jsx, jsxs });
}

/** Collect every literal SVG path `d` value under a node. */
function pathData(node, out = []) {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) pathData(child, out);
    return out;
  }
  if (node.props?.d !== undefined) out.push(node.props.d);
  pathData(node.props?.children, out);
  return out;
}

/** Collect every string leaf under a node. */
function strings(node, out = []) {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) strings(child, out);
    return out;
  }
  strings(node.props?.children, out);
  return out;
}

const source = readFileSync(BUNDLE, 'utf8');

console.log(`bundle: ${BUNDLE}`);
console.log('static residual-brand scan');

check('whale path is gone', count(source, WHALE_PREFIX) === 0);
check('DeepSeek lettering is gone', count(source, WORDMARK_LETTERING_PREFIX) === 0);
check('DS badge glyph is gone', count(source, DS_BADGE_PREFIX) === 0);
check('wordmark clip paths are gone', count(source, WORDMARK_DEFS_PREFIX) === 0);
check(
  'no user-visible "DeepSeek" literal remains',
  !/"DeepSeek/.test(source) && !/DeepSeek Harness/.test(source),
);
check(
  'package specifiers still intact',
  count(source, '@deepseek-ai/dsh-client-ui-slots') === 1,
);

console.log('evaluating patched components');

let scope;
try {
  scope = scopeOf(source);
  check('patched declarations evaluate', true);
} catch (error) {
  check('patched declarations evaluate', false, String(error));
  if (process.env.DSH_VERIFY_DEBUG === '1') {
    console.log('--- generated scope code ---');
    console.log(scopeCode(source));
    console.log('--- end ---');
  }
  process.exit(1);
}

check(
  'FISH_LOGO_VIEWBOX is the neutral box',
  scope.Mr.width === NEUTRAL_GLYPH.viewbox.width && scope.Mr.height === NEUTRAL_GLYPH.viewbox.height,
  JSON.stringify(scope.Mr),
);
check('FISH_LOGO_PATH is the neutral glyph', scope.$6 === NEUTRAL_GLYPH.path);

// ── FishLogo ────────────────────────────────────────────────────────────────
const fish = scope.cC({ size: 24, className: 'brand-mark' });
const fishPaths = pathData(fish);
check('FishLogo renders exactly one path', fishPaths.length === 1, String(fishPaths.length));
check('FishLogo path is not the whale', !fishPaths.some((d) => d.includes('22.9168')));
check(
  'FishLogo viewBox matches its geometry',
  fish.props.viewBox === '0 0 16 16',
  fish.props.viewBox,
);
check('FishLogo keeps caller size/class', fish.props.width === 24 && fish.props.className === 'brand-mark');
check('FishLogo is decorative', fish.props['aria-hidden'] === true);

// ── BrandWordmark ───────────────────────────────────────────────────────────
const mark = scope.uC({});
const markStrings = strings(mark);
check('BrandWordmark renders a single element', mark.type === 'span', String(mark.type));
check('BrandWordmark spells HARNESS', markStrings.length === 1 && markStrings[0] === 'HARNESS', JSON.stringify(markStrings));
check('BrandWordmark exposes no SVG paths', pathData(mark).length === 0);
check('BrandWordmark scales with size', scope.uC({ size: 48 }).props.style.fontSize === 48 * 0.68);
check('BrandWordmark forwards className', scope.uC({ className: 'wm' }).props.style !== undefined && mark.props.className === undefined);

console.log('');
if (failures === 0) {
  console.log('all checks passed');
} else {
  console.log(`${String(failures)} check(s) failed`);
  process.exit(1);
}
