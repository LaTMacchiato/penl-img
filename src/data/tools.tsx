import React from 'react';
import { ToolId, PipelineConfig } from '../types';
import {
  Maximize2,
  RefreshCw,
  Eraser,
  Paintbrush,
  EyeOff,
  Crop,
  FolderPen,
  Laptop,
  QrCode,
  LayoutTemplate,
  RectangleHorizontal,
  FileImage,
} from 'lucide-react';

export interface ToolCardDef {
  id: ToolId;
  shortLabel: string;
  category: 'veol' | 'edit' | 'studio';
  badge: string;
  title: string;
  subtitle: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  icon: React.ReactNode;
  featured?: boolean;
  compact?: boolean;
  externalUrl?: string;
}

export const VEOL_TOOLS: ToolCardDef[] = [
  {
    id: 'veol-thumb',
    shortLabel: 'Miniature VEOL',
    category: 'veol',
    badge: 'VEOL • 360×210 PX • 72 PPP',
    title: 'Miniature VEOL',
    subtitle: 'Crop auto 360×210 px, recadrage glisser-déposer direct et passage auto en 72 ppp.',
    accentBg: 'bg-teal-500/10',
    accentText: 'text-teal-700',
    accentBorder: 'group-hover:border-teal-500/60',
    icon: <LayoutTemplate className="w-4 h-4" />,
    compact: true,
  },
  {
    id: 'veol-banner',
    shortLabel: 'Bannière VEOL',
    category: 'veol',
    badge: 'VEOL • 964×140 PX • 72 PPP',
    title: 'Bannière VEOL',
    subtitle: 'Crop auto 964×140 px, ajustement horizontal/vertical direct et passage auto en 72 ppp.',
    accentBg: 'bg-indigo-500/10',
    accentText: 'text-indigo-700',
    accentBorder: 'group-hover:border-indigo-500/60',
    icon: <RectangleHorizontal className="w-4 h-4" />,
    compact: true,
  },
  {
    id: 'veol-article',
    shortLabel: 'Article VEOL',
    category: 'veol',
    badge: 'VEOL • MAX 1280 PX • 72 PPP',
    title: 'Image article VEOL',
    subtitle: 'Largeur max 1280 px, cadrage optionnel, 72 ppp auto et traitement par lot.',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-700',
    accentBorder: 'group-hover:border-emerald-500/60',
    icon: <FileImage className="w-4 h-4" />,
    compact: true,
  },
];

