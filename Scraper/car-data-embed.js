/**
 * Shared helpers for embedding car data into bootstrap.html / index.html.
 *
 * Why compression
 * ---------------
 * All 117k cars as raw JSON is ~117 MB, over GitHub Pages' 100 MB file limit -
 * which is why index.html was capped at 70k cars (~88 MB). Gzip + base64 brings
 * the same dataset to ~21 MB, so the cap can be removed. The page inflates it at
 * load with the browser's built-in DecompressionStream: no library, no request.
 *
 * Layout
 * ------
 *   const jsonData = { Car: [] };            <- placeholder only
 *   async function loadCarData() { ... }     <- inserted by the template transform
 *   ...
 *   (async () => { const cars = await loadCarData(); ... })();
 *   ...
 *   <script type="application/octet-stream" id="car-data">BASE64</script>
 *
 * IMPORTANT: nothing that ends up in the page may contain a literal script tag
 * string. An earlier version put `<script id="car-data">` inside a JS comment,
 * and the data-block regex then matched *inside that comment* and swallowed
 * 178 KB of dashboard code. `setDataBlock` now replaces by index, and
 * `assertEmbeddable` guards against a repeat.
 */

const zlib = require('zlib');

const DATA_ID = 'car-data';
const DATA_OPEN = `<script type="application/octet-stream" id="${DATA_ID}">`;
const DATA_CLOSE = '</script>';

/**
 * Locate the data block as an index range (no regex: regex matching across JS
 * strings/comments is exactly what broke before).
 * @param {string} html
 * @returns {{start:number, bodyStart:number, end:number}|null}
 */
function findDataBlock(html) {
  const start = html.indexOf(DATA_OPEN);
  if (start === -1) return null;
  const bodyStart = start + DATA_OPEN.length;
  const close = html.indexOf(DATA_CLOSE, bodyStart);
  if (close === -1) return null;
  return { start, bodyStart, end: close + DATA_CLOSE.length };
}

/** @returns {string} the base64 payload currently embedded ('' when absent) */
function readDataBlock(html) {
  const range = findDataBlock(html);
  if (!range) return '';
  return html.slice(range.bodyStart, range.end - DATA_CLOSE.length).replace(/\s+/g, '');
}

/** Replace or append the data block. Replace-by-index only. */
function setDataBlock(html, base64) {
  if (typeof base64 !== 'string' || !base64) throw new Error('setDataBlock: base64 payload required');
  if (/[<>]/.test(base64)) throw new Error('setDataBlock: base64 payload must not contain angle brackets');
  const block = `${DATA_OPEN}${base64}${DATA_CLOSE}`;
  const range = findDataBlock(html);
  if (range) return html.slice(0, range.start) + block + html.slice(range.end);
  const close = html.lastIndexOf('</body>');
  if (close === -1) throw new Error('setDataBlock: no </body> to insert before');
  return `${html.slice(0, close)}${block}\n${html.slice(close)}`;
}

/** gzip + base64 a JSON-serialisable value. */
function compressToBase64(value) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(value), 'utf-8'), { level: 9 }).toString('base64');
}

/** gzip + base64 of an already-serialised JSON string. */
function compressStringToBase64(json) {
  return zlib.gzipSync(Buffer.from(json, 'utf-8'), { level: 9 }).toString('base64');
}

/**
 * Locate `const jsonData = {...}` (the whole assignment may be one huge line)
 * and return its extent including the trailing semicolon.
 */
function findJsonDataAssignment(content) {
  const marker = content.indexOf('const jsonData');
  if (marker === -1) return null;
  const eq = content.indexOf('=', marker);
  if (eq === -1) return null;
  const firstBrace = content.indexOf('{', eq);
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = firstBrace; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) { inString = false; quote = null; }
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Only swallow a semicolon that immediately follows the closing brace.
        // Do NOT skip whitespace here: doing so would jump across newlines into
        // the next statement (and later make the data block swallow the rest of
        // the page).
        let end = i + 1;
        if (content[end] === ';') end++;
        return { start: marker, end };
      }
    }
  }
  return null;
}

