// postcardImage.js — client-side image resize + JPEG compression for postcards
// (spec 22, Option A: the photo is stored as a data-URL string inside the
// Firestore doc — no Firebase Storage).
//
// Pipeline: decode the file → draw onto a <canvas> resized so the longest edge
// is ≤ maxEdge → export `toDataURL('image/jpeg', q)`. Re-encoding through the
// canvas STRIPS all EXIF metadata, including GPS — a privacy win we surface in
// the UI. EXIF *orientation* is also dropped, so a portrait photo would come
// out sideways; we honour it via `createImageBitmap(file, { imageOrientation:
// 'from-image' })` when available, falling back to a plain <img> decode.
//
// Size control: we target a small file but HARD-cap the stored string below
// `maxBytes`. If the first export is over, we step quality down, then dimensions
// down, until it fits or we give up (throws { code: 'too-large' }).

const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4];

/** Decode a File into something drawable, honouring EXIF orientation. */
async function decode(file) {
  // Preferred path: ImageBitmap with orientation baked in. Width/height already
  // reflect the corrected orientation, so drawImage gives an upright result.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() };
    } catch {
      /* fall through to the <img> path (older Safari, unsupported option) */
    }
  }
  // Fallback: object-URL into an <img>. No orientation correction here, but it
  // keeps the feature working everywhere; modern mobile browsers take the path
  // above.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode-failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      close: () => {},
    };
  } finally {
    // Revoke after decode; the bitmap/canvas no longer needs the URL.
    URL.revokeObjectURL(url);
  }
}

function fittedSize(w, h, maxEdge) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const scale = maxEdge / longest;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

function drawToDataUrl(source, w, h, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Resize + compress `file` to a JPEG data-URL.
 * @param {File} file
 * @param {{ maxEdge?: number, maxBytes?: number }} [opts]
 * @returns {Promise<string>} a data:image/jpeg;base64,… string under maxBytes
 * @throws {Error} { code: 'too-large' } if it can't be squeezed under the cap
 */
export async function fileToPostcardJpeg(file, opts = {}) {
  const maxEdge = opts.maxEdge || 1280;
  const maxBytes = opts.maxBytes || 700000;

  const decoded = await decode(file);
  try {
    let { w, h } = fittedSize(decoded.width, decoded.height, maxEdge);

    // First pass: step quality down at the target dimensions.
    for (const q of QUALITY_STEPS) {
      const url = drawToDataUrl(decoded.source, w, h, q);
      if (url.length < maxBytes) return url;
    }

    // Still too big: shrink dimensions ~15% per round (keep lowest quality).
    for (let i = 0; i < 6; i += 1) {
      w = Math.max(1, Math.round(w * 0.85));
      h = Math.max(1, Math.round(h * 0.85));
      const url = drawToDataUrl(decoded.source, w, h, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
      if (url.length < maxBytes) return url;
      if (w <= 320 || h <= 320) break;
    }

    const err = new Error('Image too large after compression');
    err.code = 'too-large';
    throw err;
  } finally {
    decoded.close();
  }
}
