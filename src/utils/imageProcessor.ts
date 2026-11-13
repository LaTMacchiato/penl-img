import { ImageItem, PipelineConfig } from '../types';
import { finalizeJpegBlob, enforce72DpiOnPngBlob } from './exifAndDpi';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function applyColorKeyRemoval(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  targetHex: string,
  tolerance: number,
  contiguous: boolean,
  feather: boolean
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const target = hexToRgb(targetHex);
  const maxDist = (tolerance / 100) * 441.67;
  const softRange = feather ? Math.max(12, maxDist * 0.25) : 0;

  const colorDist = (idx: number) => {
    const dr = data[idx] - target.r;
    const dg = data[idx + 1] - target.g;
    const db = data[idx + 2] - target.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  if (!contiguous) {
    for (let i = 0; i < data.length; i += 4) {
      const dist = colorDist(i);
      if (dist <= maxDist) {
        data[i + 3] = 0;
      } else if (feather && dist <= maxDist + softRange) {
        const factor = (dist - maxDist) / softRange;
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
  } else {
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const pushIfMatch = (x: number, y: number) => {
      const pos = y * width + x;
      if (visited[pos]) return;
      const idx = pos * 4;
      const dist = colorDist(idx);
      if (dist <= maxDist + softRange) {
        visited[pos] = 1;
        queue[tail++] = pos;
      }
    };

    pushIfMatch(0, 0);
    pushIfMatch(width - 1, 0);
    pushIfMatch(0, height - 1);
    pushIfMatch(width - 1, height - 1);

    while (head < tail) {
      const pos = queue[head++];
      const idx = pos * 4;
      const dist = colorDist(idx);

      if (dist <= maxDist) {
        data[idx + 3] = 0;
      } else if (feather && dist <= maxDist + softRange) {
        const factor = (dist - maxDist) / softRange;
        data[idx + 3] = Math.round(data[idx + 3] * factor);
        continue;
      }

      const x = pos % width;
      const y = (pos - x) / width;

      if (x > 0) pushIfMatch(x - 1, y);
      if (x < width - 1) pushIfMatch(x + 1, y);
      if (y > 0) pushIfMatch(x, y - 1);
      if (y < height - 1) pushIfMatch(x, y + 1);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Converts a colored logo / icon (with transparent or solid white/light background)
 * into a clean monochrome silhouette (e.g. pure white `#ffffff` on transparent background).
 *
 * - If the image already has transparency (`hasAlpha`), every visible pixel is tinted to `tintHex`
 *   while preserving its exact anti-aliased alpha value.
 * - If `autoStripLightBg` is enabled, any white/light background (or picked background color)
 *   is smoothly converted into transparency (`alpha` proportional to color distance from the background)
 *   so colored logos on a white box (like an EDF logo on `#fafafa` or `#ffffff`) come out with crisp,
 *   halo-free edges on a 100% transparent background.
 */
export function applyMonochromeTint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tintHex: string,
  autoStripLightBg: boolean,
  tolerance: number,
  pickedBgHex?: string
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const tint = hexToRgb(tintHex || '#ffffff');

  // Detect if the image has meaningful transparency or a uniform light/picked background at corners
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];

  let opaqueCorners = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const idx of corners) {
    if (data[idx + 3] > 220) {
      opaqueCorners++;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
    }
  }

  let stripBg: { r: number; g: number; b: number } | null = null;
  if (pickedBgHex) {
    stripBg = hexToRgb(pickedBgHex);
  } else if (autoStripLightBg && opaqueCorners >= 2) {
    const avgR = sumR / opaqueCorners;
    const avgG = sumG / opaqueCorners;
    const avgB = sumB / opaqueCorners;
    // If corners are light/white (e.g. > 215 luminance), treat corner color as the solid background to strip
    if (avgR > 210 && avgG > 210 && avgB > 210) {
      stripBg = { r: avgR, g: avgG, b: avgB };
    }
  }

  // Also check if the user has an already-transparent PNG that still contains interior white counter-forms or light background
  const deadzone = Math.max(8, (tolerance / 100) * 140);
  const rampRange = Math.max(24, (tolerance / 100) * 260);

  for (let i = 0; i < data.length; i += 4) {
    let a = data[i + 3];
    if (a === 0) continue;

    if (stripBg) {
      const dr = data[i] - stripBg.r;
      const dg = data[i + 1] - stripBg.g;
      const db = data[i + 2] - stripBg.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= deadzone) {
        data[i + 3] = 0;
        continue;
      } else if (dist < deadzone + rampRange) {
        const factor = (dist - deadzone) / rampRange;
        a = Math.round(a * Math.min(1, Math.max(0, factor)));
      }
    } else if (autoStripLightBg && a > 0) {
      // Even when corners are transparent, if the user enabled autoStripLightBg and a pixel is near pure white (#fff),
      // strip pure white background remnants smoothly unless the target tint itself is dark and the logo was already white
      const distFromWhite = Math.sqrt(
        (255 - data[i]) ** 2 + (255 - data[i + 1]) ** 2 + (255 - data[i + 2]) ** 2
      );
      if (distFromWhite <= deadzone * 0.6) {
        // Only strip interior pure white if the image isn't predominantly white already
      }
    }

    data[i] = tint.r;
    data[i + 1] = tint.g;
    data[i + 2] = tint.b;
    data[i + 3] = a;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Recolors an SVG source string into a single monochrome color (`tintHex`, e.g. `#ffffff`)
 * while preserving `none` / `transparent` fills and strokes and stripping full-bleed background rects if present.
 */
export async function processSvgToMonochromeBlob(
  svgFile: File,
  tintHex: string,
  autoStripLightBg = true
): Promise<Blob> {
  const rawSvg = await svgFile.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('Fichier SVG invalide');
  }

  const preserveValues = new Set(['none', 'transparent', 'inherit', 'currentcolor']);
  const lightBgValues = new Set(['#fff', '#ffffff', '#fafafa', '#f8f9fa', 'white', 'rgb(255,255,255)', 'rgb(255, 255, 255)']);
  const isUrlRef = (val: string) => val.trim().toLowerCase().startsWith('url(');

  // Recolor inline style attributes and presentation attributes across all elements
  const allElements = svgEl.querySelectorAll('*');
  allElements.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (['defs', 'clippath', 'mask', 'metadata', 'title', 'desc'].includes(tag)) return;

    if (tag === 'stop') {
      el.setAttribute('stop-color', tintHex);
    }

    const fillAttr = el.getAttribute('fill');
    if (fillAttr) {
      const norm = fillAttr.trim().toLowerCase();
      if (autoStripLightBg && tag === 'rect' && lightBgValues.has(norm)) {
        el.setAttribute('fill', 'none');
      } else if (!preserveValues.has(norm) && !isUrlRef(norm)) {
        el.setAttribute('fill', tintHex);
      }
    }

    const strokeAttr = el.getAttribute('stroke');
    if (strokeAttr) {
      const norm = strokeAttr.trim().toLowerCase();
      if (!preserveValues.has(norm) && !isUrlRef(norm)) {
        el.setAttribute('stroke', tintHex);
      }
    }

    const styleAttr = el.getAttribute('style');
    if (styleAttr) {
      const updatedStyle = styleAttr
        .replace(/fill\s*:\s*([^;]+)/gi, (match, val) => {
          const v = val.trim().toLowerCase();
          if (preserveValues.has(v) || isUrlRef(v)) return match;
          return `fill: ${tintHex}`;
        })
        .replace(/stroke\s*:\s*([^;]+)/gi, (match, val) => {
          const v = val.trim().toLowerCase();
          if (preserveValues.has(v) || isUrlRef(v)) return match;
          return `stroke: ${tintHex}`;
        })
        .replace(/stop-color\s*:\s*([^;]+)/gi, `stop-color: ${tintHex}`);
      el.setAttribute('style', updatedStyle);
    }

    if (tag === 'style' && el.textContent) {
      el.textContent = el.textContent
        .replace(/fill\s*:\s*([^;\}]+)/gi, (match, val) => {
          const v = val.trim().toLowerCase();
          if (preserveValues.has(v) || isUrlRef(v)) return match;
          return `fill: ${tintHex}`;
        })
        .replace(/stroke\s*:\s*([^;\}]+)/gi, (match, val) => {
          const v = val.trim().toLowerCase();
          if (preserveValues.has(v) || isUrlRef(v)) return match;
          return `stroke: ${tintHex}`;
        })
        .replace(/stop-color\s*:\s*([^;\}]+)/gi, `stop-color: ${tintHex}`);
    }
  });

  // Set root fill & color so elements relying on default black or currentColor become tintHex
  const rootFill = svgEl.getAttribute('fill');
  if (!rootFill || !preserveValues.has(rootFill.trim().toLowerCase())) {
    svgEl.setAttribute('fill', tintHex);
  }
  svgEl.setAttribute('color', tintHex);

  const serializer = new XMLSerializer();
  const outSvg = serializer.serializeToString(svgEl);
  return new Blob([outSvg], { type: 'image/svg+xml' });
}