/** The replacement for `const jsonData = {...}`: a placeholder + the loader. */
function loaderBlock() {
  return `// --- CAR DATA (gzip + base64, inflated below) ---
            // The real dataset lives in the data block near the end of the body.
            // Keeping this placeholder means anything still reading jsonData.Car
            // sees an empty array rather than throwing.
            const jsonData = { Car: [] };

            async function loadCarData() {
                const holder = document.getElementById('${DATA_ID}');
                if (!holder) throw new Error('data block not found on this page');
                const encoded = holder.textContent.replace(/\\s+/g, '');
                if (!encoded) throw new Error('data block is empty - run: node update-index-html-with-new-cars.js');
                if (typeof DecompressionStream === 'undefined') {
                    throw new Error('This browser lacks DecompressionStream (needs Chrome/Edge 80+, Firefox 113+, Safari 16.4+).');
                }
                console.time('Decompress car data');
                const binary = atob(encoded);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
                const text = await new Response(stream).text();
                console.timeEnd('Decompress car data');
                const parsed = JSON.parse(text);
                return parsed.Car || [];
            }`;
}

/** Replace `const jsonData = {...};` with the placeholder + loader. */
function replaceJsonDataAssignment(content) {
  const range = findJsonDataAssignment(content);
  if (!range) throw new Error('could not find `const jsonData = {...}` in the template');

  // The data-dependent initialisation happens after this point and must run
  // once the data is available. Wrap it in an async IIFE.
  const marker = '// --- INITIAL PAGE LOAD ---';
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) throw new Error('could not find the INITIAL PAGE LOAD marker');

  // Advance to the end of the line holding the assignment (handles CRLF).
  let nl = content.indexOf('\n', range.end);
  if (nl === -1) throw new Error('unexpected end of file after jsonData');
  const between = content.slice(range.end, nl);
  if (between.replace(/[\r\n]+$/, '').trim() !== '') {
    throw new Error(`expected the jsonData assignment to end its line, found: ${JSON.stringify(between)}`);
  }

  const head = content.slice(0, range.start);
  const tail = content.slice(nl + 1);
  const tailStart = nl + 1;

  // The data-dependent block is wrapped in an async IIFE, which must be closed
  // BEFORE the DOMContentLoaded callback's own `});`. In the template that
  // callback ends with the LAST `});` that precedes the dashboard </script>.
  const scriptClose = content.lastIndexOf('</script>');
  if (scriptClose === -1) throw new Error('could not find the closing </script> of the dashboard');
  const callbackClose = content.lastIndexOf('});', scriptClose);
  if (callbackClose === -1 || callbackClose < range.end) {
    throw new Error('could not find the DOMContentLoaded callback close before </script>');
  }

  const callbackCloseRel = callbackClose - tailStart;
  let tailBeforeCallbackClose = tail.slice(0, callbackCloseRel);
  const tailFromCallbackClose = tail.slice(callbackCloseRel);

  // The template assigns tableData from the (now empty) placeholder AFTER the
  // data-dependent block starts. Left alone those lines would wipe the freshly
  // loaded records, so neutralise them. Matches both `= jsonData.Car;` and
  // `= jsonData.Car || [];`.
  let neutralised = 0;
  tailBeforeCallbackClose = tailBeforeCallbackClose.replace(
    /^([ \t]*)(tableData\s*=\s*jsonData\.Car\b[^\n]*)$/gm,
    (m, indent, stmt) => {
      neutralised++;
      return `${indent}// [migrate-template] removed: data now comes from loadCarData()\n${indent}// ${stmt}`;
    }
  );

  const wrappedTail = `            // The dataset is compressed into the data block and inflated here, so\n`
    + `            // every render/filter below operates on the real records.\n`
    + `            (async () => {\n`
    + `            const loadedCars = await loadCarData();\n`
    + `            tableData = loadedCars;\n`
    + tailBeforeCallbackClose
    + `\n            })(); // end: data-dependent initialisation\n`
    + `\n`
    + tailFromCallbackClose;

  return {
    html: `${head}${loaderBlock()}\n${wrappedTail}`,
    removedBytes: range.end - range.start,
    neutralisedAssignments: neutralised,
  };
}

/**
 * Assert the produced page is structurally sound and did not lose dashboard code.
 * @param {string} html
 * @param {{minBytes?:number}} [opts]
 */
