import React, { useRef, useState, useEffect } from 'react';
import { ImageItem } from '../types';
import { Smartphone, Laptop, Download, RefreshCw, ZoomIn, ZoomOut, Move, Palette } from 'lucide-react';

export type DeviceType = 'smartphone' | 'laptop';

interface MockupStudioProps {
  items: ImageItem[];
  onClose?: () => void;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ items }) => {
  const [device, setDevice] = useState<DeviceType>('laptop');
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [bgColor, setBgColor] = useState<string>('#FAF8F5');
  const [showShadow, setShowShadow] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panY, setPanY] = useState(0); // For scrolling screenshot within viewport
  const [isDownloading, setIsDownloading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeItem = items[activeItemIndex] || items[0] || null;

  // Background color presets
  const bgPresets = [
    { label: 'Beige Penl', value: '#FAF8F5' },
    { label: 'Blanc Pur', value: '#FFFFFF' },
    { label: 'Gris Studio', value: '#E5E5E5' },
    { label: 'Gris Sombre', value: '#1C1917' },
    { label: 'Dégradé Ciel', value: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)' },
    { label: 'Dégradé Coucher de soleil', value: 'linear-gradient(135deg, #ffedd5 0%, #fee2e2 100%)' },
  ];

  // Draw and export the composite mockup to a high-res 2400x1600 canvas
  const handleDownloadMockup = async () => {
    if (!activeItem) return;
    setIsDownloading(true);

    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw background
    if (bgColor.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, 2400, 1600);
      if (bgColor.includes('#e0f2fe')) {
        grad.addColorStop(0, '#e0f2fe');
        grad.addColorStop(1, '#f0fdf4');
      } else {
        grad.addColorStop(0, '#ffedd5');
        grad.addColorStop(1, '#fee2e2');
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(0, 0, 2400, 1600);

    // 2. Load screenshot image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.src = activeItem.originalUrl;
    });

    if (device === 'laptop') {
      // Laptop Screen Coordinates on 2400x1600 canvas (True 16:10 ratio matching preview)
      const lw = 1500;
      const lh = 937.5; // exact 16:10
      const lx = (2400 - lw) / 2;
      const ly = (1600 - lh) / 2 - 20;

      // Soft Shadow under laptop
      if (showShadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 65;
        ctx.shadowOffsetY = 30;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh + 30, 20);
        ctx.fill();
        ctx.restore();
      }

      // 1. Laptop Display Lid (Dark slate border)
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, [20, 20, 4, 4]);
      ctx.fill();

      // Top WebCam dot
      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.arc(lx + lw / 2, ly + 14, 4, 0, Math.PI * 2);
      ctx.fill();

      // 2. Screen Inner Display Area (Thin realistic bezel: 28px left/right, 28px top, 28px bottom)
      const bezel = 28;
      const sx = lx + bezel;
      const sy = ly + bezel;
      const sw = lw - bezel * 2;
      const sh = lh - bezel * 2;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 6);
      ctx.clip();

      // Background inside screen before image loads
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(sx, sy, sw, sh);

      // Draw image inside screen (fit width)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      let drawW = sw;
      let drawH = sw / imgAspect;

      if (drawH < sh) {
        drawH = sh;
        drawW = sh * imgAspect;
      }

      const drawX = sx + (sw - drawW) / 2;
      const drawY = sy - (drawH - sh) * (panY / 100);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // 3. Laptop Base (Slightly wider than lid, premium aluminum finish)
      const baseW = lw * 1.14;
      const baseX = (2400 - baseW) / 2;
      const baseY = ly + lh;
      const baseH = 26;

      // Base shadow / bottom lip
      ctx.fillStyle = '#71717a';
      ctx.beginPath();
      ctx.roundRect(baseX - 4, baseY + 6, baseW + 8, baseH, [0, 0, 16, 16]);
      ctx.fill();

      // Base top gradient
      const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX, baseY + baseH);
      baseGrad.addColorStop(0, '#e4e4e7');
      baseGrad.addColorStop(0.5, '#d4d4d8');
      baseGrad.addColorStop(1, '#a1a1aa');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.roundRect(baseX, baseY, baseW, baseH, [4, 4, 16, 16]);
      ctx.fill();

      // Center thumb notch on base
      ctx.fillStyle = '#71717a';
      ctx.beginPath();
      ctx.roundRect(2400 / 2 - 80, baseY, 160, 8, [0, 0, 6, 6]);
      ctx.fill();

    } else {
      // Smartphone Coordinates
      const pw = 680;
      const ph = 1380;
      const px = (2400 - pw) / 2;
      const py = (1600 - ph) / 2;

      // Soft Shadow under phone
      if (showShadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        ctx.shadowBlur = 70;
        ctx.shadowOffsetY = 45;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 72);
        ctx.fill();
        ctx.restore();
      }

      // Phone Outer Case
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 68);
      ctx.fill();

      // Phone Screen
      const sx = px + 24;
      const sy = py + 24;
      const sw = pw - 48;
      const sh = ph - 48;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 48);
      ctx.clip();

      // Draw screenshot inside
      const imgAspect = img.naturalWidth / img.naturalHeight;
      let drawW = sw;
      let drawH = sw / imgAspect;

      if (drawH < sh) {
        drawH = sh;
        drawW = sh * imgAspect;
      }

      const drawX = sx + (sw - drawW) / 2;
      const drawY = sy + (sh - drawH) * (panY / 100);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Dynamic Island / Notch
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(sx + sw / 2 - 80, sy + 24, 160, 36, 18);
      ctx.fill();

      ctx.restore();
    }

    // Export blob
    canvas.toBlob((blob) => {
      setIsDownloading(false);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mockup_${device}_${activeItem.file.name.replace(/\.[^.]+$/, '')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
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
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200/90">
        <div className="flex flex-wrap items-center gap-3">
          {/* Device Selector */}
          <div className="inline-flex rounded-xl bg-stone-200/70 p-1">
            <button
              type="button"
              onClick={() => setDevice('laptop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                device === 'smartphone'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Smartphone
            </button>
          </div>

          {/* Background Selector */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-stone-300">
            <span className="text-xs text-stone-500 font-medium">Fond :</span>
            {bgPresets.map((bg) => (
              <button
                key={bg.label}
                type="button"
                onClick={() => setBgColor(bg.value)}
                style={{ background: bg.value }}
                title={bg.label}
                className={`w-6 h-6 rounded-full border shadow-sm transition-transform ${
                  bgColor === bg.value ? 'scale-125 ring-2 ring-orange-500' : 'hover:scale-110 border-stone-300'
                }`}
              />
            ))}
          </div>

          {/* Scroll / Pan inside frame */}
          <div className="flex items-center gap-2 pl-2 border-l border-stone-300">
            <span className="text-xs text-stone-500 font-medium">Position :</span>
            <input
              type="range"
              min={0}
              max={100}
              value={panY}
              onChange={(e) => setPanY(Number(e.target.value))}
              className="w-24 accent-stone-900"
              title="Faire défiler la capture à l'intérieur de l'écran"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          disabled={isDownloading}
          onClick={handleDownloadMockup}
          className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-tactile flex items-center gap-2 transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Télécharger Mockup HD (PNG)
        </button>
      </div>

      {/* Interactive Mockup Stage */}
      <div
        style={{ background: bgColor }}
        className="relative w-full min-h-[460px] sm:min-h-[560px] rounded-3xl border border-stone-200/90 flex items-center justify-center p-6 sm:p-12 overflow-hidden shadow-inner transition-colors"
      >
        {device === 'laptop' ? (
          /* Realistic Laptop Mockup */
          <div className="relative w-full max-w-2xl flex flex-col items-center">
            {/* Screen Lid */}
            <div
              className={`relative w-full aspect-[16/10] bg-stone-900 rounded-t-2xl p-3 sm:p-4 border border-stone-800 ${
                showShadow ? 'shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)]' : ''
              }`}
            >
              {/* Webcam */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-stone-700 rounded-full" />

              {/* Display Area */}
              <div className="relative w-full h-full bg-stone-950 rounded-lg overflow-hidden flex items-start justify-center">
                <img
                  src={activeItem.originalUrl}
                  alt={activeItem.file.name}
                  style={{
                    transform: `translateY(-${panY}%)`,
                  }}
                  className="w-full h-auto object-cover transition-transform duration-75 select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Laptop Base */}
            <div className="relative w-[114%] h-4 sm:h-5 bg-gradient-to-b from-stone-300 to-stone-400 rounded-b-xl border-t border-stone-200 shadow-md">
              {/* Center thumb notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-2 bg-stone-400/80 rounded-b-md" />
            </div>
          </div>
        ) : (
          /* Realistic Smartphone Mockup */
          <div className="relative w-64 sm:w-72 aspect-[9/19] flex flex-col items-center">
            <div
              className={`relative w-full h-full bg-stone-900 rounded-[44px] p-2.5 sm:p-3 border-4 border-stone-800 ${
                showShadow ? 'shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]' : ''
              }`}
            >
              {/* Display Area */}
              <div className="relative w-full h-full bg-stone-950 rounded-[34px] overflow-hidden">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10 flex items-center justify-end px-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-900" />
                </div>

                {/* Screenshot Image */}
                <img
                  src={activeItem.originalUrl}
                  alt={activeItem.file.name}
                  style={{
                    transform: `translateY(-${panY}%)`,
                  }}
                  className="w-full h-auto min-h-full object-cover transition-transform duration-75 select-none pointer-events-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multi-image thumbnail bar if multiple screenshots are loaded */}
      {items.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="font-mono text-xs text-stone-500 mr-2 shrink-0">Captures ({items.length}) :</span>
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setActiveItemIndex(idx)}
              className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                activeItemIndex === idx ? 'border-orange-600 scale-105' : 'border-stone-200 opacity-60 hover:opacity-100'
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