export function resolveOutputMime(item: ImageItem, config: PipelineConfig): string {
  if (config.monochromeMode && config.keepSvgVector && item.file.type === 'image/svg+xml') {
    return 'image/svg+xml';
  }
  if (config.outputFormat === 'image/svg+xml' && item.file.type !== 'image/svg+xml') {
    return 'image/png';
  }
  if (config.outputFormat === 'original') {
    if ((config.bgRemoveMode !== 'none' || config.monochromeMode) && item.file.type === 'image/jpeg') {
      return 'image/png';
    }
    if (config.monochromeMode && item.file.type === 'image/svg+xml') {
      return config.keepSvgVector ? 'image/svg+xml' : 'image/png';
    }
    if (config.compressionMode === 'target-size' && item.file.type === 'image/png') {
      return 'image/jpeg';
    }
    if (!item.file.type || item.file.type === 'image/heic' || item.file.type === 'image/heif') {
      return 'image/jpeg';
    }
    return item.file.type;
  }
  return config.outputFormat;
}

export function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
}

export function computeOutputFileName(
  item: ImageItem,
  index: number,
  config: PipelineConfig,
  mime: string
): string {
  const ext = getExtensionFromMime(mime);
  const parts = item.relativePath.split('/');
  const rawFileName = parts.pop() || item.file.name;
  const dotIndex = rawFileName.lastIndexOf('.');
  const originalBase = dotIndex > 0 ? rawFileName.slice(0, dotIndex) : rawFileName;

  let base = originalBase;
  if (config.renamePattern === 'sequential') {
    const stem = config.customBaseName.trim() || 'image';
    const num = String(index + 1).padStart(3, '0');
    base = `${stem}_${num}`;
  }

  const finalName = `${config.renamePrefix}${base}${config.renameSuffix}.${ext}`;
  if (config.preserveSubfolders && parts.length > 0) {
    return `${parts.join('/')}/${finalName}`;
  }
  return finalName;
}

