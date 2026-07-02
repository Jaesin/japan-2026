// schema.js — the SHARED Firestore data contract for the Japan 2026 portal.
//
// WHAT THIS IS
// ------------
// A single, declarative description of every Firestore collection the portal
// writes: the fields each doc may carry, which are required on a full write,
// and which string fields are constrained to a fixed set of values. Plus a
// `validate()` helper that checks a payload against that description.
//
// ONE SOURCE, THREE CONSUMERS
// ---------------------------
// This file is the single source of truth for the write shape. It is meant to
// be SHARED, never copied — copies drift and give false confidence (spec 40,
// "The safeguard: one shared schema, three consumers"):
//   1. The local MCP server (Hermes) validates every agent write against it,
//      rejecting unknown fields and bad enums — the schema-drift guard.
//   2. The app may optionally adopt it for form validation. The hook is the
//      value; wiring is a future, optional step.
//   3. firestore.rules mirrors it (by hand, not import) as the security floor.
//      When a collection's shape changes, update schema.js AND the rules.
//
// PURE ESM, ZERO DEPENDENCIES
// ---------------------------
// Imported by both the browser app and a Node-based MCP server, so this module
// is plain ECMAScript with NO imports at all — no `firebase`, no `node:*`, no
// MCP SDK. Nothing but pure JS. It is also free of top-level side effects
// (no console output, no auto-run): importing it does nothing but define
// values.
//
// THE DISCIPLINE
// --------------
// Every new feature MUST add its collection here. That single act is what keeps
// the app, the agent tools, and the rules in sync. If a collection isn't in
// COLLECTIONS, agent writes to it are rejected (unknown collection) — by design.
//
// All current feature specs have entries below.

/**
 * @typedef {'string'|'number'|'boolean'|'array'|'map'|'timestamp'} FieldType
 *
 * @typedef {Object} FieldDescriptor
 * @property {FieldType} type        The expected JS/Firestore type.
 * @property {boolean}   required    True if a full (create) write must include it.
 * @property {string[]=} enum        If set, the value must be one of these strings.
 * @property {Object=}   of          For `array`: an element descriptor or a note.
 */

/**
 * System / convention fields stamped by `src/data/mutate.js` (spec 00 + 41).
 * They are never user-supplied, but they ARE present on stored docs, so
 * validate() must tolerate them: it neither requires nor rejects them.
 *
 * `createdAt` / `updatedAt` / `createdBy` are stamped on every write helper.
 * `at` / `byUid` are the activity-feed system fields (activity docs only) — but
 * we allow them everywhere harmlessly rather than special-casing reads.
 */
export const SYSTEM_FIELDS = ['createdAt', 'updatedAt', 'createdBy', 'at', 'byUid'];

/**
 * Embedded activity object shape for itinerary docs (spec 12). These objects
 * live inside the `activities` array on each itinerary/{YYYY-MM-DD} doc; they
 * are NOT their own collection. Written by ItineraryPage as:
 *   { id, time, title, locationName, ll, notes, cost, link, researchId, done }
 * Only `title` is meaningfully required; everything else is optional and the
 * page may persist them as '' or null. Validation here is pragmatic.
 */
export const ACTIVITY_FIELDS = {
  id: { type: 'string', required: true },
  title: { type: 'string', required: true },
  time: { type: 'string', required: false },        // 'HH:MM' or '' when unscheduled
  locationName: { type: 'string', required: false },
  ll: { type: 'array', required: false, of: { type: 'number', note: '[lat, lng] or null' } },
  notes: { type: 'string', required: false },
  cost: { type: 'string', required: false },         // freeform, e.g. '¥1,200/adult'
  link: { type: 'string', required: false },
  researchId: { type: 'string', required: false },   // may be null
  done: { type: 'boolean', required: false },
};

/**
 * Per-collection field descriptors. Doc-id conventions noted where the id is
 * deterministic rather than auto-generated.
 *
 * @type {Record<string, Record<string, FieldDescriptor>>}
 */
