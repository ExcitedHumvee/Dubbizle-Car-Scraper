/**
 * Maps an Algolia `motors.com` hit to the exact car shape that
 * `save-to-db.js` and `export-cars-from-db.js` already understand.
 *
 * The field names below are deliberately identical to the old HTML scraper's
 * output so the rest of the pipeline needs no changes.
 */

/**
 * Build a fast spec lookup for a hit.
 *
 * Algolia hits carry two spec representations:
 *   - `details`     : { "Make": { en: { value } , ar: { value } }, ... }
 *   - `details_v2`  : { primary/secondary/...: [ { label.en, value.en, slug } ] }
 *
 * Older snapshots only have `details`, newer ones have both. We index both by
 * slug and by English label so a lookup works no matter which is present.
 */
function buildSpecLookup(hit) {
  const map = new Map();
  const put = (key, value) => {
    if (key === undefined || key === null || key === '') return;
    const k = String(key).trim().toLowerCase();
    if (map.has(k)) return; // first writer wins (details_v2 = newest shape, indexed first)
    map.set(k, value);
  };

  // current shape first
  if (hit.details_v2 && typeof hit.details_v2 === 'object') {
    for (const group of Object.values(hit.details_v2)) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (!item) continue;
        const value = item.value && (item.value.en !== undefined ? item.value.en : item.value);
        if (value === undefined || value === null) continue;
        put(item.slug, value);
        put(item.label && (item.label.en || item.label), value);
      }
    }
  }

  // legacy shape
  if (hit.details && typeof hit.details === 'object') {
    for (const [label, def] of Object.entries(hit.details)) {
      const value = def && def.en && def.en.value !== undefined ? def.en.value : undefined;
      if (value === undefined || value === null) continue;
      put(label, value);
      put(def.slug, value);
    }
  }

  return {
    get(...keys) {
      for (const key of keys) {
        const v = map.get(String(key).trim().toLowerCase());
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return null;
    },
  };
}

/** Details we expose as list-valued "features" in the old output. */
const FEATURE_KEYS = {
  extras: ['Comfort & Convenience', 'comfort_and_convenience', 'Exterior', 'exterior', 'Entertainment & Technology', 'entertainment_and_technology'],
  technicalFeatures: ['Driver Assistance & Safety', 'driver_assistance_and_safety'],
};

function toArray(value) {
  if (value === null || value === undefined || value === '') return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

/**
 * Multi-value specs arrive from Algolia as a single comma-joined string
 * ("GCC, Accident Free, First Owner"). The old HTML scraper produced one array
 * entry per item, so split on commas - except inside parentheses, because
 * feature names themselves contain them (e.g. "Anti-Lock Brakes (ABS)").
 */
function toList(value) {
  const items = [];
  for (const raw of toArray(value)) {
    if (typeof raw !== 'string') { if (raw !== null && raw !== undefined) items.push(raw); continue; }
    let depth = 0;
    let current = '';
    for (const ch of raw) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) items.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) items.push(trimmed);
  }
  return items;
}

function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'boolean') return null;
  // Algolia occasionally stores the same attribute as a localised object
  // ({ en: "4" } / { value: "4" }) - unwrap before parsing.
  if (typeof value === 'object') {
    const inner = value.en !== undefined ? value.en
      : value.value !== undefined ? value.value
        : value.raw !== undefined ? value.raw
          : null;
    return inner === null ? null : toInt(inner);
  }
  const n = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return null;
}

/**
 * Coerce a spec value to a String (or null) for the DB.
 *
 * Algolia is inconsistent about spec shapes: most are plain strings, but some
 * attributes arrive as localised objects (`{ en: "SRT8" }`), and a few arrive as
 * `{ id: null, name: null }` (e.g. `motors_trim` on listings with no trim). The
 * Prisma columns are `String?`, so anything object-shaped must be unwrapped or
 * dropped - never passed through as-is.
 */
function toStringOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    // Prefer the first usable entry rather than "[object Object]".
    for (const item of value) {
      const s = toStringOrNull(item);
      if (s) return s;
    }
    return null;
  }
  if (typeof value === 'object') {
    // { en: ... } / { value: ... } / { raw: ... } first, then { name: ... }.
    for (const key of ['en', 'value', 'raw', 'name', 'label']) {
      if (value[key] !== undefined && value[key] !== value) {
        const s = toStringOrNull(value[key]);
        if (s) return s;
      }
    }
    return null;
  }
  return null;
}

/** seller_type codes used by the site -> readable values. */
const SELLER_TYPES = {
  OW: 'Owner',
  DL: 'Dealer',
  RL: 'Rental',
  AG: 'Agent',
  BR: 'Business',
};

/** "GCC Specs" -> "GCC" (matches the old scraper's stored values). */
function cleanSpec(value) {
  if (!value) return null;
  return String(value).replace(/\s*Specs\s*$/i, '').trim() || null;
}

/**
 * "18,000 AED" -> 18000. The Algolia `price` field is already numeric, this is
 * only a guard for older/variant records.
 */
function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (value && typeof value === 'object') {
    if (typeof value.raw === 'number') return Math.trunc(value.raw);
    if (value.value && typeof value.value.raw === 'number') return Math.trunc(value.value.raw);
    return toInt(value.value !== undefined ? value.value : value.en);
  }
  return toInt(value);
}

