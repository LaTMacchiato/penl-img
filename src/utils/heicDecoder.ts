import { heicTo } from 'heic-to/csp';

/**
 * Multi-engine client-side HEIC / HEIF / HIF decoder designed for modern Apple iOS 18+
 * and iPhone 15 / 16 / 17 Pro containers (12MP, 24MP, 48MP HEIF Max, HDR Gain Map `tmap`,
 * Display P3 10-bit `hvc1`, multi-tile `grid`, auxiliary depth/matte references).
 *
 * Decoding pipeline (100% local in browser, zero network upload):
 * 1. Magic-byte detection for misnamed JPEG / PNG / WebP / GIF / AVIF files.
 * 2. Native browser decoding (`<img>` / ImageIO on Safari macOS & iOS).
 * 3. Hardware-accelerated ISO BMFF + WebCodecs (`VideoDecoder`) engine:
 *    - Directly parses ISO BMFF boxes (`meta`, `pitm`, `iinf`, `iref`, `iprp`, `ipco`, `ipma`, `iloc`, `idat`).
 *    - Resolves `tmap` (Tone-Mapped HDR) or `iden` derived primary items down to the underlying `grid` or `hvc1` master image.
 *    - Decodes all HEVC tiles (`hvc1` / `hev1` 8-bit & 10-bit) via GPU hardware `VideoDecoder` in ~150-400ms.
 *    - Automatically downscales output canvas to <= 16 MP (e.g. 4618×3464) to avoid browser canvas memory ceilings.
 * 4. Sanitized `libheif` 1.23.7 engine (`heic-to/csp`):
 *    - Pre-sanitizes the ISO BMFF buffer in-place:
 *      a) Clears `essential = 1` bits in `ipma` on non-codec Apple/HDR properties (`tmap`, `ambi`, `clli`, `mdcv`, `cclv`, etc.)
 *         so `libheif` never aborts with `heif_suberror_Unsupported_essential_property`.
 *      b) Redirects `pitm` to the underlying `grid` or `hvc1` master item if `pitm` points to an uncompiled `tmap` item.
 */

const MAX_OUTPUT_PIXELS = 16_000_000; // Safe 16MP ceiling across all browsers (4618x3464 for 4:3)

const ESSENTIAL_SAFE_PROPERTIES = new Set([
  'hvcC',
  'av1C',
  'avcC',
  'vvcC',
  'jpgC',
  'uncC',
  'cmpd',
  'ispe',
  'irot',
  'imir',
  'clap',
  'pixi',
  'colr',
  'auxC',
  'pasp',
  'lsel',
  'a1lx',
  'a1op',
]);

