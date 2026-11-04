import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ImageItem } from '../types';
import { Smartphone, Laptop, Download, Move, Maximize2, ShieldCheck, Check } from 'lucide-react';
import { enforce72DpiOnPngBlob } from '../utils/exifAndDpi';

export type DeviceType = 'smartphone' | 'laptop';
export type FitMode = 'contain' | 'cover';

interface MockupStudioProps {
  items: ImageItem[];
  onClose?: () => void;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ items }) => {
  const [device, setDevice] = useState<DeviceType>('laptop');
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [bgColor, setBgColor] = useState<string>('transparent'); // Par défaut transparent
  const [showShadow, setShowShadow] = useState(true);
  const [panY, setPanY] = useState(0); // Défilement vertical de la capture (0-100%)
  const [isDownloading, setIsDownloading] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);

  const activeItem = items[activeItemIndex] || items[0] || null;

  // Background presets (Transparent en 1er par défaut)
  const bgPresets = [
    { label: 'Transparent (PNG)', value: 'transparent' },
    { label: 'Beige Penl', value: '#FAF8F5' },
    { label: 'Blanc Pur', value: '#FFFFFF' },
    { label: 'Gris Studio', value: '#E5E5E5' },
    { label: 'Gris Sombre', value: '#1C1917' },
    { label: 'Dégradé Ciel', value: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)' },
    { label: 'Dégradé Crépuscule', value: 'linear-gradient(135deg, #ffedd5 0%, #fee2e2 100%)' },
  ];

  // Rendu Canvas unifié (utilisé à la fois pour l'aperçu Retina et l'export téléchargé)
  const renderCanvas = useCallback(
    (canvas: HTMLCanvasElement, img: HTMLImageElement | null) => {
      canvas.width = 2400;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;

      // 1. Fond (transparent ou couleur/dégradé)
      if (bgColor === 'transparent') {
        ctx.clearRect(0, 0, 2400, 1600);
      } else if (bgColor.startsWith('linear-gradient')) {
        const grad = ctx.createLinearGradient(0, 0, 2400, 1600);
        if (bgColor.includes('#e0f2fe')) {
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#f0fdf4');
        } else {
          grad.addColorStop(0, '#ffedd5');
          grad.addColorStop(1, '#fee2e2');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 2400, 1600);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 2400, 1600);
      }

      if (!img) return;

      const imgAspect = img.naturalWidth / img.naturalHeight;

      if (device === 'laptop') {
        // Laptop Screen Coordinates (True 16:10 ratio, 1500 x 937.5 px)
        const lw = 1500;
        const lh = 937.5;
        const lx = (2400 - lw) / 2;
        const ly = (1600 - lh) / 2 - 20;

        const baseW = lw * 1.12;
        const baseX = (2400 - baseW) / 2;
        const baseY = ly + lh;
        const baseH = 22;

        // Ombre portée douce sous l'ordinateur (alignée au millimètre sur le corps du PC)
        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 55;
          ctx.shadowOffsetY = 24;
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(lx, ly, lw, lh, [18, 18, 0, 0]);
          ctx.roundRect(baseX, baseY, baseW, baseH, [2, 2, 12, 12]);
          ctx.fill();
          ctx.restore();
        }

        // 1. Capot écran PC (Châssis sombre, bordure fine moderne)
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, [18, 18, 2, 2]);
        ctx.fill();

        // Fin contour du capot
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Webcam supérieure centrée
        ctx.fillStyle = '#383533';
        ctx.beginPath();
        ctx.arc(lx + lw / 2, ly + 12, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#171717';
        ctx.beginPath();
        ctx.arc(lx + lw / 2, ly + 12, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 2. Surface d'affichage (Bordure ultra-fine de 24 px pour un look élégant et moderne)
        const bezel = 24;
        const sx = lx + bezel;
        const sy = ly + bezel;
        const sw = lw - bezel * 2;
        const sh = lh - bezel * 2;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 4);
        ctx.clip();

        // Fond sombre de l'écran
        ctx.fillStyle = '#0c0a09';
        ctx.fillRect(sx, sy, sw, sh);

        // Dessin de la capture
        const screenAspect = sw / sh;
        let drawW: number;
        let drawH: number;
        let drawX: number;
        let drawY: number;

        if (fitMode === 'contain') {
          if (imgAspect > screenAspect) {
            drawW = sw;
            drawH = sw / imgAspect;
          } else {
            drawH = sh;
            drawW = sh * imgAspect;
          }
          drawX = sx + (sw - drawW) / 2;
          drawY = sy + (sh - drawH) / 2;
        } else {
          // Cover mode (remplit la largeur et défilement vertical)
          if (imgAspect > screenAspect) {
            drawH = sh;
            drawW = sh * imgAspect;
          } else {
            drawW = sw;
            drawH = sw / imgAspect;
          }
          drawX = sx + (sw - drawW) / 2;
          drawY = sy - (drawH - sh) * (panY / 100);
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();

        // 3. Base en aluminium brossé (Unibody propre, sans artefact de coin)
        // Charnière noire
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(lx + 120, baseY - 2, lw - 240, 3);

        // Châssis aluminium unibody avec coins arrondis continus
        ctx.beginPath();
        ctx.roundRect(baseX, baseY, baseW, baseH, [2, 2, 12, 12]);
        const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX, baseY + baseH);
        baseGrad.addColorStop(0, '#f4f4f5'); // filet lumineux supérieur
        baseGrad.addColorStop(0.12, '#e4e4e7');
        baseGrad.addColorStop(0.7, '#d4d4d8');
        baseGrad.addColorStop(1, '#a1a1aa'); // chanfrein inférieur
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // Liseré inférieur continu (zéro débordement)
        ctx.strokeStyle = '#71717a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Encoche centrale pour ouverture facile
        const notchW = 140;
        const notchH = 6;
        const notchX = (2400 - notchW) / 2;
        ctx.beginPath();
        ctx.roundRect(notchX, baseY, notchW, notchH, [0, 0, 5, 5]);
        ctx.fillStyle = '#71717a';
        ctx.fill();

        // Ombrage creux de l'encoche
        ctx.fillStyle = '#52525b';
        ctx.fillRect(notchX + 6, baseY, notchW - 12, 1.5);
      } else {
        // Smartphone (True 9:19 ratio)
        const pw = 660;
        const ph = 1420;
        const px = (2400 - pw) / 2;
        const py = (1600 - ph) / 2;

        if (showShadow) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 60;
          ctx.shadowOffsetY = 30;
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.roundRect(px, py, pw, ph, 64);
          ctx.fill();
          ctx.restore();
        }

        // Boîtier extérieur smartphone
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 64);
        ctx.fill();

        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Écran smartphone
        const sx = px + 20;
        const sy = py + 20;
        const sw = pw - 40;
        const sh = ph - 40;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 48);
        ctx.clip();

        ctx.fillStyle = '#0c0a09';
        ctx.fillRect(sx, sy, sw, sh);

        const screenAspect = sw / sh;
        let drawW: number;
        let drawH: number;
        let drawX: number;
        let drawY: number;

        if (fitMode === 'contain') {
          if (imgAspect > screenAspect) {
            drawW = sw;
            drawH = sw / imgAspect;
          } else {
            drawH = sh;
            drawW = sh * imgAspect;
          }
          drawX = sx + (sw - drawW) / 2;
          drawY = sy + (sh - drawH) / 2;
        } else {
          if (imgAspect > screenAspect) {
            drawH = sh;
            drawW = sh * imgAspect;
          } else {
            drawW = sw;
            drawH = sw / imgAspect;
          }
          drawX = sx + (sw - drawW) / 2;
          drawY = sy - (drawH - sh) * (panY / 100);
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Dynamic Island
        const islandW = 150;
        const islandH = 34;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(sx + (sw - islandW) / 2, sy + 20, islandW, islandH, 17);
        ctx.fill();

        // Objectif caméra frontal
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(sx + (sw - islandW) / 2 + islandW - 24, sy + 20 + islandH / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    },
    [bgColor, device, fitMode, panY, showShadow]
  );

  // Mise à jour de l'aperçu direct dans le canvas à chaque changement de paramètre
  useEffect(() => {
    if (!activeItem) return;

    const updatePreview = (img: HTMLImageElement) => {
      if (previewCanvasRef.current) {
        renderCanvas(previewCanvasRef.current, img);
      }
    };

    if (loadedImageRef.current && loadedImageRef.current.url === activeItem.originalUrl) {
      updatePreview(loadedImageRef.current.img);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImageRef.current = { url: activeItem.originalUrl, img };
        updatePreview(img);
      };
      img.src = activeItem.originalUrl;
    }
  }, [activeItem, renderCanvas]);

  // Téléchargement du mockup (HD ou VEOL)
  const handleDownload = async (target: 'hd' | 'veol') => {
    if (!activeItem || !previewCanvasRef.current) return;
    setIsDownloading(true);

    try {
      const sourceCanvas = previewCanvasRef.current;
      let exportCanvas = sourceCanvas;

      if (target === 'veol') {
        // Sous-échantillonnage de haute précision à 1280x853 pour VEOL
        const veolW = 1280;
        const veolH = Math.round((1280 * 1600) / 2400); // 853 px
        const vCanvas = document.createElement('canvas');
        vCanvas.width = veolW;
        vCanvas.height = veolH;
        const vCtx = vCanvas.getContext('2d')!;
        vCtx.imageSmoothingEnabled = true;
        vCtx.imageSmoothingQuality = 'high';
        vCtx.drawImage(sourceCanvas, 0, 0, veolW, veolH);
        exportCanvas = vCanvas;
      }

      exportCanvas.toBlob(async (blob) => {
        setIsDownloading(false);
        if (!blob) return;

        let finalBlob = blob;
        if (target === 'veol') {
          // Injection stricte du chunk pHYs 72 ppp dans le PNG
          finalBlob = await enforce72DpiOnPngBlob(blob);
        }

        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = activeItem.file.name.replace(/\.[^.]+$/, '');
        a.download =
          target === 'veol'
            ? `mockup_veol_${device}_${baseName}.png`
            : `mockup_hd_${device}_${baseName}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setIsDownloading(false);
    }
  };

  if (!activeItem) {
    return (
      <div className="p-8 text-center text-stone-500 font-mono text-xs">
        Veuillez charger au moins une capture d'écran pour générer un mockup.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre de contrôle principale */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200/90 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sélecteur d'appareil */}
          <div className="inline-flex rounded-xl bg-stone-200/70 p-1">
            <button
              type="button"
              onClick={() => setDevice('laptop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                device === 'laptop'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Laptop className="w-4 h-4" />
              Ordinateur Portable
            </button>
            <button
              type="button"
              onClick={() => setDevice('smartphone')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                device === 'smartphone'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Smartphone
            </button>
          </div>

          {/* Mode de cadrage (Ajuster entier vs Remplir/Défiler) */}
          <div className="inline-flex rounded-xl bg-stone-200/70 p-1">
            <button
              type="button"
              onClick={() => setFitMode('cover')}
              title="Remplir la largeur et faire défiler verticalement"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                fitMode === 'cover'
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              Remplir
            </button>
            <button
              type="button"
              onClick={() => setFitMode('contain')}
              title="Afficher la capture entière sans coupure"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                fitMode === 'contain'
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ajuster entier
            </button>
          </div>

          {/* Défilement / Pan vertical (affiché en mode cover) */}
          {fitMode === 'cover' && (
            <div className="flex items-center gap-2 pl-2 border-l border-stone-300">
              <span className="text-xs text-stone-500 font-medium">Défilement :</span>
              <input
                type="range"
                min={0}
                max={100}
                value={panY}
                onChange={(e) => setPanY(Number(e.target.value))}
                className="w-24 accent-stone-900 cursor-pointer"
                title="Faire défiler la capture de haut en bas"
              />
            </div>
          )}

          {/* Sélecteur de couleur de fond (Transparent par défaut) */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-stone-300">
            <span className="text-xs text-stone-500 font-medium">Fond :</span>
            {bgPresets.map((bg) => {
              const isSelected = bgColor === bg.value;
              const isTransparent = bg.value === 'transparent';
              return (
                <button
                  key={bg.label}
                  type="button"
                  onClick={() => setBgColor(bg.value)}
                  style={isTransparent ? undefined : { background: bg.value }}
                  title={bg.label}
                  className={`w-6 h-6 rounded-full border shadow-sm transition-all relative cursor-pointer ${
                    isTransparent
                      ? 'bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[size:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0] bg-white'
                      : ''
                  } ${
                    isSelected
                      ? 'scale-125 ring-2 ring-orange-500 ring-offset-1 border-white z-10'
                      : 'hover:scale-110 border-stone-300'
                  }`}
                />
              );
            })}
          </div>

          {/* Toggle ombre */}
          <button
            type="button"
            onClick={() => setShowShadow(!showShadow)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              showShadow
                ? 'bg-stone-100 text-stone-800 border-stone-300 font-medium'
                : 'text-stone-400 border-dashed border-stone-300 hover:text-stone-600'
            }`}
          >
            Ombre {showShadow ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Boutons d'export (VEOL & HD) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton VEOL */}
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('veol')}
            title="Export optimisé pour le CMS VEOL : 1280 px max, 72 ppp garanti, PNG transparent ou avec fond"
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-tactile flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4 text-orange-200" />
            <span>Format VEOL (1280px • 72 ppp)</span>
          </button>

          {/* Bouton HD standard */}
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('hd')}
            title="Export master haute résolution (2400 × 1600 px)"
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-tactile flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>HD Master (2400px)</span>
          </button>
        </div>
      </div>

      {/* Scène de prévisualisation directe Retina (Canvas unifié pixel-perfect) */}
      <div className="relative w-full min-h-[460px] sm:min-h-[580px] rounded-3xl border border-stone-200/90 flex items-center justify-center p-4 sm:p-8 overflow-hidden shadow-inner bg-[linear-gradient(45deg,#f0eee9_25%,transparent_25%),linear-gradient(-45deg,#f0eee9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0eee9_75%),linear-gradient(-45deg,transparent_75%,#f0eee9_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] bg-white">
        <canvas
          ref={previewCanvasRef}
          className="w-full max-w-2xl sm:max-w-3xl h-auto select-none pointer-events-none drop-shadow-sm transition-all"
        />
      </div>

      {/* Barre de sélection multi-captures */}
      {items.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="font-mono text-xs text-stone-500 mr-2 shrink-0">
            Captures ({items.length}) :
          </span>
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setActiveItemIndex(idx)}
              className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                activeItemIndex === idx
                  ? 'border-orange-600 scale-105 shadow-sm'
                  : 'border-stone-200 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={it.originalUrl} alt={it.file.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