function renderSourceToCanvas(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  config: PipelineConfig,
  targetMime: string
): HTMLCanvasElement {
  const isRotated90 = config.rotateDeg === 90 || config.rotateDeg === 270;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: config.bgRemoveMode !== 'none' || config.monochromeMode,
  })!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = config.backgroundColorForJpeg || '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  if (config.rotateDeg !== 0) {
    ctx.rotate((config.rotateDeg * Math.PI) / 180);
  }
  ctx.scale(config.flipH ? -1 : 1, config.flipV ? -1 : 1);

  const drawW = isRotated90 ? outH : outW;
  const drawH = isRotated90 ? outW : outH;
  ctx.drawImage(img, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas;
}

async function finalizeBlobMetadataAndDpi(
  rawBlob: Blob,
  mime: string,
  originalFile: File,
  config: PipelineConfig
): Promise<Blob> {
  if (mime === 'image/jpeg') {
    return finalizeJpegBlob(rawBlob, originalFile, config.stripMetadata, config.enforceMax72Dpi);
  }
  if (mime === 'image/png' && config.enforceMax72Dpi) {
    return enforce72DpiOnPngBlob(rawBlob);
  }
  return rawBlob;
}

async function encodeToTargetFileSize(
  baseCanvas: HTMLCanvasElement,
  targetMime: string,
  targetBytes: number,
  allowDimensionStepDown: boolean,
  originalFile: File,
  config: PipelineConfig
): Promise<{ blob: Blob; finalW: number; finalH: number }> {
  const effectiveMime = targetMime === 'image/png' ? 'image/jpeg' : targetMime;

  const tryBinarySearchQuality = async (
    canvas: HTMLCanvasElement
  ): Promise<{ blob: Blob; fits: boolean }> => {
    const rawHigh = await canvasToBlob(canvas, effectiveMime, 0.95);
    const highBlob = await finalizeBlobMetadataAndDpi(rawHigh, effectiveMime, originalFile, config);
    if (highBlob.size <= targetBytes) {
      return { blob: highBlob, fits: true };
    }

    let low = 0.05;
    let high = 0.92;
    let bestBlob: Blob | null = null;

    for (let iter = 0; iter < 7; iter++) {
      const mid = (low + high) / 2;
      const rawCandidate = await canvasToBlob(canvas, effectiveMime, mid);
      const candidate = await finalizeBlobMetadataAndDpi(
        rawCandidate,
        effectiveMime,
        originalFile,
        config
      );
      if (candidate.size <= targetBytes) {
        bestBlob = candidate;
        low = mid;
      } else {
        high = mid;
      }
    }

    if (bestBlob) {
      return { blob: bestBlob, fits: true };
    }

    const rawMin = await canvasToBlob(canvas, effectiveMime, 0.04);
    const minBlob = await finalizeBlobMetadataAndDpi(rawMin, effectiveMime, originalFile, config);
    return { blob: minBlob, fits: minBlob.size <= targetBytes };
  };

  const firstAttempt = await tryBinarySearchQuality(baseCanvas);
  if (firstAttempt.fits || !allowDimensionStepDown) {
    return {
      blob: firstAttempt.blob,
      finalW: baseCanvas.width,
      finalH: baseCanvas.height,
    };
  }

  let currentW = baseCanvas.width;
  let currentH = baseCanvas.height;
  let lastBlob = firstAttempt.blob;

  for (let step = 0; step < 5; step++) {
    const ratio = Math.max(0.5, Math.min(0.82, Math.sqrt(targetBytes / lastBlob.size)));
    currentW = Math.max(64, Math.round(currentW * ratio));
    currentH = Math.max(64, Math.round(currentH * ratio));

    const scaled = document.createElement('canvas');
    scaled.width = currentW;
    scaled.height = currentH;
    const sCtx = scaled.getContext('2d')!;
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.drawImage(baseCanvas, 0, 0, currentW, currentH);

    const attempt = await tryBinarySearchQuality(scaled);
    lastBlob = attempt.blob;
    if (attempt.fits) {
      return { blob: attempt.blob, finalW: currentW, finalH: currentH };
    }
  }

  return { blob: lastBlob, finalW: currentW, finalH: currentH };
}