function epochToIso(seconds) {
  const n = toInt(seconds);
  if (!n || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * @param {object} hit an Algolia hit from the `motors.com` index
 * @returns {object|null} car record (null when the hit has no usable id)
 */
function mapHit(hit) {
  if (!hit || !hit.uuid) return null;

  const spec = buildSpecLookup(hit);

  const locationList = hit.location_list || hit.places || {};
  const locationParts = Array.isArray(locationList.en) ? locationList.en.filter(Boolean) : [];
  // Keep the same "Area, Emirate" presentation the HTML cards used.
  const location = locationParts.length >= 2
    ? `${locationParts[locationParts.length - 1]}, ${locationParts[locationParts.length - 2]}`
    : (locationParts.join(', ') || null);

  const neighbourhoodList = hit.neighbourhood && (hit.neighbourhood.en || hit.neighbourhood);
  const neighbourhood = Array.isArray(neighbourhoodList)
    ? neighbourhoodList.filter(Boolean).slice(-1)[0] || null
    : (neighbourhoodList || null);

  const photos = hit.photo_thumbnails || [];
  const sellerCode = hit.seller_type || spec.get('Seller type', 'seller_type');

  const negotiableRaw = spec.get('Negotiable', 'negotiable', 'Price Negotiable', 'price_negotiable');
  const isNegotiable = negotiableRaw !== null
    ? toBool(negotiableRaw)
    : (typeof hit.price === 'object' && hit.price !== null ? toBool(hit.price.negotiable) : false);

  const absolute = hit.absolute_url && (hit.absolute_url.en || hit.absolute_url);

  const carsOnPage = {
    listingId: hit.uuid,
    // Every String? column goes through toStringOrNull: spec values can arrive
    // as plain strings, localised objects, or { id, name } objects.
    make: toStringOrNull(spec.get('Make', 'make')),
    model: toStringOrNull(spec.get('Model', 'model')),
    year: toInt(hit.year !== undefined ? hit.year : spec.get('Year', 'year')),
    mileage: toInt(hit.kilometers !== undefined ? hit.kilometers : spec.get('Kilometers', 'kilometers')),
    price: parsePrice(hit.price),
    title: toStringOrNull(hit.name && (hit.name.en || hit.name)),
    spec: cleanSpec(toStringOrNull(spec.get('Regional Specs', 'regional_specs'))),
    isPremium: toBool(hit.is_premium),
    bodyType: toStringOrNull(spec.get('Body Type', 'body_type')) || toStringOrNull(hit.body_type),
    engineCapacity: toStringOrNull(spec.get('Engine Capacity (cc)', 'engine_capacity_cc')),
    horsepower: toStringOrNull(spec.get('Horsepower', 'horsepower')),
    transmissionType: toStringOrNull(spec.get('Transmission Type', 'transmission_type')),
    cylinders: toInt(spec.get('No. of Cylinders', 'no_of_cylinders')),
    interiorColor: toStringOrNull(spec.get('Interior Color', 'interior_color')),
    exteriorColor: toStringOrNull(spec.get('Exterior Color', 'exterior_color')),
    doors: toStringOrNull(spec.get('Doors', 'doors')),
    seatingCapacity: toStringOrNull(spec.get('Seating Capacity', 'seating_capacity')),
    trim: toStringOrNull(spec.get('Trim', 'motors_trim', 'trim')),
    warranty: toStringOrNull(spec.get('Warranty', 'warranty')),
    fuelType: toStringOrNull(spec.get('Fuel Type', 'fuel_type')),
    motorsTrim: toStringOrNull(hit.motors_trim) || toStringOrNull(spec.get('Motors Trim', 'motors_trim')),
    sellerType: toStringOrNull(sellerCode ? (SELLER_TYPES[sellerCode] || sellerCode) : null),
    location: toStringOrNull(location),
    neighbourhood: toStringOrNull(neighbourhood),
    detailPageUrl: toStringOrNull(absolute || hit.permalink),
    isNegotiable: isNegotiable === null ? false : isNegotiable,
    thumbnailUrl: photos.length ? toStringOrNull(photos[0]) : toStringOrNull(hit.photo && (hit.photo.en || hit.photo)),
    vehicleReference: toStringOrNull(spec.get('Vehicle Reference', 'vehicle_reference')),
    isVerifiedUser: toBool(hit.is_verified_user),
    // NOTE: `created_at` is when the Dubizzle *account* was created,
    // `added` is when the car was posted (see README).
    createdAt: epochToIso(hit.created_at),
    added: epochToIso(hit.added),
    badges: toList(toStringOrNull(spec.get('Badges', 'badges'))),
    // Both list-valued spec groups are merged into the two buckets the old
    // scraper produced, so the DB/export shape stays identical.
    extras: toList([
      ...toArray(spec.get(FEATURE_KEYS.extras[0], FEATURE_KEYS.extras[1])),
      ...toArray(spec.get(FEATURE_KEYS.extras[2], FEATURE_KEYS.extras[3])),
      ...toArray(spec.get(FEATURE_KEYS.extras[4], FEATURE_KEYS.extras[5])),
      ...toArray(spec.get(FEATURE_KEYS.extras[6], FEATURE_KEYS.extras[7])),
    ]),
    technicalFeatures: toList(spec.get(FEATURE_KEYS.technicalFeatures[0], FEATURE_KEYS.technicalFeatures[1])),
  };

  return carsOnPage;
}

module.exports = { mapHit, buildSpecLookup, toInt, toList, toStringOrNull, parsePrice, cleanSpec, SELLER_TYPES };
