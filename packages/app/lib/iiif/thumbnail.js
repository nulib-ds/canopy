'use strict';

// Note: Do not shorten naming conventions here. Keep things readable and
// semantic. This module deliberately uses full words like "thumbnail" instead
// of abbreviations like "thumb".

// Helper for resolving a representative thumbnail for an IIIF resource.
// Uses Clover's thumbnail helpers (`@nulib/clover/helpers`) to choose an appropriate size.

function arrayify(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeBodyType(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeBodyType(entry);
      if (normalized) return normalized;
    }
  }
  return '';
}

function isImageBodyType(value) {
  if (!value) return false;
  try {
    return /image/i.test(String(value));
  } catch (_) {
    return false;
  }
}

function normalizeImageServiceCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const id = candidate.id || candidate['@id'];
  if (!id) return null;
  const typeValue = candidate.type || candidate['@type'] || '';
  const type = Array.isArray(typeValue) ? typeValue[0] : typeValue;
  const profileValue = candidate.profile || candidate['@profile'];
  const profile = Array.isArray(profileValue)
    ? profileValue.find((p) => typeof p === 'string')
    : profileValue;
  const preferredFormats = arrayify(candidate.preferredFormats)
    .map((val) => String(val || '').toLowerCase())
    .filter(Boolean);
  const formats = arrayify(candidate.formats || candidate.supportedFormats)
    .map((val) => String(val || '').toLowerCase())
    .filter(Boolean);
  const qualities = arrayify(candidate.qualities)
    .map((val) => String(val || '').toLowerCase())
    .filter(Boolean);
  return {
    id: String(id),
    type: type ? String(type) : '',
    profile: profile ? String(profile) : '',
    formats,
    preferredFormats,
    qualities,
  };
}

function isLevel0Profile(profile) {
  if (!profile) return false;
  try {
    return /level0/i.test(String(profile));
  } catch (_) {
    return false;
  }
}

function isLevel0Service(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate.profile && isLevel0Profile(candidate.profile)) return true;
  const normalized = normalizeImageServiceCandidate(candidate);
  if (!normalized) return false;
  return Boolean(normalized.profile && isLevel0Profile(normalized.profile));
}

function isIiifImageService(candidate) {
  if (!candidate) return false;
  const {type, profile} = candidate;
  if (type && /ImageService/i.test(type)) return true;
  if (profile && /iiif\.io\/api\/image/i.test(profile)) return true;
  return false;
}

function extractImageService(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const direct = normalizeImageServiceCandidate(value);
  if (isIiifImageService(direct)) return direct;

  const branches = [
    value.service,
    value.services,
    value.thumbnail,
    value.thumbnails,
    value.body,
  ];
  for (const branch of branches) {
    const list = arrayify(branch);
    for (const entry of list) {
      const svc = extractImageService(entry, seen);
      if (svc) return svc;
    }
  }
  return null;
}

function normalizeImagePayload(body, canvas) {
  if (!body || typeof body !== 'object') return null;
  const id = body.id || body['@id'];
  const bodyType = normalizeBodyType(body.type || body['@type']);
  const width =
    typeof body.width === 'number'
      ? body.width
      : typeof (canvas && canvas.width) === 'number'
        ? canvas.width
        : undefined;
  const height =
    typeof body.height === 'number'
      ? body.height
      : typeof (canvas && canvas.height) === 'number'
        ? canvas.height
        : undefined;
  const service = extractImageService(body);
  return {
    id: id ? String(id) : '',
    width,
    height,
    service: service || undefined,
    bodyType: bodyType || undefined,
    isImageBody: Boolean(bodyType && isImageBodyType(bodyType)),
  };
}

function inspectCanvasForImage(canvas) {
  if (!canvas || typeof canvas !== 'object') return null;
  const annotationPages = arrayify(canvas.items || canvas.annotations);
  for (const page of annotationPages) {
    if (!page || typeof page !== 'object') continue;
    const annotations = arrayify(page.items || page.annotations);
    for (const annotation of annotations) {
      if (!annotation || typeof annotation !== 'object') continue;
      const bodies = arrayify(annotation.body);
      for (const body of bodies) {
        const payload = normalizeImagePayload(body, canvas);
        if (payload && (payload.id || payload.service)) return payload;
      }
    }
  }
  if (canvas.placeholderCanvas) {
    const placeholderPayload = inspectCanvasForImage(canvas.placeholderCanvas);
    if (placeholderPayload) return placeholderPayload;
  }
  const thumbnails = arrayify(canvas.thumbnail);
  for (const thumb of thumbnails) {
    const payload = normalizeImagePayload(thumb, canvas);
    if (payload && (payload.id || payload.service)) return payload;
  }
  return null;
}