function assertEmbeddable(html, opts = {}) {
  const problems = [];
  const minBytes = opts.minBytes || 20000;

  if (html.length < minBytes) problems.push(`page is only ${html.length} bytes (expected > ${minBytes})`);

  // Markers that only exist if the dashboard script survived intact. These are
  // plain identifiers so the check does not depend on declaration style.
  for (const needle of [
    'applyFilters',
    'setupEventListeners',
    'renderTable',
    'populateYearFilter',
    'populateMinDateFilter',
    'Dashboard initialization complete',
    'async function loadCarData',
    'await loadCarData()',
  ]) {
    if (!html.includes(needle)) problems.push(`missing expected code: ${needle}`);
  }

  const range = findDataBlock(html);
  if (!range) problems.push('no car-data block found');

  // exactly one data block
  const first = html.indexOf(DATA_OPEN);
  if (first !== -1 && html.indexOf(DATA_OPEN, first + 1) !== -1) problems.push('more than one car-data block');

  // NOTE: never run a `[^\n]*`-style regex over this string. The embedded base64
  // contains no newlines, so such a pattern backtracks catastrophically (this
  // previously hung the build for >10 minutes on a 20 MB payload).

  // The placeholder must be exactly the empty array; real data here means the
  // template was not migrated.
  if (jsonDataHasData(html)) problems.push('inline car data is still present (bootstrap.html not migrated)');

  // The loader must be present and reachable
  if (!html.includes('const jsonData = { Car: [] };')) {
    problems.push('jsonData placeholder missing or modified');
  }
  if (!html.includes('tableData = loadedCars;')) {
    problems.push('tableData is never assigned from loadCarData()');
  }

  // Any surviving `tableData = jsonData.Car` would overwrite the loaded records
  // with the empty placeholder, leaving an empty dashboard.
  const clobber = /^[ \t]*tableData\s*=\s*jsonData\.Car\b/m;
  if (clobber.test(html)) {
    problems.push('a live `tableData = jsonData.Car` assignment remains and would wipe the loaded data');
  }

  // Validate the payload with a linear scan, NOT a regex. A quantified character
  // class over a 20 MB newline-free base64 string backtracks catastrophically
  // (this previously hung the build for minutes).
  const body = range ? html.slice(range.bodyStart, range.end - DATA_CLOSE.length) : '';
  if (body) {
    for (let i = 0; i < body.length; i++) {
      const c = body.charCodeAt(i);
      const isB64 = (c >= 65 && c <= 90)   // A-Z
        || (c >= 97 && c <= 122)           // a-z
        || (c >= 48 && c <= 57)            // 0-9
        || c === 43 || c === 47            // + /
        || c === 61                        // =
        || c === 10 || c === 13 || c === 32 || c === 9; // whitespace
      if (!isB64) {
        problems.push(`data block contains a non-base64 character at offset ${i}: ${JSON.stringify(body[i])}`);
        break;
      }
    }
  }

  // outer html structure
  if (!/<\/html>\s*$/i.test(html.trim())) problems.push('page does not end with </html>');
  const scriptOpens = (html.match(/<script\b/gi) || []).length;
  const scriptCloses = (html.match(/<\/script>/gi) || []).length;
  if (scriptOpens !== scriptCloses) problems.push(`unbalanced script tags: ${scriptOpens} open vs ${scriptCloses} close`);

  if (problems.length) throw new Error(`embedded page failed validation:\n  - ${problems.join('\n  - ')}`);
  return true;
}

/** Inflate a page's data block (used by tests; mirrors the browser path). */
async function decompressPageData(html) {
  const b64 = readDataBlock(html);
  if (!b64) throw new Error('no data block in page');
  const bytes = Buffer.from(b64, 'base64');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

/** True when the assignment holds real car data rather than the empty placeholder. */
function jsonDataHasData(content) {
  const range = findJsonDataAssignment(content);
  if (!range) return false;
  const body = content.slice(range.start, range.end);
  return /"listingId"\s*:/.test(body);
}

module.exports = {
  DATA_ID,
  DATA_OPEN,
  DATA_CLOSE,
  findDataBlock,
  readDataBlock,
  setDataBlock,
  compressToBase64,
  compressStringToBase64,
  findJsonDataAssignment,
  jsonDataHasData,
  replaceJsonDataAssignment,
  assertEmbeddable,
  decompressPageData,
};