export const COLLECTIONS = {
  // tasks/{autoId} — spec 10. NOTE: the built TasksPage uses a richer category
  // enum than early spec drafts (flights/stay/transport/activities/documents/
  // packing/budget/other), so `category` is an enum, not a freeform string.
  tasks: {
    title: { type: 'string', required: true },
    status: { type: 'string', required: true, enum: ['open', 'doing', 'done'] },
    priority: { type: 'string', required: true, enum: ['high', 'normal', 'low'] },
    assignee: { type: 'string', required: false },   // member name or 'anyone'
    category: {
      type: 'string',
      required: false,
      enum: ['flights', 'stay', 'transport', 'activities', 'documents', 'packing', 'budget', 'other'],
    },
    dueDate: { type: 'string', required: false },     // 'YYYY-MM-DD'
    notes: { type: 'string', required: false },
  },

  // research/{autoId} — spec 11.
  research: {
    title: { type: 'string', required: true },
    url: { type: 'string', required: false },
    notes: { type: 'string', required: false },
    city: { type: 'string', required: false },        // route city or 'general'
    category: {
      type: 'string',
      required: false,
      enum: ['sight', 'activity', 'food', 'shopping', 'logistics', 'daytrip'],
    },
    tags: { type: 'array', required: false, of: { type: 'string' } },
    ll: { type: 'array', required: false, of: { type: 'number', note: '[lat, lng]' } },
    cost: { type: 'string', required: false },         // freeform
    status: { type: 'string', required: false, enum: ['idea', 'shortlist', 'booked', 'rejected'] },
    stars: { type: 'map', required: false },           // { [memberName]: true }
    pinned: { type: 'boolean', required: false },
  },

  // food/{autoId} — spec 18. Shared food shortlist with per-member voting
  // (`votes` map, one toggleable vote each) and a post-visit 1–5 `rating`.
  // `researchId` back-links to a research/{id} doc when promoted (spec 11→18).
  food: {
    name: { type: 'string', required: true },
    city: { type: 'string', required: false },         // route city or 'general'
    cuisine: {
      type: 'string',
      required: false,
      enum: ['ramen', 'sushi', 'kaiseki', 'izakaya', 'sweets', 'konbini', 'other'],
    },
    meal: { type: 'array', required: false, of: { type: 'string', note: 'breakfast|lunch|dinner|snack' } },
    kidFriendly: { type: 'boolean', required: false },
    url: { type: 'string', required: false },
    ll: { type: 'array', required: false, of: { type: 'number', note: '[lat, lng]' } },
    notes: { type: 'string', required: false },
    cost: { type: 'string', required: false },         // freeform
    votes: { type: 'map', required: false },           // { [memberName]: 1 }
    status: { type: 'string', required: false, enum: ['idea', 'planned', 'visited'] },
    rating: { type: 'number', required: false },        // 1–5, set after visiting
    researchId: { type: 'string', required: false },    // back-link to research/{id}
  },

  // checkins/{autoId} — spec 21. PUBLIC-READ dispatches: "I'm here" taps that
  // feed the public poster's dispatch cards + "Last seen" map tag. `at` is the
  // server timestamp; `by` is the member name (poster shows it unattributed by
  // default). `activityId`/`dayKey` optionally back-link to the itinerary.
  checkins: {
    place: { type: 'string', required: true },
    jp: { type: 'string', required: false },           // optional Japanese label
    ll: { type: 'array', required: true, of: { type: 'number', note: '[lat, lng]' } },
    note: { type: 'string', required: false },          // dispatch line, ≤ ~140 chars
    by: { type: 'string', required: false },            // member name
    activityId: { type: 'string', required: false },    // itinerary back-link
    dayKey: { type: 'string', required: false },        // itinerary day id (YYYY-MM-DD)
    at: { type: 'timestamp', required: false },          // serverTimestamp() in payload
  },

  // postcards/{autoId} — spec 22. PUBLIC-READ photo dispatches: a member posts
  // a photo that lands on the public poster's postcard strip. `img` is a
  // client-resized/compressed JPEG stored as a data-URL string (Option A — no
  // Firebase Storage); re-encoding via canvas strips EXIF/GPS. Same place/jp/ll
  // shapes as checkins. `at` is the server timestamp; `by` is the member name.
  postcards: {
    img: { type: 'string', required: true },            // data-URL JPEG (resized/compressed)
    caption: { type: 'string', required: false },        // one-line caption
    place: { type: 'string', required: false },          // optional place label
    jp: { type: 'string', required: false },             // optional Japanese label
    ll: { type: 'array', required: false, of: { type: 'number', note: '[lat, lng]' } },
    by: { type: 'string', required: false },             // member name
    at: { type: 'timestamp', required: false },          // serverTimestamp() in payload
  },

  // itinerary/{YYYY-MM-DD} — spec 12. Deterministic doc id = the trip date.
  // `activities` is an ordered array of the ACTIVITY_FIELDS shape, read/written
  // as a whole. validate() spot-checks each activity object's keys.
  itinerary: {
    dayNum: { type: 'number', required: true },
    city: { type: 'string', required: false },
    label: { type: 'string', required: false },
    activities: { type: 'array', required: false, of: { type: 'map', note: 'see ACTIVITY_FIELDS' } },
  },

  // accommodations/{autoId} — spec 13.
  accommodations: {
    name: { type: 'string', required: true },
    city: { type: 'string', required: false },
    nights: { type: 'array', required: false, of: { type: 'string', note: 'YYYY-MM-DD' } },
    address: { type: 'string', required: false },
    ll: { type: 'array', required: false, of: { type: 'number', note: '[lat, lng]' } },
    checkInTime: { type: 'string', required: false },
    checkOutTime: { type: 'string', required: false },
    bookingRef: { type: 'string', required: false },
    bookingUrl: { type: 'string', required: false },
    hostContact: { type: 'string', required: false },
    accessNotes: { type: 'string', required: false },
    status: { type: 'string', required: false, enum: ['idea', 'booked'] },
    costJPY: { type: 'number', required: false },
  },

  // transport/{autoId} — spec 16. costJPY/costUSD are display-read by the page
  // and may be written by seed/import; kept here so they're not rejected.
  transport: {
    kind: { type: 'string', required: true, enum: ['flight', 'train', 'bus', 'ferry', 'transfer-note'] },
    date: { type: 'string', required: true },          // 'YYYY-MM-DD'
    depTime: { type: 'string', required: false },
    arrTime: { type: 'string', required: false },
    from: { type: 'string', required: false },
    to: { type: 'string', required: false },
    carrier: { type: 'string', required: false },
    bookingRef: { type: 'string', required: false },
    seats: { type: 'string', required: false },
    status: { type: 'string', required: false, enum: ['idea', 'booked'] },
    notes: { type: 'string', required: false },
    costJPY: { type: 'number', required: false },
    costUSD: { type: 'number', required: false },
    fxRate: { type: 'number', required: false, note: 'JPY per USD at time of payment' },
  },

  // budget/{autoId} — spec 14. Amounts canonical in JPY; USD optional, with the
  // JPY/USD rate used stamped alongside so historical entries stay accurate
  // even as the live rate moves. `item` and `date` are optional (estimates
  // carry no date).
  budget: {
    item: { type: 'string', required: false },
    category: {
      type: 'string',
      required: true,
      enum: ['flights', 'stay', 'transport', 'food', 'activities', 'shopping', 'other'],
    },
    kind: { type: 'string', required: true, enum: ['estimate', 'actual'] },
    amountJPY: { type: 'number', required: false },
    amountUSD: { type: 'number', required: false },
    fxRate: { type: 'number', required: false, note: 'JPY per USD at time of payment' },
    date: { type: 'string', required: false },         // 'YYYY-MM-DD' (actuals)
    paidBy: { type: 'string', required: false },
    notes: { type: 'string', required: false },
  },

  // packing/{autoId} — spec 15.
  packing: {
    person: { type: 'string', required: true },        // member name or 'shared'
    item: { type: 'string', required: true },
    category: {
      type: 'string',
      required: true,
      enum: ['clothing', 'toiletries', 'electronics', 'documents', 'kids', 'other'],
    },
    qty: { type: 'number', required: false },
    packed: { type: 'boolean', required: false },
    sortKey: { type: 'number', required: false },
  },

  // documents/{autoId} — spec 17. Stores REFERENCES, never secrets. `fields` is
  // a free-form label→value map.
  documents: {
    title: { type: 'string', required: true },
    category: {
      type: 'string',
      required: true,
      enum: ['passports', 'insurance', 'bookings', 'contacts', 'checklist'],
    },
    fields: { type: 'map', required: false },
    url: { type: 'string', required: false },
    notes: { type: 'string', required: false },
  },

  // phrases/{autoId} — spec 19.
  phrases: {
    category: {
      type: 'string',
      required: true,
      enum: ['show-card', 'etiquette', 'logistics', 'numbers', 'custom'],
    },
    japanese: { type: 'string', required: false },
    romaji: { type: 'string', required: false },
    english: { type: 'string', required: true },
    sortKey: { type: 'number', required: false },
    pinned: { type: 'boolean', required: false },
  },

  // journal/{YYYY-MM-DD--name} — spec 23. Deterministic id = one entry per
  // member per day (natural upsert).
  journal: {
    date: { type: 'string', required: true },          // 'YYYY-MM-DD'
    by: { type: 'string', required: true },             // member name
    rating: { type: 'number', required: true },         // 1–5
    highlight: { type: 'string', required: false },
    note: { type: 'string', required: false },
  },

  // activity/{autoId} — spec 41. Opt-in feed entries. `at`/`byUid` are system
  // fields (see SYSTEM_FIELDS); `by` is an optional author override (e.g.
  // 'hermes').
  activity: {
    verb: { type: 'string', required: true, enum: ['added', 'updated', 'completed', 'removed'] },
    target: { type: 'string', required: true },         // collection name
    title: { type: 'string', required: true },          // precomputed human line
    link: { type: 'string', required: false },          // portal hash route
    by: { type: 'string', required: false },
  },

  // members/{uid} — spec 04. Device registrations: one doc per anonymous user
  // uid, created when a join-link flow completes. `name` is the member's given
  // name, `inviteToken` is the invites/{token} that created them, and
  // `joinedAt` is a Firestore timestamp.
  members: {
    name: { type: 'string', required: true },
    inviteToken: { type: 'string', required: false },
    joinedAt: { type: 'timestamp', required: false },
  },

  // invites/{token} — spec 04. Capability-link tokens minted by a member from
  // Settings → Users. `label` is a human short-name for who/why; `memberName`
  // is set for device invites (pre-fills the name on the join page) and absent
  // for generic user invites (join page shows a name form).
  invites: {
    label: { type: 'string', required: true },
    memberName: { type: 'string', required: false },
  },
};

