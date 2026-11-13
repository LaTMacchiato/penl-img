export type OutputFormat =
  | 'original'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/svg+xml';

export type ResizeMode =
  | 'none'
  | 'width-only'
  | 'max-side'
  | 'dimensions'
  | 'percentage'
  | 'exact-crop';

export type CompressionMode = 'quality' | 'target-size';

export type CropPreset = 'none' | '1:1' | '16:9' | '4:3' | '3:2' | '9:16' | 'custom';

export type BgRemoveMode = 'none' | 'color-key';

export interface CustomCropBox {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  width: number; // 0..1 normalized
  height: number; // 0..1 normalized
}

export interface PipelineConfig {
  // 1. Resize
  resizeMode: ResizeMode;
  targetWidth: number;
  targetHeight: number;
  lockAspectRatio: boolean;
  scalePercentage: number;
  maxSidePx: number;
  preventUpscale: boolean;

  // 2. Format, Compression, EXIF & DPI
  outputFormat: OutputFormat;
  compressionMode: CompressionMode;
  quality: number; // 1 to 100
  targetFileSizeKb: number; // Target max file size in KB (Ko)
  stripMetadata: boolean; // False by default (preserve EXIF unless checked)
  enforceMax72Dpi: boolean; // True for VEOL tools (caps DPI at 72 ppp)
  backgroundColorForJpeg: string;

  // 3. Crop & Orientation
  cropPreset: CropPreset;
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;

  // 4. Background Removal & Replacement
  bgRemoveMode: BgRemoveMode;
  bgReplaceColor: string; // 'transparent', '#ffffff', '#f5f5f5', '#000000', or any hex
  colorKeyHex: string;
  colorTolerance: number; // 0 to 100
  featherEdge: boolean;
  contiguousFloodFill: boolean;

  // 4b. Monochrome Silhouette / Logo Tint (e.g. Logo en Blanc)
  monochromeMode: boolean;
  monochromeColor: string; // '#ffffff' by default
  autoStripLightBg: boolean; // Automatically strip white/light solid background before tinting
  keepSvgVector: boolean; // When true and input is SVG, also export recolored vector SVG

  // 5. Batch Rename & Folder Structure
  renamePrefix: string;
  renameSuffix: string;
  renamePattern: 'keep' | 'sequential';
  customBaseName: string;
  preserveSubfolders: boolean;
}

export interface ImageItem {
  id: string;
  file: File;
  relativePath: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;

  // Per-image optional overrides
  customCrop?: CustomCropBox;
  pickedColorHex?: string;

  // Direct Pan & Zoom on card for VEOL / exact-crop
  panX?: number; // 0 to 1 (default 0.5 = centered horizontally)
  panY?: number; // 0 to 1 (default 0.5 = centered vertically)
  zoom?: number; // 1 to 3 (default 1.0)

  // Output result
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMsg?: string;
  processedBlob?: Blob;
  processedUrl?: string;
  processedWidth?: number;
  processedHeight?: number;
  processedSize?: number;
  outputFileName?: string;
  outputDpi?: number;
}
