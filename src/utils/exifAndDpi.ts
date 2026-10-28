/**
 * Binary utilities for JPEG EXIF preservation and 72 DPI (ppp) enforcement on JPEG & PNG blobs.
 * Runs 100% locally in the browser using ArrayBuffer / DataView.
 */

// Extract APP1 (EXIF, 0xFFE1) segments from an original JPEG File
export async function extractJpegExifSegments(file: File): Promise<Uint8Array[]> {
  if (file.type !== 'image/jpeg' && !/\.(jpe?g)$/i.test(file.name)) {
    return [];
  }
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
      return [];
    }

    const segments: Uint8Array[] = [];
    let offset = 2;

    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset, false);
      // Stop at Start Of Scan (SOS 0xFFDA) or End Of Image (EOI 0xFFD9)
      if (marker === 0xffda || marker === 0xffd9) break;
      // Standalone markers without length
      if ((marker & 0xff00) !== 0xff00) break;

      const segLength = view.getUint16(offset + 2, false);
      if (segLength < 2 || offset + 2 + segLength > view.byteLength) break;

      // Check for APP1 (0xFFE1) with "Exif\0\0" header
      if (marker === 0xffe1 && segLength >= 8) {
        const isExif =
          view.getUint8(offset + 4) === 0x45 && // 'E'
          view.getUint8(offset + 5) === 0x78 && // 'x'
          view.getUint8(offset + 6) === 0x69 && // 'i'
          view.getUint8(offset + 7) === 0x66 && // 'f'
          view.getUint8(offset + 8) === 0x00 &&
          view.getUint8(offset + 9) === 0x00;

        if (isExif) {
          segments.push(new Uint8Array(buffer.slice(offset, offset + 2 + segLength)));
        }
      }

      offset += 2 + segLength;
    }
    return segments;
  } catch {
    return [];
  }
}

// Cap XResolution (0x011A) and YResolution (0x011B) in an APP1 Exif segment to 72 DPI if higher
function capExifSegmentDpiTo72(segment: Uint8Array): Uint8Array {
  const copy = new Uint8Array(segment);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);

  // Segment structure: [0xFF, 0xE1, lenHi, lenLo, 'E','x','i','f',0,0, TIFF_HEADER...]
  const tiffStart = 10;
  if (copy.byteLength < tiffStart + 8) return copy;

  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949; // 'II'
  if (!littleEndian && byteOrder !== 0x4d4d) return copy;

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0Start = tiffStart + firstIfdOffset;
  if (ifd0Start + 2 > copy.byteLength) return copy;

  const numEntries = view.getUint16(ifd0Start, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    if (entryOffset + 12 > copy.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);

    // 0x011A = XResolution, 0x011B = YResolution (RATIONAL = type 5, two uint32: numerator/denominator)
    if ((tag === 0x011a || tag === 0x011b) && type === 5) {
      const valueOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
      if (valueOffset + 8 <= copy.byteLength) {
        const num = view.getUint32(valueOffset, littleEndian);
        const den = view.getUint32(valueOffset + 4, littleEndian) || 1;
        const dpi = num / den;
        if (dpi > 72) {
          view.setUint32(valueOffset, 72, littleEndian);
          view.setUint32(valueOffset + 4, 1, littleEndian);
        }
      }
    }
    // 0x0128 = ResolutionUnit (SHORT = type 3): set to 2 (inches / dpi)
    if (tag === 0x0128 && type === 3) {
      view.setUint16(entryOffset + 8, 2, littleEndian);
    }
  }

  return copy;
}