/**
 * @param {string} collection
 * @returns {boolean} true if `collection` has a descriptor in COLLECTIONS.
 */
export function isKnownCollection(collection) {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, collection);
}

/**
 * Field descriptors for a collection.
 * @param {string} collection
 * @returns {Record<string, FieldDescriptor>|null} the field map, or null if unknown.
 */
export function fieldsFor(collection) {
  return isKnownCollection(collection) ? COLLECTIONS[collection] : null;
}

/* ---- type checks (lenient — this is a contract guard, not a security boundary) */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Lenient: accept Date, epoch number, or any object (Firestore Timestamp/sentinel). */
function isTimestampLike(v) {
  return v instanceof Date || typeof v === 'number' || isPlainObject(v);
}

/**
 * Does `value` satisfy `type`? Returns true/false; callers compose the message.
 * @param {FieldType} type
 * @param {*} value
 */
function typeOk(type, value) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'map': return isPlainObject(value);
    case 'timestamp': return isTimestampLike(value);
    default: return false;
  }
}

/**
 * Validate one embedded itinerary activity object against ACTIVITY_FIELDS.
 * Pragmatic: required keys must be present + correctly typed; present optional
 * keys are type-checked; null is tolerated for any optional key; unknown keys
 * are flagged.
 * @param {*} act
 * @param {number} index  position in the activities array (for messages)
 * @returns {string[]} errors
 */