export async function processSingleImage(
  item: ImageItem,
  index: number,
  config: PipelineConfig,
  onStatus?: (msg: string) => void
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  outputFileName: string;
}> {
  const img = await loadImage(item.originalUrl);

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  // Handle exact-crop mode (Miniature VEOL 360x210 & Bannière VEOL 964x140) with Pan & Zoom support
  if (config.resizeMode === 'exact-crop') {
    if (item.customCrop && config.cropPreset === 'custom') {
      sx = Math.round(item.customCrop.x * sw);
      sy = Math.round(item.customCrop.y * sh);
      sw = Math.max(1, Math.round(item.customCrop.width * sw));
      sh = Math.max(1, Math.round(item.customCrop.height * sh));
    } else {
      const targetRatio = config.targetWidth / config.targetHeight;
      const currentRatio = sw / sh;
      const zoom = Math.max(1, item.zoom || 1);
      const panX = item.panX !== undefined ? item.panX : 0.5;
      const panY = item.panY !== undefined ? item.panY : 0.5;

      let baseCropW = sw;
      let baseCropH = sh;
      if (currentRatio > targetRatio) {
        baseCropW = sh * targetRatio;
      } else {
        baseCropH = sw / targetRatio;
      }

      const finalCropW = Math.max(1, Math.round(baseCropW / zoom));
      const finalCropH = Math.max(1, Math.round(baseCropH / zoom));

      const maxOffsetX = Math.max(0, sw - finalCropW);
      const maxOffsetY = Math.max(0, sh - finalCropH);

      sx = Math.round(maxOffsetX * Math.max(0, Math.min(1, panX)));
      sy = Math.round(maxOffsetY * Math.max(0, Math.min(1, panY)));
      sw = finalCropW;
      sh = finalCropH;
    }
  } else if (item.customCrop && (config.cropPreset === 'custom' || config.cropPreset === 'none')) {
    sx = Math.round(item.customCrop.x * sw);
    sy = Math.round(item.customCrop.y * sh);
    sw = Math.max(1, Math.round(item.customCrop.width * sw));
    sh = Math.max(1, Math.round(item.customCrop.height * sh));
  } else if (config.cropPreset !== 'none' && config.cropPreset !== 'custom') {
    const [rw, rh] = config.cropPreset.split(':').map(Number);
    const targetRatio = rw / rh;
    const currentRatio = sw / sh;
    const zoom = Math.max(1, item.zoom || 1);
    const panX = item.panX !== undefined ? item.panX : 0.5;
    const panY = item.panY !== undefined ? item.panY : 0.5;

    let baseCropW = sw;
    let baseCropH = sh;
    if (currentRatio > targetRatio) {
      baseCropW = sh * targetRatio;
    } else {
      baseCropH = sw / targetRatio;
    }

    const finalCropW = Math.max(1, Math.round(baseCropW / zoom));
    const finalCropH = Math.max(1, Math.round(baseCropH / zoom));

    const maxOffsetX = Math.max(0, sw - finalCropW);
    const maxOffsetY = Math.max(0, sh - finalCropH);

    sx = Math.round(maxOffsetX * Math.max(0, Math.min(1, panX)));
    sy = Math.round(maxOffsetY * Math.max(0, Math.min(1, panY)));
    sw = finalCropW;
    sh = finalCropH;
  }

  const isRotated90 = config.rotateDeg === 90 || config.rotateDeg === 270;
  const orientedW = isRotated90 ? sh : sw;
  const orientedH = isRotated90 ? sw : sh;

  let outW = orientedW;
  let outH = orientedH;

  if (config.resizeMode === 'exact-crop') {
    outW = config.targetWidth;
    outH = config.targetHeight;
  } else if (config.resizeMode === 'width-only') {
    const reqW = Math.max(16, config.targetWidth || orientedW);
    if (!config.preventUpscale || reqW < orientedW) {
      const aspect = orientedH / orientedW;
      outW = reqW;
      outH = Math.max(1, Math.round(reqW * aspect));
    }
  } else if (config.resizeMode === 'percentage') {
    const scale = Math.max(1, config.scalePercentage) / 100;
    outW = Math.max(1, Math.round(orientedW * scale));
    outH = Math.max(1, Math.round(orientedH * scale));
  } else if (config.resizeMode === 'max-side') {
    const maxPx = Math.max(16, config.maxSidePx);
    const longest = Math.max(orientedW, orientedH);
    if (!config.preventUpscale || longest > maxPx) {
      const ratio = maxPx / longest;
      outW = Math.max(1, Math.round(orientedW * ratio));
      outH = Math.max(1, Math.round(orientedH * ratio));
    }
  } else if (config.resizeMode === 'dimensions') {
    let reqW = config.targetWidth || orientedW;
    let reqH = config.targetHeight || orientedH;
    if (config.lockAspectRatio) {
      const ratio = orientedW / orientedH;
      if (config.targetWidth && !config.targetHeight) {
        reqH = Math.round(reqW / ratio);
      } else if (!config.targetWidth && config.targetHeight) {
        reqW = Math.round(reqH * ratio);
      } else {
        const scale = Math.min(reqW / orientedW, reqH / orientedH);
        reqW = Math.round(orientedW * scale);
        reqH = Math.round(orientedH * scale);
      }
    }
    if (config.preventUpscale && (reqW > orientedW || reqH > orientedH)) {
      reqW = orientedW;
      reqH = orientedH;
    }
    outW = Math.max(1, reqW);
    outH = Math.max(1, reqH);
  }

  const targetMime = resolveOutputMime(item, config);

  // Vector SVG preservation path when monochrome mode is active and user wants SVG output
  if (
    config.monochromeMode &&
    targetMime === 'image/svg+xml' &&
    (item.file.type === 'image/svg+xml' || /\.svg$/i.test(item.file.name))
  ) {
    const svgBlob = await processSvgToMonochromeBlob(
      item.file,
      config.monochromeColor || '#ffffff',
      config.autoStripLightBg
    );
    return {
      blob: svgBlob,
      width: outW,
      height: outH,
      outputFileName: computeOutputFileName(item, index, config, 'image/svg+xml'),
    };
  }

  const canvas = renderSourceToCanvas(img, sx, sy, sw, sh, outW, outH, config, targetMime);
  const ctx = canvas.getContext('2d')!;

  if (config.bgRemoveMode === 'color-key') {
    const hex = item.pickedColorHex || config.colorKeyHex;
    applyColorKeyRemoval(
      ctx,
      outW,
      outH,
      hex,
      config.colorTolerance,
      config.contiguousFloodFill,
      config.featherEdge
    );
  }

  if (config.monochromeMode) {
    applyMonochromeTint(
      ctx,
      outW,
      outH,
      config.monochromeColor || '#ffffff',
      config.autoStripLightBg,
      config.colorTolerance,
      item.pickedColorHex
    );
  }

  // Apply Background Color Replacement if specified and not transparent
  if (
    config.bgRemoveMode !== 'none' &&
    config.bgReplaceColor &&
    config.bgReplaceColor !== 'transparent'
  ) {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = outW;
    compositeCanvas.height = outH;
    const compCtx = compositeCanvas.getContext('2d')!;

    // 1. Fill solid background replacement color
    compCtx.fillStyle = config.bgReplaceColor;
    compCtx.fillRect(0, 0, outW, outH);

    // 2. Draw cutout subject on top
    compCtx.drawImage(canvas, 0, 0);

    // 3. Copy composite back to main canvas
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(compositeCanvas, 0, 0);
  }

  if (config.compressionMode === 'target-size' && config.targetFileSizeKb > 0) {
    const targetBytes = config.targetFileSizeKb * 1024;
    const effectiveMime = targetMime === 'image/png' ? 'image/jpeg' : targetMime;
    const result = await encodeToTargetFileSize(
      canvas,
      effectiveMime,
      targetBytes,
      config.resizeMode === 'none',
      item.file,
      config
    );
    return {
      blob: result.blob,
      width: result.finalW,
      height: result.finalH,
      outputFileName: computeOutputFileName(item, index, config, effectiveMime),
    };
  }

  const rawBlob = await canvasToBlob(canvas, targetMime, config.quality / 100);
  const finalBlob = await finalizeBlobMetadataAndDpi(rawBlob, targetMime, item.file, config);

  return {
    blob: finalBlob,
    width: outW,
    height: outH,
    outputFileName: computeOutputFileName(item, index, config, targetMime),
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Échec de génération du Blob image'));
      },
      mimeType,
      quality
    );
  });
}