// Patch JPEG blob: set JFIF APP0 density to 72 DPI (if enforceMax72Dpi) and inject preserved EXIF segments (if !stripMetadata)
export async function finalizeJpegBlob(
  generatedBlob: Blob,
  originalFile: File,
  stripMetadata: boolean,
  enforceMax72Dpi: boolean
): Promise<Blob> {
  const buffer = await generatedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return generatedBlob;
  }

  let insertOffset = 2;

  // Check if JFIF APP0 segment is right after SOI (0xFFD8)
  if (
    view.byteLength >= 20 &&
    view.getUint16(2, false) === 0xffe0 &&
    view.getUint8(6) === 0x4a && // 'J'
    view.getUint8(7) === 0x46 && // 'F'
    view.getUint8(8) === 0x49 && // 'I'
    view.getUint8(9) === 0x46 // 'F'
  ) {
    const app0Len = view.getUint16(4, false);
    insertOffset = 2 + 2 + app0Len;

    if (enforceMax72Dpi) {
      const units = view.getUint8(11);
      const xDensity = view.getUint16(12, false);
      const yDensity = view.getUint16(14, false);

      // Convert cm density to inch if units === 2, or cap if > 72
      const currentDpiX = units === 2 ? Math.round(xDensity * 2.54) : xDensity;
      const currentDpiY = units === 2 ? Math.round(yDensity * 2.54) : yDensity;

      if (units !== 1 || currentDpiX > 72 || currentDpiY > 72 || currentDpiX === 0) {
        view.setUint8(11, 1); // 1 = dots per inch (ppp/dpi)
        view.setUint16(12, 72, false);
        view.setUint16(14, 72, false);
      }
    }
  }

  let exifSegments: Uint8Array[] = [];
  if (!stripMetadata) {
    exifSegments = await extractJpegExifSegments(originalFile);
    if (enforceMax72Dpi) {
      exifSegments = exifSegments.map(capExifSegmentDpiTo72);
    }
  }

  if (exifSegments.length === 0 && !enforceMax72Dpi) {
    return generatedBlob;
  }

  const totalExifBytes = exifSegments.reduce((acc, s) => acc + s.byteLength, 0);
  const out = new Uint8Array(bytes.byteLength + totalExifBytes);

  out.set(bytes.subarray(0, insertOffset), 0);
  let cursor = insertOffset;
  for (const seg of exifSegments) {
    out.set(seg, cursor);
    cursor += seg.byteLength;
  }
  out.set(bytes.subarray(insertOffset), cursor);

  return new Blob([out], { type: 'image/jpeg' });
}

// Inject or cap pHYs chunk in PNG to 72 DPI (2835 pixels per meter)
export async function enforce72DpiOnPngBlob(pngBlob: Blob): Promise<Blob> {
  const buffer = await pngBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Verify PNG signature + IHDR chunk (8 + 25 = 33 bytes)
  if (bytes.byteLength < 33 || view.getUint32(0, false) !== 0x89504e47) {
    return pngBlob;
  }

  // 72 DPI = 72 / 0.0254 = 2835 pixels per meter
  const ppm72 = 2835;

  // Build 21-byte pHYs chunk: Length(4)=9, Type(4)='pHYs', Data(9)=[X(4), Y(4), Unit(1)=1], CRC(4)
  const physChunk = new Uint8Array(21);
  const pView = new DataView(physChunk.buffer);
  pView.setUint32(0, 9, false); // Data length = 9
  physChunk[4] = 0x70; // 'p'
  physChunk[5] = 0x48; // 'H'
  physChunk[6] = 0x59; // 'Y'
  physChunk[7] = 0x73; // 's'
  pView.setUint32(8, ppm72, false);
  pView.setUint32(12, ppm72, false);
  physChunk[16] = 1; // unit = meter

  const crc = crc32(physChunk.subarray(4, 17));
  pView.setUint32(17, crc, false);

  // Insert right after IHDR chunk (offset 33)
  const out = new Uint8Array(bytes.byteLength + 21);
  out.set(bytes.subarray(0, 33), 0);
  out.set(physChunk, 33);
  out.set(bytes.subarray(33), 54);

  return new Blob([out], { type: 'image/png' });
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