function validateActivity(act, index) {
  const where = `activities[${index}]`;
  if (!isPlainObject(act)) return [`${where}: expected an object`];
  const errors = [];
  for (const [key, desc] of Object.entries(ACTIVITY_FIELDS)) {
    const present = Object.prototype.hasOwnProperty.call(act, key);
    const value = act[key];
    if (desc.required && (!present || value == null)) {
      errors.push(`${where}.${key}: required`);
      continue;
    }
    if (present && value != null && !typeOk(desc.type, value)) {
      errors.push(`${where}.${key}: expected ${desc.type}`);
    }
  }
  for (const key of Object.keys(act)) {
    if (!Object.prototype.hasOwnProperty.call(ACTIVITY_FIELDS, key)) {
      errors.push(`${where}.${key}: unknown field`);
    }
  }
  return errors;
}

/**
 * Validate a write payload against a collection's schema.
 *
 * Checks performed, collecting ALL errors (never bails on the first):
 *  - Unknown collection → single error.
 *  - Unknown field (not in the schema and not a SYSTEM_FIELD) → error. This is
 *    the schema-drift guard.
 *  - Required fields (when `partial` is false) must be present and non-null.
 *  - Each present field is type-checked against its descriptor.
 *  - Enum-constrained fields must hold an allowed value.
 *  - For `itinerary`, each embedded `activities` entry is spot-checked against
 *    ACTIVITY_FIELDS.
 *
 * @param {string} collection                  Collection name (e.g. 'tasks').
 * @param {Object} payload                     The data to be written.
 * @param {{ partial?: boolean }} [options]    partial=true skips required checks
 *                                             (use for patch/update writes).
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(collection, payload, { partial = false } = {}) {
  if (!isKnownCollection(collection)) {
    return { valid: false, errors: [`unknown collection: ${collection}`] };
  }

  const errors = [];
  const fields = COLLECTIONS[collection];

  if (!isPlainObject(payload)) {
    return { valid: false, errors: [`${collection}: payload must be an object`] };
  }

  // Unknown-field rejection (schema-drift guard).
  for (const key of Object.keys(payload)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) continue;
    if (SYSTEM_FIELDS.includes(key)) continue;
    errors.push(`${collection}.${key}: unknown field`);
  }

  // Required-field check (full writes only).
  if (!partial) {
    for (const [key, desc] of Object.entries(fields)) {
      if (!desc.required) continue;
      const present = Object.prototype.hasOwnProperty.call(payload, key);
      if (!present || payload[key] == null) {
        errors.push(`${collection}.${key}: required`);
      }
    }
  }

  // Type + enum checks for whatever IS present (null skips — clearing a field).
  for (const [key, desc] of Object.entries(fields)) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = payload[key];
    if (value == null) continue;

    if (!typeOk(desc.type, value)) {
      errors.push(`${collection}.${key}: expected ${desc.type}`);
      continue; // a wrong type makes enum/element checks meaningless
    }

    if (desc.enum && !desc.enum.includes(value)) {
      errors.push(`${collection}.${key}: "${value}" not in [${desc.enum.join(', ')}]`);
    }

    // Spot-check embedded itinerary activities.
    if (collection === 'itinerary' && key === 'activities') {
      value.forEach((act, i) => errors.push(...validateActivity(act, i)));
    }
  }

  return { valid: errors.length === 0, errors };
}