export const MAIN_TOOLS: ToolCardDef[] = [
  {
    id: 'resize-compress',
    shortLabel: 'Resize & Compresser',
    category: 'edit',
    badge: '01 / DIMENSIONS & QUALITÉ',
    title: 'Redimensionner & Compresser',
    subtitle:
      'Largeur cible (ratio verrouillé), compression qualité % ou poids cible en Ko — photos iPhone HEIC incluses.',
    accentBg: 'bg-orange-500/10',
    accentText: 'text-orange-600',
    accentBorder: 'group-hover:border-orange-500/60',
    icon: <Maximize2 className="w-5 h-5" />,
    featured: true,
  },
  {
    id: 'convert',
    shortLabel: 'Convertir',
    category: 'edit',
    badge: '02 / FORMATS',
    title: 'Convertir Format',
    subtitle: 'Transformez instantanément vos lots HEIC/HEIF iPhone, JPG, PNG, WebP et AVIF.',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-600',
    accentBorder: 'group-hover:border-blue-500/50',
    icon: <RefreshCw className="w-5 h-5" />,
  },
  {
    id: 'remove-bg',
    shortLabel: 'Retirer Fond',
    category: 'edit',
    badge: '03 / DÉTOURAGE',
    title: 'Retirer le Fond (PNG)',
    subtitle: 'Effacez un fond uni instantanément à la baguette magique ou pipette de couleur.',
    accentBg: 'bg-purple-500/10',
    accentText: 'text-purple-600',
    accentBorder: 'group-hover:border-purple-500/50',
    icon: <Eraser className="w-5 h-5" />,
  },
  {
    id: 'logo-white',
    shortLabel: 'Logo Blanc',
    category: 'studio',
    badge: '04 / SILHOUETTE',
    title: 'Logo en Blanc (PNG / SVG)',
    subtitle:
      'Passez instantanément un logo couleur (PNG, SVG, WebP…) entièrement en blanc sur fond transparent.',
    accentBg: 'bg-stone-900',
    accentText: 'text-white',
    accentBorder: 'group-hover:border-stone-900/60',
    icon: <Paintbrush className="w-5 h-5" />,
  },
  {
    id: 'privacy-blur',
    shortLabel: 'Flouter (RGPD)',
    category: 'studio',
    badge: '05 / ANONYMISATION RGPD',
    title: 'Flouter & Masquer',
    subtitle:
      'Floutez visages, plaques, noms ou écrans sensibles (flou, mosaïque, masque noir) 100 % en local.',
    accentBg: 'bg-rose-500/10',
    accentText: 'text-rose-600',
    accentBorder: 'group-hover:border-rose-500/60',
    icon: <EyeOff className="w-5 h-5" />,
  },
  {
    id: 'crop',
    shortLabel: 'Recadrer',
    category: 'edit',
    badge: '06 / CADRAGE',
    title: 'Recadrer & Pivoter',
    subtitle: 'Ratio 1:1, 16:9, 4:3, rotation 90° ou zone libre à la souris avec compression intégrée.',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-600',
    accentBorder: 'group-hover:border-amber-500/50',
    icon: <Crop className="w-5 h-5" />,
  },
  {
    id: 'rename',
    shortLabel: 'Renommer',
    category: 'edit',
    badge: '07 / ORGANISATION',
    title: 'Renommer un Dossier',
    subtitle: 'Renommage séquentiel (photo_001…), préfixe et suffixe pour tout un dossier en local.',
    accentBg: 'bg-pink-500/10',
    accentText: 'text-pink-600',
    accentBorder: 'group-hover:border-pink-500/50',
    icon: <FolderPen className="w-5 h-5" />,
  },
  {
    id: 'mockup',
    shortLabel: 'Mockups v2',
    category: 'studio',
    badge: '08 / CONTEXTUALISATION',
    title: 'Mockup Studio',
    subtitle:
      'Habillez vos captures en PC portable, Smartphone, Tablette ou Fenêtre Navigateur avec export HD/VEOL.',
    accentBg: 'bg-cyan-500/10',
    accentText: 'text-cyan-600',
    accentBorder: 'group-hover:border-cyan-500/50',
    icon: <Laptop className="w-5 h-5" />,
  },
  {
    id: 'qrcode',
    shortLabel: 'QrCode',
    category: 'studio',
    badge: 'LIEN EXTERNE',
    title: 'QrCode',
    subtitle: 'Créez et personnalisez des QR codes vectoriels haute définition sur qrcode.thmarchand.fr.',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-600',
    accentBorder: 'group-hover:border-emerald-500/50',
    icon: <QrCode className="w-5 h-5" />,
    externalUrl: 'https://qrcode.thmarchand.fr/',
  },
];

export const ALL_TOOLS: ToolCardDef[] = [...VEOL_TOOLS, ...MAIN_TOOLS];
export const INTERNAL_TOOLS: ToolCardDef[] = ALL_TOOLS.filter((t) => !t.externalUrl);