async function readHeaderBytes(file: Blob, length = 64): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  const limit = Math.min(end, bytes.length);
  for (let i = start; i < limit; i++) {
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
        ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'MiHE', 'MiHB'].includes(
          majorBrand
        ) ||
        /heic|heix|hevc|mif1|msf1/i.test(compatBrands)
      ) {
        return { kind: 'heif', brand: majorBrand };
      }
    }
  } catch {
    // ignore header read errors
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

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
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

function rasterizeToJpegBlob(
  source: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
  width: number,
  height: number,
  quality = 0.95
): Promise<Blob> {
  let targetW = width;
  let targetH = height;
  if (targetW * targetH > MAX_OUTPUT_PIXELS) {
    const scale = Math.sqrt(MAX_OUTPUT_PIXELS / (targetW * targetH));
    targetW = Math.max(1, Math.floor(targetW * scale));
    targetH = Math.max(1, Math.floor(targetH * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Impossible de créer le contexte canvas 2D'));
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvasToJpegBlob(canvas, quality);
}

function replaceHeifExt(name: string, newExt: string): string {
  if (/\.(heic|heif|hif)$/i.test(name)) {
    return name.replace(/\.(heic|heif|hif)$/i, `.${newExt}`);
  }
  return `${name}.${newExt}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface IsoBox {
  type: string;
  pos: number;
  size: number;
  hdr: number;
  bodyStart: number;
  bodyEnd: number;
}

type HeifProperty =
  | { type: 'ispe'; width: number; height: number }
  | { type: 'irot'; angleCCW: number }
  | { type: 'imir'; axis: number }
  | { type: 'hvcC'; data: Uint8Array }
  | { type: string };

interface HeifExtent {
  offset: number;
  length: number;
}

interface HeifItemRef {
  type: string;
  targets: number[];
}

interface HeifItem {
  itemId: number;
  itemType: string;
  hidden: boolean;
  props: HeifProperty[];
  extents: HeifExtent[];
  refs: HeifItemRef[];
}

interface ParsedHeifContainer {
  bytes: Uint8Array;
  dv: DataView;
  primaryId: number;
  resolvedPrimaryId: number;
  items: Map<number, HeifItem>;
}

function findIsoBoxes(b: Uint8Array, dv: DataView, start: number, end: number): IsoBox[] {
  const list: IsoBox[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = dv.getUint32(pos, false);
    const type = bytesToAscii(b, pos + 4, pos + 8);
    let hdr = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(dv.getBigUint64(pos + 8, false));
      hdr = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < hdr || pos + size > end) break;
    list.push({ type, pos, size, hdr, bodyStart: pos + hdr, bodyEnd: pos + size });
    pos += size;
  }
  return list;
}

/**
 * Parses ISO BMFF / HEIF metadata and simultaneously sanitizes `ipma` essential bits
 * and `pitm` references in-place so both WebCodecs and `libheif` can decode iPhone 17 Pro files.
 */
function parseAndSanitizeHeifBuffer(arrayBuffer: ArrayBuffer): ParsedHeifContainer | null {
  const b = new Uint8Array(arrayBuffer);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);

  const top = findIsoBoxes(b, dv, 0, b.length);
  const meta = top.find((x) => x.type === 'meta');
  if (!meta || meta.bodyStart + 4 > meta.bodyEnd) return null;

  const metaBoxes = findIsoBoxes(b, dv, meta.bodyStart + 4, meta.bodyEnd);

  // 1. Primary Item Box (pitm)
  const pitm = metaBoxes.find((x) => x.type === 'pitm');
  let primaryId = 1;
  let pitmIdOffset = -1;
  let pitmIdSize = 2;
  if (pitm && pitm.bodyStart + 6 <= pitm.bodyEnd) {
    const pitmVer = b[pitm.bodyStart];
    pitmIdSize = pitmVer === 0 ? 2 : 4;
    pitmIdOffset = pitm.bodyStart + 4;
    if (pitmIdOffset + pitmIdSize <= pitm.bodyEnd) {
      primaryId =
        pitmIdSize === 2
          ? dv.getUint16(pitmIdOffset, false)
          : dv.getUint32(pitmIdOffset, false);
    }
  }

  // 2. Item Information Box (iinf -> infe)
  const items = new Map<number, HeifItem>();
  const iinf = metaBoxes.find((x) => x.type === 'iinf');
  if (iinf && iinf.bodyStart + 6 <= iinf.bodyEnd) {
    const iinfVer = b[iinf.bodyStart];
    const infeStart = iinf.bodyStart + (iinfVer === 0 ? 6 : 8);
    const infes = findIsoBoxes(b, dv, infeStart, iinf.bodyEnd);
    for (const infe of infes) {
      if (infe.type !== 'infe' || infe.bodyStart + 8 > infe.bodyEnd) continue;
      const ver = b[infe.bodyStart];
      const flags =
        (b[infe.bodyStart + 1] << 16) | (b[infe.bodyStart + 2] << 8) | b[infe.bodyStart + 3];
      if (ver >= 2) {
        const idSize = ver === 2 ? 2 : 4;
        if (infe.bodyStart + 4 + idSize + 6 > infe.bodyEnd) continue;
        const itemId =
          idSize === 2
            ? dv.getUint16(infe.bodyStart + 4, false)
            : dv.getUint32(infe.bodyStart + 4, false);
        const itemType = bytesToAscii(
          b,
          infe.bodyStart + 4 + idSize + 2,
          infe.bodyStart + 4 + idSize + 6
        );
        items.set(itemId, {
          itemId,
          itemType,
          hidden: (flags & 1) !== 0,
          props: [],
          extents: [],
          refs: [],
        });
      }
    }
  }

  // 3. Item Reference Box (iref -> dimg, thmb, auxl, cdsc)
  const iref = metaBoxes.find((x) => x.type === 'iref');
  if (iref && iref.bodyStart + 4 <= iref.bodyEnd) {
    const irefVer = b[iref.bodyStart];
    const idSize = irefVer === 0 ? 2 : 4;
    const refBoxes = findIsoBoxes(b, dv, iref.bodyStart + 4, iref.bodyEnd);
    for (const rb of refBoxes) {
      let p = rb.bodyStart;
      if (p + idSize + 2 > rb.bodyEnd) continue;
      const fromId = idSize === 2 ? dv.getUint16(p, false) : dv.getUint32(p, false);
      p += idSize;
      const count = dv.getUint16(p, false);
      p += 2;
      const targets: number[] = [];
      for (let i = 0; i < count; i++) {
        if (p + idSize > rb.bodyEnd) break;
        targets.push(idSize === 2 ? dv.getUint16(p, false) : dv.getUint32(p, false));
        p += idSize;
      }
      const item = items.get(fromId);
      if (item) {
        item.refs.push({ type: rb.type, targets });
      }
    }
  }

  // 4. Item Properties Box (iprp -> ipco & ipma) + In-place essential-bit sanitization
  const iprp = metaBoxes.find((x) => x.type === 'iprp');
  if (iprp) {
    const iprpBoxes = findIsoBoxes(b, dv, iprp.bodyStart, iprp.bodyEnd);
    const ipco = iprpBoxes.find((x) => x.type === 'ipco');
    const props: HeifProperty[] = [];
    if (ipco) {
      const pBoxes = findIsoBoxes(b, dv, ipco.bodyStart, ipco.bodyEnd);
      for (const pb of pBoxes) {
        if (pb.type === 'ispe' && pb.bodyStart + 12 <= pb.bodyEnd) {
          props.push({
            type: 'ispe',
            width: dv.getUint32(pb.bodyStart + 4, false),
            height: dv.getUint32(pb.bodyStart + 8, false),
          });
        } else if (pb.type === 'irot' && pb.bodyStart + 1 <= pb.bodyEnd) {
          props.push({
            type: 'irot',
            angleCCW: (b[pb.bodyStart] & 0x03) * 90,
          });
        } else if (pb.type === 'imir' && pb.bodyStart + 1 <= pb.bodyEnd) {
          props.push({
            type: 'imir',
            axis: b[pb.bodyStart] & 0x01,
          });
        } else if (pb.type === 'hvcC' && pb.bodyStart < pb.bodyEnd) {
          props.push({
            type: 'hvcC',
            data: b.subarray(pb.bodyStart, pb.bodyEnd),
          });
        } else {
          props.push({ type: pb.type });
        }
      }
    }

    for (const ipma of iprpBoxes.filter((x) => x.type === 'ipma')) {
      let p = ipma.bodyStart;
      if (p + 8 > ipma.bodyEnd) continue;
      const ver = b[p];
      const flags = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
      const entryCount = dv.getUint32(p + 4, false);
      p += 8;
      const idSize = ver < 1 ? 2 : 4;
      const is15Bit = (flags & 1) !== 0;

      for (let i = 0; i < entryCount; i++) {
        if (p + idSize + 1 > ipma.bodyEnd) break;
        const itemId = idSize === 2 ? dv.getUint16(p, false) : dv.getUint32(p, false);
        p += idSize;
        const assocCount = b[p++];
        const item = items.get(itemId);

        for (let j = 0; j < assocCount; j++) {
          if (is15Bit) {
            if (p + 2 > ipma.bodyEnd) break;
            const raw = dv.getUint16(p, false);
            const essential = (raw & 0x8000) !== 0;
            const idx = raw & 0x7fff;
            const prop = idx > 0 ? props[idx - 1] : undefined;
            if (essential && (!prop || !ESSENTIAL_SAFE_PROPERTIES.has(prop.type))) {
              dv.setUint16(p, idx, false);
            }
            if (prop && item) item.props.push(prop);
            p += 2;
          } else {
            if (p + 1 > ipma.bodyEnd) break;
            const raw = b[p];
            const essential = (raw & 0x80) !== 0;
            const idx = raw & 0x7f;
            const prop = idx > 0 ? props[idx - 1] : undefined;
            if (essential && (!prop || !ESSENTIAL_SAFE_PROPERTIES.has(prop.type))) {
              b[p] = idx;
            }
            if (prop && item) item.props.push(prop);
            p += 1;
          }
        }
      }
    }
  }

  // 5. Item Location Box (iloc) & Item Data Box (idat)
  const idat = metaBoxes.find((x) => x.type === 'idat');
  const iloc = metaBoxes.find((x) => x.type === 'iloc');
  if (iloc && iloc.bodyStart + 8 <= iloc.bodyEnd) {
    let p = iloc.bodyStart;
    const ver = b[p];
    const offsetSize = (b[p + 4] >> 4) & 0x0f;
    const lengthSize = b[p + 4] & 0x0f;
    const baseOffsetSize = (b[p + 5] >> 4) & 0x0f;
    const indexSize = ver === 1 || ver === 2 ? b[p + 5] & 0x0f : 0;
    const itemCount = ver < 2 ? dv.getUint16(p + 6, false) : dv.getUint32(p + 6, false);
    p += ver < 2 ? 8 : 10;

    const readUint = (sz: number): number => {
      if (sz === 0 || p + sz > iloc.bodyEnd) return 0;
      if (sz === 4) {
        const v = dv.getUint32(p, false);
        p += 4;
        return v;
      }
      if (sz === 8) {
        const v = Number(dv.getBigUint64(p, false));
        p += 8;
        return v;
      }
      if (sz === 2) {
        const v = dv.getUint16(p, false);
        p += 2;
        return v;
      }
      if (sz === 1) {
        return b[p++];
      }
      p += sz;
      return 0;
    };

    for (let i = 0; i < itemCount; i++) {
      const idSz = ver < 2 ? 2 : 4;
      if (p + idSz > iloc.bodyEnd) break;
      const itemId = readUint(idSz);
      let constructionMethod = 0;
      if (ver === 1 || ver === 2) {
        if (p + 2 > iloc.bodyEnd) break;
        constructionMethod = b[p + 1] & 0x0f;
        p += 2;
      }
      p += 2; // data_reference_index
      const baseOffset = readUint(baseOffsetSize);
      if (p + 2 > iloc.bodyEnd) break;
      const extentCount = dv.getUint16(p, false);
      p += 2;
      const extents: HeifExtent[] = [];
      for (let j = 0; j < extentCount; j++) {
        if (indexSize > 0) p += indexSize;
        const extOffset = readUint(offsetSize);
        const extLength = readUint(lengthSize);
        const absOffset =
          constructionMethod === 1 && idat
            ? idat.bodyStart + baseOffset + extOffset
            : baseOffset + extOffset;
        if (absOffset >= 0 && extLength > 0 && absOffset + extLength <= b.length) {
          extents.push({ offset: absOffset, length: extLength });
        }
      }
      const item = items.get(itemId);
      if (item) {
        item.extents = extents;
      }
    }
  }

  // 6. Resolve Primary Item if `pitm` points to `tmap` (Tone Map HDR) or `iden` (Identity derived item)
  let resolvedPrimaryId = primaryId;
  for (let depth = 0; depth < 4; depth++) {
    const cur = items.get(resolvedPrimaryId);
    if (!cur) break;
    if (cur.itemType === 'grid' || cur.itemType === 'hvc1' || cur.itemType === 'av01') {
      break;
    }
    const dimg = cur.refs.find((r) => r.type === 'dimg');
    if (dimg && dimg.targets.length > 0) {
      resolvedPrimaryId = dimg.targets[0];
    } else {
      break;
    }
  }

  // If resolvedPrimaryId still isn't a decodable master item, pick the largest `grid` or `hvc1` item
  const resolvedItem = items.get(resolvedPrimaryId);
  if (!resolvedItem || !['grid', 'hvc1', 'av01', 'jpeg'].includes(resolvedItem.itemType)) {
    let bestId = resolvedPrimaryId;
    let bestPixels = 0;
    for (const [id, it] of items.entries()) {
      if (it.itemType === 'grid' || (!it.hidden && it.itemType === 'hvc1')) {
        const ispe = it.props.find((p): p is { type: 'ispe'; width: number; height: number } => p.type === 'ispe');
        const px = ispe ? ispe.width * ispe.height : 1;
        if (px > bestPixels) {
          bestPixels = px;
          bestId = id;
        }
      }
    }
    resolvedPrimaryId = bestId;
  }

  // Patch `pitm` in-place if we redirected away from an unsupported `tmap` wrapper so `libheif` also sees the resolved item
  if (resolvedPrimaryId !== primaryId && pitmIdOffset >= 0) {
    if (pitmIdSize === 2 && resolvedPrimaryId <= 0xffff) {
      dv.setUint16(pitmIdOffset, resolvedPrimaryId, false);
    } else if (pitmIdSize === 4) {
      dv.setUint32(pitmIdOffset, resolvedPrimaryId, false);
    }
  }

  return { bytes: b, dv, primaryId, resolvedPrimaryId, items };
}

function readItemBytes(b: Uint8Array, extents: HeifExtent[]): Uint8Array {
  if (extents.length === 0) return new Uint8Array(0);
  if (extents.length === 1) {
    const e = extents[0];
    return b.subarray(e.offset, e.offset + e.length);
  }
  const total = extents.reduce((acc, e) => acc + e.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const e of extents) {
    out.set(b.subarray(e.offset, e.offset + e.length), pos);
    pos += e.length;
  }
  return out;
}

/**
 * Builds an RFC 6381 `hvc1.*` codec string from an ISO BMFF `hvcC` (HEVCDecoderConfigurationRecord) box payload.
 */
function buildHevcCodecString(hvcC: Uint8Array): string {
  if (hvcC.length < 13) return 'hvc1.1.6.L120.90';
  const profileSpace = ['', 'A', 'B', 'C'][(hvcC[1] >> 6) & 0x03];
  const tierFlag = (hvcC[1] >> 5) & 0x01 ? 'H' : 'L';
  const profileIdc = hvcC[1] & 0x1f;
  const compat = ((hvcC[2] << 24) | (hvcC[3] << 16) | (hvcC[4] << 8) | hvcC[5]) >>> 0;
  let rev = 0;
  for (let i = 0; i < 32; i++) {
    if ((compat >>> i) & 1) {
      rev |= 1 << (31 - i);
    }
  }
  rev = rev >>> 0;
  const levelIdc = hvcC[12];
  const constraints: number[] = [];
  for (let i = 6; i < 12; i++) {
    constraints.push(hvcC[i]);
  }
  while (constraints.length > 0 && constraints[constraints.length - 1] === 0) {
    constraints.pop();
  }
  return [
    'hvc1',
    `${profileSpace}${profileIdc}`,
    rev.toString(16),
    `${tierFlag}${levelIdc}`,
    ...constraints.map((c) => c.toString(16).toUpperCase()),
  ].join('.');
}

/**
 * Hardware-accelerated HEIC decoder using the browser's WebCodecs `VideoDecoder` API.
 * Supports both multi-tile `grid` images (iPhone 12MP / 24MP / 48MP HEIF Max) and single `hvc1` frames.
 */
async function decodeHeicViaWebCodecs(
  container: ParsedHeifContainer,
  quality = 0.95
): Promise<Blob> {
  if (typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') {
    throw new Error('WebCodecs VideoDecoder API non disponible');
  }

  const { bytes: b, dv, resolvedPrimaryId, items } = container;
  const primary = items.get(resolvedPrimaryId);
  if (!primary) {
    throw new Error('Image principale introuvable dans le conteneur HEIC');
  }

  let rows = 1;
  let cols = 1;
  let outW = 0;
  let outH = 0;
  let tileIds: number[] = [];

  if (primary.itemType === 'grid') {
    const gridData = readItemBytes(b, primary.extents);
    if (gridData.length < 8) {
      throw new Error('Descripteur ImageGrid HEIC invalide');
    }
    const gridFlags = gridData[1];
    rows = gridData[2] + 1;
    cols = gridData[3] + 1;
    const gridDv = new DataView(gridData.buffer, gridData.byteOffset, gridData.byteLength);
    if ((gridFlags & 1) !== 0) {
      if (gridData.length < 12) throw new Error('Descripteur ImageGrid 32-bit tronqué');
      outW = gridDv.getUint32(4, false);
      outH = gridDv.getUint32(8, false);
    } else {
      outW = gridDv.getUint16(4, false);
      outH = gridDv.getUint16(6, false);
    }
    const dimg = primary.refs.find((r) => r.type === 'dimg');
    if (!dimg || dimg.targets.length < rows * cols) {
      throw new Error('Références de tuiles HEIC (dimg) incomplètes');
    }
    tileIds = dimg.targets.slice(0, rows * cols);
  } else if (primary.itemType === 'hvc1') {
    const ispe = primary.props.find(
      (p): p is { type: 'ispe'; width: number; height: number } => p.type === 'ispe'
    );
    if (!ispe) throw new Error('Dimensions ispe manquantes sur l’image hvc1');
    outW = ispe.width;
    outH = ispe.height;
    tileIds = [primary.itemId];
  } else {
    throw new Error(`Type d'item HEIF non supporté par WebCodecs: ${primary.itemType}`);
  }

  const firstTile = items.get(tileIds[0]);
  if (!firstTile) throw new Error('Première tuile HEIC introuvable');

  const hvcCProp =
    firstTile.props.find((p): p is { type: 'hvcC'; data: Uint8Array } => p.type === 'hvcC') ||
    primary.props.find((p): p is { type: 'hvcC'; data: Uint8Array } => p.type === 'hvcC');
  if (!hvcCProp) throw new Error('Configuration HEVC (hvcC) introuvable');

  const tileIspe = firstTile.props.find(
    (p): p is { type: 'ispe'; width: number; height: number } => p.type === 'ispe'
  );
  const tileW = tileIspe ? tileIspe.width : Math.ceil(outW / cols);
  const tileH = tileIspe ? tileIspe.height : Math.ceil(outH / rows);

  const primaryCodec = buildHevcCodecString(hvcCProp.data);
  const candidateCodecs = [primaryCodec, 'hvc1.1.6.L150.B0', 'hvc1.2.4.L150.B0', 'hvc1.1.6.L120.90'];
  let supportedConfig: VideoDecoderConfig | null = null;

  for (const codec of candidateCodecs) {
    try {
      const cfg: VideoDecoderConfig = {
        codec,
        codedWidth: tileW,
        codedHeight: tileH,
        description: hvcCProp.data,
      };
      const sup = await VideoDecoder.isConfigSupported(cfg);
      if (sup.supported) {
        supportedConfig = cfg;
        break;
      }
    } catch {
      // try next codec string
    }
  }

  if (!supportedConfig) {
    throw new Error(`Décodeur matériel HEVC (${primaryCodec}) non supporté sur cet appareil`);
  }

  // Compute rotation / mirror transforms from primary item properties
  const irotProp = primary.props.find(
    (p): p is { type: 'irot'; angleCCW: number } => p.type === 'irot'
  );
  const imirProp = primary.props.find(
    (p): p is { type: 'imir'; axis: number } => p.type === 'imir'
  );
  const angleCCW = irotProp ? irotProp.angleCCW % 360 : 0;
  const swapAxes = angleCCW === 90 || angleCCW === 270;

  const finalNaturalW = swapAxes ? outH : outW;
  const finalNaturalH = swapAxes ? outW : outH;

  // Downscale directly during tile assembly if image exceeds MAX_OUTPUT_PIXELS (e.g. 48MP -> 16MP)
  const scale =
    finalNaturalW * finalNaturalH > MAX_OUTPUT_PIXELS
      ? Math.sqrt(MAX_OUTPUT_PIXELS / (finalNaturalW * finalNaturalH))
      : 1;

  const unrotatedCanvasW = Math.max(1, Math.round(outW * scale));
  const unrotatedCanvasH = Math.max(1, Math.round(outH * scale));

  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = unrotatedCanvasW;
  gridCanvas.height = unrotatedCanvasH;
  const gridCtx = gridCanvas.getContext('2d');
  if (!gridCtx) throw new Error('Impossible d’initialiser le canvas de décodage HEIC');

  let decodedCount = 0;
  let decodeError: Error | null = null;

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        const idx = Math.round(frame.timestamp / 1000);
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const dx = c * tileW * scale;
        const dy = r * tileH * scale;
        const dw = tileW * scale;
        const dh = tileH * scale;
        gridCtx.drawImage(frame, dx, dy, dw, dh);
        decodedCount++;
      } finally {
        frame.close();
      }
    },
    error: (err) => {
      decodeError = err instanceof Error ? err : new Error(String(err));
    },
  });

  try {
    decoder.configure(supportedConfig);

    for (let i = 0; i < tileIds.length; i++) {
      const tileItem = items.get(tileIds[i]);
      if (!tileItem || tileItem.extents.length === 0) {
        throw new Error(`Données de tuile HEIC #${i} manquantes`);
      }
      const chunkBytes = readItemBytes(b, tileItem.extents);
      decoder.decode(
        new EncodedVideoChunk({
          type: 'key',
          timestamp: i * 1000,
          data: chunkBytes,
        })
      );
    }

    await decoder.flush();
  } finally {
    try {
      if (decoder.state !== 'closed') decoder.close();
    } catch {
      // ignore close errors
    }
  }

  if (decodeError) throw decodeError;
  if (decodedCount === 0) throw new Error('Aucune tuile HEVC décodée par WebCodecs');

  if (angleCCW === 0 && !imirProp) {
    return canvasToJpegBlob(gridCanvas, quality);
  }

  // Apply ISO BMFF `irot` (CCW rotation) and `imir` (mirroring)
  const finalW = swapAxes ? unrotatedCanvasH : unrotatedCanvasW;
  const finalH = swapAxes ? unrotatedCanvasW : unrotatedCanvasH;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = finalW;
  outCanvas.height = finalH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Impossible de créer le canvas d’orientation HEIC');

  outCtx.save();
  outCtx.translate(finalW / 2, finalH / 2);
  if (angleCCW !== 0) {
    outCtx.rotate((-angleCCW * Math.PI) / 180);
  }
  if (imirProp) {
    if (imirProp.axis === 0) {
      outCtx.scale(1, -1);
    } else {
      outCtx.scale(-1, 1);
    }
  }
  outCtx.drawImage(
    gridCanvas,
    -unrotatedCanvasW / 2,
    -unrotatedCanvasH / 2,
    unrotatedCanvasW,
    unrotatedCanvasH
  );
  outCtx.restore();

  return canvasToJpegBlob(outCanvas, quality);
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

  // 2. Native browser decoding first (instant ~20ms hardware decode on macOS/iOS Safari; ~2ms reject on Chrome/Firefox)
  try {
    const img = await withTimeout(tryLoadImageBlob(file), 4000, 'Timeout décodage natif');
    const jpegBlob = await rasterizeToJpegBlob(img, img.naturalWidth, img.naturalHeight, 0.95);
    return {
      file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
    };
  } catch {
    // Expected on Chrome/Firefox where HEIF is not decoded via <img>; continue to ISO BMFF + WebCodecs / libheif
  }

  // Parse ISO BMFF container & sanitize Apple iOS 18+ / iPhone 17 Pro `ipma` essential flags and `pitm` tmap references
  let rawBuffer: ArrayBuffer | null = null;
  let parsedContainer: ParsedHeifContainer | null = null;
  try {
    rawBuffer = await file.arrayBuffer();
    parsedContainer = parseAndSanitizeHeifBuffer(rawBuffer);
  } catch {
    // Continue with original file if buffer read fails
  }

  // 3. Hardware-accelerated WebCodecs (`VideoDecoder`) engine (decodes 12MP/24MP/48MP iPhone 17 Pro HEIC in ~150-400ms)
  if (parsedContainer) {
    try {
      const webCodecsBlob = await withTimeout(
        decodeHeicViaWebCodecs(parsedContainer, 0.95),
        12000,
        'Délai WebCodecs dépassé'
      );
      return {
        file: new File([webCodecsBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
      };
    } catch {
      // Fall through to sanitized libheif engine if hardware HEVC WebCodecs is unavailable
    }
  }

  // 4. Sanitized WASM/asm.js `libheif` 1.23.7 engine (`heic-to/csp`)
  const sanitizedBlob = rawBuffer ? new Blob([rawBuffer], { type: file.type || 'image/heic' }) : file;
  let primaryErr: unknown = null;
  try {
    const bitmap = await withTimeout(
      heicTo({
        blob: sanitizedBlob,
        type: 'bitmap',
      }),
      35000,
      'Délai de décodage HEIF/HEIC dépassé (35s)'
    );
    try {
      const jpegBlob = await rasterizeToJpegBlob(bitmap, bitmap.width, bitmap.height, 0.95);
      return {
        file: new File([jpegBlob], replaceHeifExt(file.name, 'jpg'), { type: 'image/jpeg' }),
      };
    } finally {
      bitmap.close?.();
    }
  } catch (err) {
    primaryErr = err;
  }

  // 5. Fallback: AV1-encoded HEIF (`mif1` with `av01` track) -> decode as image/avif
  try {
    const avifTyped = new Blob([sanitizedBlob], { type: 'image/avif' });
    const img = await withTimeout(tryLoadImageBlob(avifTyped), 4000, 'Timeout décodage AVIF');
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