function findPrimaryCanvasImage(resource) {
  try {
    const canvases = arrayify(resource && resource.items);
    if (!canvases.length) return null;
    for (const canvas of canvases) {
      const payload = inspectCanvasForImage(canvas);
      if (payload) return payload;
    }
  } catch (_) {}
  return null;
}

function findCanvasImageService(resource) {
  const payload = findPrimaryCanvasImage(resource);
  return payload && payload.service ? payload.service : null;
}

function normalizeServiceBaseId(id) {
  if (!id) return '';
  try {
    let cleaned = String(id).trim();
    cleaned = cleaned.replace(/\/info\.json$/i, '');
    cleaned = cleaned.replace(/\/$/, '');
    return cleaned;
  } catch (_) {
    return String(id || '');
  }
}

function selectServiceFormat(candidate) {
  if (!candidate) return 'jpg';
  const formats = Array.isArray(candidate.formats)
    ? candidate.formats
    : Array.isArray(candidate.preferredFormats)
      ? candidate.preferredFormats
      : [];
  const prioritized = ['jpg', 'jpeg', 'png', 'webp'];
  const lower = formats.map((f) => String(f || '').toLowerCase());
  for (const fmt of prioritized) {
    if (lower.includes(fmt)) return fmt === 'jpeg' ? 'jpg' : fmt;
  }
  return 'jpg';
}

function selectServiceQuality(candidate) {
  if (!candidate) return 'default';
  const {qualities = [], type = '', profile = ''} = candidate;
  if (qualities.includes('default')) return 'default';
  if (qualities.includes('native')) return 'native';
  if (/ImageService3/i.test(type)) return 'default';
  if (/ImageService2/i.test(type) || /ImageService1/i.test(type)) {
    if (/level0/i.test(profile)) return 'default';
    return 'default';
  }
  if (/iiif\.io\/api\/image/i.test(profile)) return 'default';
  return 'default';
}

function buildIiifImageUrlFromNormalizedService(service, preferredSize = 800) {
  if (!service || !isIiifImageService(service)) return '';
  if (isLevel0Profile(service.profile)) return '';
  const baseId = normalizeServiceBaseId(service.id);
  if (!baseId) return '';
  const size = preferredSize && preferredSize > 0 ? preferredSize : 800;
  const quality = selectServiceQuality(service);
  const format = selectServiceFormat(service);
  return `${baseId}/full/!${size},${size}/0/${quality}.${format}`;
}

function buildIiifImageUrlFromService(service, preferredSize = 800) {
  const normalized = normalizeImageServiceCandidate(service);
  if (!normalized) return '';
  return buildIiifImageUrlFromNormalizedService(normalized, preferredSize);
}

function buildIiifImageUrlForDimensions(service, width = 1200, height = 630) {
  const normalized = normalizeImageServiceCandidate(service);
  if (!normalized || !isIiifImageService(normalized)) return '';
  if (isLevel0Profile(normalized.profile)) return '';
  const baseId = normalizeServiceBaseId(normalized.id);
  if (!baseId) return '';
  const safeWidth = Math.max(1, Math.floor(Number(width) || 0));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 0));
  const quality = selectServiceQuality(normalized);
  const format = selectServiceFormat(normalized);
  return `${baseId}/full/!${safeWidth},${safeHeight}/0/${quality}.${format}`;
}

function buildIiifImageSrcset(service, steps = [360, 640, 960, 1280, 1600]) {
  const normalized = normalizeImageServiceCandidate(service);
  if (!normalized || !isIiifImageService(normalized)) return '';
  if (isLevel0Profile(normalized.profile)) return '';
  const uniqueSteps = Array.from(
    new Set(
      (Array.isArray(steps) ? steps : [])
        .map((value) => Number(value) || 0)
        .filter((value) => value > 0)
        .sort((a, b) => a - b)
    )
  );
  if (!uniqueSteps.length) return '';
  const entries = uniqueSteps
    .map((width) => {
      const url = buildIiifImageUrlFromNormalizedService(normalized, width);
      return url ? `${url} ${width}w` : '';
    })
    .filter(Boolean);
  return entries.join(', ');
}