export function getDefaultConfigForTool(tool: ToolId): PipelineConfig {
  const base: PipelineConfig = {
    resizeMode: 'none',
    targetWidth: 1920,
    targetHeight: 1080,
    lockAspectRatio: true,
    scalePercentage: 50,
    maxSidePx: 1920,
    preventUpscale: true,

    outputFormat: 'image/jpeg',
    compressionMode: 'quality',
    quality: 85,
    targetFileSizeKb: 300,
    stripMetadata: false,
    enforceMax72Dpi: false,
    backgroundColorForJpeg: '#ffffff',

    cropPreset: 'none',
    rotateDeg: 0,
    flipH: false,
    flipV: false,

    bgRemoveMode: 'none',
    bgReplaceColor: 'transparent',
    colorKeyHex: '#ffffff',
    colorTolerance: 18,
    featherEdge: true,
    contiguousFloodFill: true,

    monochromeMode: false,
    monochromeColor: '#ffffff',
    autoStripLightBg: true,
    keepSvgVector: true,

    blurDefaultMode: 'blur',
    blurDefaultIntensity: 18,
    blurDefaultShape: 'rect',

    renamePrefix: '',
    renameSuffix: '',
    renamePattern: 'keep',
    customBaseName: 'photo',
    preserveSubfolders: true,
  };

  switch (tool) {
    case 'resize-compress':
      return {
        ...base,
        resizeMode: 'width-only',
        targetWidth: 1920,
        lockAspectRatio: true,
        compressionMode: 'quality',
        quality: 85,
        outputFormat: 'image/jpeg',
        stripMetadata: false,
      };
    case 'veol-thumb':
      return {
        ...base,
        resizeMode: 'exact-crop',
        targetWidth: 360,
        targetHeight: 210,
        lockAspectRatio: true,
        outputFormat: 'image/jpeg',
        quality: 88,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_miniature_360x210',
      };
    case 'veol-banner':
      return {
        ...base,
        resizeMode: 'exact-crop',
        targetWidth: 964,
        targetHeight: 140,
        lockAspectRatio: true,
        outputFormat: 'image/jpeg',
        quality: 88,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_banniere_964x140',
      };
    case 'veol-article':
      return {
        ...base,
        resizeMode: 'width-only',
        targetWidth: 1280,
        lockAspectRatio: true,
        preventUpscale: true,
        cropPreset: 'none',
        outputFormat: 'image/jpeg',
        quality: 85,
        enforceMax72Dpi: true,
        stripMetadata: false,
        renameSuffix: '_article_1280',
      };
    case 'convert':
      return { ...base, outputFormat: 'image/jpeg', quality: 90 };
    case 'remove-bg':
      return {
        ...base,
        outputFormat: 'image/png',
        bgRemoveMode: 'color-key',
        bgReplaceColor: 'transparent',
        colorTolerance: 20,
      };
    case 'logo-white':
      return {
        ...base,
        outputFormat: 'image/png',
        monochromeMode: true,
        monochromeColor: '#ffffff',
        autoStripLightBg: true,
        keepSvgVector: true,
        colorTolerance: 18,
        renameSuffix: '_blanc',
      };
    case 'privacy-blur':
      return {
        ...base,
        outputFormat: 'image/jpeg',
        quality: 90,
        stripMetadata: true, // Anonymisation RGPD : retire EXIF/GPS par défaut
        renameSuffix: '_floute',
      };
    case 'crop':
      return { ...base, cropPreset: '1:1', outputFormat: 'image/jpeg', quality: 90 };
    case 'rename':
      return {
        ...base,
        outputFormat: 'original',
        renamePattern: 'sequential',
        customBaseName: 'image',
        quality: 92,
      };
    case 'mockup':
      return {
        ...base,
        outputFormat: 'image/png',
      };
    case 'qrcode':
    default:
      return base;
  }
}

export function getDropzoneCopyForTool(
  tool: ToolId | null,
  config: PipelineConfig
): { title: string; subtitle: string; primaryBtn: string } {
  switch (tool) {
    case 'veol-thumb':
    case 'veol-banner':
      return {
        title: 'Glissez votre image ici pour la cadrer',
        subtitle: `Cadrage interactif ${config.targetWidth}×${config.targetHeight} px • 72 ppp auto • HEIC iPhone, JPG, PNG, WebP ou Cmd+V`,
        primaryBtn: 'Sélectionner une image',
      };
    case 'logo-white':
      return {
        title: 'Glissez votre logo couleur ici (PNG, SVG, WebP, JPG)',
        subtitle:
          'Passage instantané en blanc pur (#FFFFFF) sur fond 100 % transparent • Format vectoriel SVG conservé ou export PNG HD',
        primaryBtn: 'Sélectionner un logo',
      };
    case 'privacy-blur':
      return {
        title: 'Glissez les photos ou captures à anonymiser ici',
        subtitle:
          'Flou gaussien, mosaïque ou bandeau opaque • Traitement 100 % local (aucun fichier envoyé) • EXIF/GPS retirés par défaut',
        primaryBtn: 'Sélectionner des images',
      };
    case 'mockup':
      return {
        title: 'Glissez une ou plusieurs captures d’écran ici',
        subtitle:
          'PC portable, Smartphone, Tablette ou Fenêtre Navigateur • Export PNG/JPG/WebP, Copier ou ZIP par lot • Cmd+V supporté',
        primaryBtn: 'Sélectionner des captures',
      };
    default:
      return {
        title: 'Glissez vos images ou un dossier complet ici',
        subtitle:
          'Traitement par lot 100 % local • HEIC / HEIF (iPhone), JPG, PNG, WebP, AVIF, SVG • Dossiers complets ou Cmd+V pour coller',
        primaryBtn: 'Sélectionner des images',
      };
  }
}
