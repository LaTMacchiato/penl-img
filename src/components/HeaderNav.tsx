import React, { useEffect, useRef, useState } from 'react';
import { ToolId } from '../types';
import { ALL_TOOLS, VEOL_TOOLS, MAIN_TOOLS } from '../data/tools';
import { ExternalLink, ChevronDown, Menu, X } from 'lucide-react';

interface HeaderNavProps {
  selectedTool: ToolId | null;
  itemsCount: number;
  onRequestSelectTool: (toolId: ToolId | null) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  selectedTool,
  itemsCount,
  onRequestSelectTool,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<'veol' | 'tools' | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const activeMeta = ALL_TOOLS.find((t) => t.id === selectedTool) || null;

  useEffect(() => {
    if (!openDesktopGroup) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDesktopGroup(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDesktopGroup(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDesktopGroup]);

  const handleSelect = (id: ToolId | null) => {
    setMobileMenuOpen(false);
    setOpenDesktopGroup(null);
    onRequestSelectTool(id);
  };

  const showRightActions = (itemsCount > 0 && !selectedTool) || Boolean(selectedTool);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#FAF8F5]/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="flex items-center gap-2.5 group text-left shrink-0 whitespace-nowrap cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-tactile group-hover:bg-orange-600 transition-colors shrink-0">
              P.
            </div>
            <div className="flex items-baseline whitespace-nowrap shrink-0">
              <span className="font-display font-extrabold tracking-tight text-base text-stone-900 whitespace-nowrap">
                Penl.img
              </span>
              <span className="hidden sm:inline-block ml-1.5 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                local
              </span>
            </div>
          </button>

          {/* Desktop categorized quick switcher when inside a tool */}
          {selectedTool && (
            <nav
              ref={navRef}
              aria-label="Navigation rapide des outils"
              className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-stone-300 shrink-0"
            >
              {/* VEOL Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={openDesktopGroup === 'veol'}
                  aria-controls="header-veol-menu"
                  aria-current={activeMeta?.category === 'veol' ? 'true' : undefined}
                  onClick={() => setOpenDesktopGroup((g) => (g === 'veol' ? null : 'veol'))}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeMeta?.category === 'veol'
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  <span>VEOL</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0" aria-hidden="true" />
                </button>
                {openDesktopGroup === 'veol' && (
                  <div
                    id="header-veol-menu"
                    className="absolute left-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-40"
                  >
                    {VEOL_TOOLS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-current={selectedTool === t.id ? 'page' : undefined}
                        onClick={() => handleSelect(t.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                          selectedTool === t.id
                            ? 'bg-stone-900 text-white'
                            : 'text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <span className={selectedTool === t.id ? 'text-orange-400' : t.accentText}>
                          {t.icon}
                        </span>
                        <div className="min-w-0">
                          <div>{t.title}</div>
                          <div
                            className={`font-mono text-[10px] ${
                              selectedTool === t.id ? 'text-stone-300' : 'text-stone-400'
                            }`}
                          >
                            {t.badge}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct key tools */}
              {MAIN_TOOLS.filter((t) =>
                ['resize-compress', 'convert', 'remove-bg', 'logo-white', 'privacy-blur', 'mockup'].includes(t.id)
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={selectedTool === t.id ? 'page' : undefined}
                  onClick={() => handleSelect(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedTool === t.id
                      ? 'bg-stone-900 text-white shadow-sm font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  {t.shortLabel}
                </button>
              ))}

              {/* More tools dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={openDesktopGroup === 'tools'}
                  aria-controls="header-more-menu"
                  onClick={() => setOpenDesktopGroup((g) => (g === 'tools' ? null : 'tools'))}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedTool === 'crop' || selectedTool === 'rename'
                      ? 'bg-stone-900 text-white shadow-sm font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  <span>Plus</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0" aria-hidden="true" />
                </button>
                {openDesktopGroup === 'tools' && (
                  <div
                    id="header-more-menu"
                    className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-40"
                  >
                    {MAIN_TOOLS.filter((t) => ['crop', 'rename', 'qrcode'].includes(t.id)).map((t) =>
                      t.externalUrl ? (
                        <a
                          key={t.id}
                          href={t.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-2">
                            <span className={t.accentText}>{t.icon}</span>
                            {t.title}
                          </span>
                          <ExternalLink className="w-3 h-3 text-stone-400" />
                        </a>
                      ) : (
                        <button
                          key={t.id}
                          type="button"
                          aria-current={selectedTool === t.id ? 'page' : undefined}
                          onClick={() => handleSelect(t.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                            selectedTool === t.id
                              ? 'bg-stone-900 text-white'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span className={selectedTool === t.id ? 'text-orange-400' : t.accentText}>
                            {t.icon}
                          </span>
                          {t.title}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {showRightActions && (
          <div className={`flex items-center gap-2 shrink-0 ${selectedTool ? 'lg:hidden' : ''}`}>
            {itemsCount > 0 && !selectedTool && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 font-medium whitespace-nowrap">
                {itemsCount} fichier{itemsCount > 1 ? 's' : ''}
              </span>
            )}

            {/* Mobile/Tablet tool switcher button */}
            {selectedTool && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                aria-expanded={mobileMenuOpen}
                aria-label="Changer d'outil"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span>Outils</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Responsive Mobile/Tablet Tool Drawer */}
      {mobileMenuOpen && selectedTool && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 py-4 shadow-lg">
          <div className="max-w-6xl mx-auto space-y-3">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Formats rapides VEOL
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VEOL_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={selectedTool === t.id ? 'page' : undefined}
                    onClick={() => handleSelect(t.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border text-left transition cursor-pointer ${
                      selectedTool === t.id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                    }`}
                  >
                    <span className={selectedTool === t.id ? 'text-orange-400' : t.accentText}>{t.icon}</span>
                    <span>{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Outils & Studio
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MAIN_TOOLS.map((t) =>
                  t.externalUrl ? (
                    <a
                      key={t.id}
                      href={t.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border bg-[#FAF8F5] text-stone-700 border-stone-200"
                    >
                      <span>{t.shortLabel}</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </a>
                  ) : (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(t.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border text-left transition cursor-pointer ${
                        selectedTool === t.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-[#FAF8F5] text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className={selectedTool === t.id ? 'text-orange-400' : t.accentText}>{t.icon}</span>
                      <span className="truncate">{t.shortLabel}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
