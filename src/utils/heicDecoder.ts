/**
 * Robust client-side decoder for HEIC, HEIF and HIF containers.
 * Supports:
 * - Standard Apple / iOS HEIC/HEIF (`heic`, `heix`, `mif1`, `msf1`, `hevc`) via `heic-to/csp` (libheif 1.23.7, no eval)
 * - Misnamed JPEG/PNG/WebP files carrying a `.heic`/`.heif` extension
 * - AV1-encoded `.heif` / `.avif` containers via native browser AVIF decoding
 * - Native Safari macOS/iOS ImageIO fallback & large-canvas downscale safety
 */

async function readHeaderBytes(file: Blob, length = 32): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < Math.min(end, bytes.length); i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

type DetectedMagic =
  | { kind: 'jpeg' }
  | { kind: 'png' }
  | { kind: 'webp' }
  | { kind: 'gif' }
  | { kind: 'avif' }
  | { kind: 'heif'; brand: string }
  | { kind: 'unknown' };

async function detectMagic(file: Blob): Promise<DetectedMagic> {
  try {
    const b = await readHeaderBytes(file, 64);
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      return { kind: 'jpeg' };
    }
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { kind: 'png' };
    }
    if (
      b.length >= 12 &&
      bytesToAscii(b, 0, 4) === 'RIFF' &&
      bytesToAscii(b, 8, 12) === 'WEBP'
    ) {
      return { kind: 'webp' };
    }
    if (b.length >= 4 && bytesToAscii(b, 0, 4) === 'GIF8') {
      return { kind: 'gif' };
    }
    if (b.length >= 12 && bytesToAscii(b, 4, 8) === 'ftyp') {
      const majorBrand = bytesToAscii(b, 8, 12).replace(/\0/g, '').trim();
      const compatBrands = bytesToAscii(b, 16, Math.min(b.length, 64));
      if (majorBrand === 'avif' || majorBrand === 'avis') {
        return { kind: 'avif' };
      }
      if (
        ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(majorBrand) ||
        /heic|heix|hevc|mif1|msf1/i.test(compatBrands)
      ) {
        return { kind: 'heif', brand: majorBrand };
      }
    }
  } catch {
    // ignore read failure
  }
  return { kind: 'unknown' };
}

function tryLoadImageBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        reject(new Error('Image dimensions are zero'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Native browser image decode failed'));
    };
    img.src = url;
  });
}

function rasterizeToJpegBlob(
  source: HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  quality = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const MAX_CANVAS_PIXELS = 16_000_000; // Safe below Safari's 16.7M limit
    let targetW = width;
    let targetH = height;
    if (targetW * targetH > MAX_CANVAS_PIXELS) {
      const scale = Math.sqrt(MAX_CANVAS_PIXELS / (targetW * targetH));
      targetW = Math.max(1, Math.floor(targetW * scale));
      targetH = Math.max(1, Math.floor(targetH * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Impossible de créer le contexte canvas 2D'));
      return;
    }
    ctx.drawImage(source, 0, 0, targetW, targetH);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Échec de l’encodage JPEG sur canvas'));
      },
      'image/jpeg',
      quality
    );
  });
}

function replaceHeifExt(name: string, newExt: string): string {
  if (/\.(heic|heif|hif)$/i.test(name)) {
    return name.replace(/\.(heic|heif|hif)$/i, `.${newExt}`);
  }
  return `${name}.${newExt}`;
}

export async function isFileHeifOrHeic(file: File): Promise<boolean> {
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.type === 'image/heic-sequence' ||
    file.type === 'image/heif-sequence' ||
    /\.(heic|heif|hif)$/i.test(file.name)
  ) {
    return true;
  }
  const magic = await detectMagic(file);
  return magic.kind === 'heif';
}

export async function decodeHeifFileToJpeg(file: File): Promise<{
  file: File;
  error?: string;
}> {
  const magic = await detectMagic(file);

  // 1. Handle files misnamed as .heic/.heif that are actually standard web formats
  if (magic.kind === 'jpeg') {
    return {
      file: new File([file], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
    };
  }
  if (magic.kind === 'png') {
    return {
      file: new File([file], replaceHeifExt(file.name, 'png'), { type: 'image/png' }),
    };
  }
  if (magic.kind === 'webp') {
    return {
      file: new File([file], replaceHeifExt(file.name, 'webp'), { type: 'image/webp' }),
    };
  }
  if (magic.kind === 'avif') {
    try {
      const avifBlob = new Blob([file], { type: 'image/avif' });
      const img = await tryLoadImageBlob(avifBlob);
      const jpegBlob = await rasterizeToJpegBlob(img, img.naturalWidth, img.naturalHeight, 0.95);
      return {
        file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
      };
    } catch {
      return {
        file: new File([file], replaceHeifExt(file.name, 'avif'), { type: 'image/avif' }),
      };
    }
  }

  // 2. Primary decoder: modern libheif 1.23.7 via `heic-to/csp` (no unsafe-eval)
  let primaryErr: unknown = null;
  try {
    const { heicTo } = await import('heic-to/csp');
    try {
      const convertedBlob = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: 0.95,
      });
      return {
        file: new File([convertedBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
      };
    } catch (innerErr) {
      // Retry via ImageBitmap in case canvas.toBlob hit a Safari pixel area limit
      const bitmap = await heicTo({
        blob: file,
        type: 'bitmap',
      });
      try {
        const jpegBlob = await rasterizeToJpegBlob(bitmap, bitmap.width, bitmap.height, 0.95);
        return {
          file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
        };
      } finally {
        bitmap.close?.();
      }
    }
  } catch (err) {
    primaryErr = err;
  }

  // 3. Fallback A: Native browser decoding (e.g. Safari on macOS / iOS ImageIO)
  try {
    const img = await tryLoadImageBlob(file);
    const jpegBlob = await rasterizeToJpegBlob(img, img.naturalWidth, img.naturalHeight, 0.95);
    return {
      file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
    };
  } catch {
    // ignore and try next fallback
  }

  // 4. Fallback B: AV1-encoded HEIF (`mif1` with `av01` track from Android/cameras) -> decode as image/avif
  try {
    const avifTyped = new Blob([file], { type: 'image/avif' });
    const img = await tryLoadImageBlob(avifTyped);
    const jpegBlob = await rasterizeToJpegBlob(img, img.naturalWidth, img.naturalHeight, 0.95);
    return {
      file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
    };
  } catch {
    // all decoders failed
  }

  const msg =
    primaryErr instanceof Error
      ? primaryErr.message
      : typeof primaryErr === 'string'
      ? primaryErr
      : 'Décodage HEIF/HEIC impossible dans ce navigateur';

  return { file, error: msg };
}