async function getRepresentativeImage(resource, preferredSize = 1200, unsafe = false) {
  // Fast path: if resource already contains a thumbnail, return it without any helper work
  try {
    const t = resource && resource.thumbnail;
    if (t) {
      const first = Array.isArray(t) ? t[0] : t;
      if (first && (first.id || first['@id'])) {
        const canvasImage = findPrimaryCanvasImage(resource);
        const service =
          extractImageService(first) ||
          (canvasImage && canvasImage.service) ||
          undefined;
        return {
          id: String(first.id || first['@id']),
          width:
            typeof first.width === 'number'
              ? first.width
              : canvasImage && typeof canvasImage.width === 'number'
                ? canvasImage.width
                : undefined,
          height:
            typeof first.height === 'number'
              ? first.height
              : canvasImage && typeof canvasImage.height === 'number'
                ? canvasImage.height
                : undefined,
          service: service || undefined,
        };
      }
    }
  } catch (_) {}

  // Avoid potentially long-running network calls in safe mode
  if (!unsafe) return null;

  // Unsafe mode: Clover's own thumbnail helpers (`@nulib/clover/helpers`, which need no
  // React), asking the image service for a size it offers, with a timeout so builds never
  // hang.
  try {
    const clover = await import('@nulib/clover/helpers');
    const task = (async () => {
      const source = clover.thumbnailSource(await clover.toPresentation4(resource));
      const url = source ? await clover.resolveThumbnail(source, preferredSize) : undefined;
      return url ? { id: url } : null;
    })();
    const timeoutMs = Number(process.env.CANOPY_THUMB_TIMEOUT || 2000);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const result = await Promise.race([task, timeout]);
    if (!result) return null;
    const id = String(result.id || '');
    const width = undefined;
    const height = undefined;
    const canvasImage = findPrimaryCanvasImage(resource);
    const service =
      extractImageService(result) ||
      extractImageService(resource) ||
      (canvasImage && canvasImage.service);
    return id
      ? {
          id,
          width:
            width != null
              ? width
              : canvasImage && typeof canvasImage.width === 'number'
                ? canvasImage.width
                : undefined,
          height:
            height != null
              ? height
              : canvasImage && typeof canvasImage.height === 'number'
                ? canvasImage.height
                : undefined,
          service: service || undefined,
        }
      : null;
  } catch (_) {
    return null;
  }
}

async function getThumbnail(resource, preferredSize = 1200, unsafe = false) {
  // Prefer embedded thumbnail with available dimensions
  try {
    const t = resource && resource.thumbnail;
    const first = Array.isArray(t) ? t[0] : t;
    if (first && (first.id || first['@id'])) {
      const url = String(first.id || first['@id']);
      const width = typeof first.width === 'number' ? first.width : undefined;
      const height = typeof first.height === 'number' ? first.height : undefined;
      return { url, width, height };
    }
  } catch (_) {}
  // Fall back to helper (unsafe mode only) with timeout
  try {
    const rep = await getRepresentativeImage(resource, preferredSize, unsafe);
    if (rep && (rep.id || rep['@id'])) {
      return {
        url: String(rep.id || rep['@id']),
        width: typeof rep.width === 'number' ? rep.width : undefined,
        height: typeof rep.height === 'number' ? rep.height : undefined,
      };
    }
  } catch (_) {}
  return { url: '' };
}

async function getThumbnailUrl(resource, preferredSize = 1200, unsafe = false) {
  const res = await getThumbnail(resource, preferredSize, unsafe);
  return res && res.url ? String(res.url) : '';
}

module.exports = {
  getRepresentativeImage,
  getThumbnail,
  getThumbnailUrl,
  buildIiifImageUrlFromService,
  buildIiifImageUrlForDimensions,
  findPrimaryCanvasImage,
  buildIiifImageSrcset,
  isLevel0Service,
};
