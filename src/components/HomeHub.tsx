import React from 'react';
import { ToolId } from '../types';
import { VEOL_TOOLS, MAIN_TOOLS } from '../data/tools';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';

interface HomeHubProps {
  onSelectTool: (toolId: ToolId) => void;
  onOpenLegal: () => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({ onSelectTool, onOpenLegal }) => {
  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 md:py-14 flex flex-col justify-between">
      <div className="space-y-8">
        {/* Hero Header */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-orange-600 font-semibold mb-2.5">
            <span>[ PENL.IMG — SUITE IMAGE LOCALE ]</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 leading-[1.12]">
            Quel résultat voulez-vous obtenir ?
          </h1>
          <p className="text-stone-600 text-base mt-2.5 leading-relaxed">
            Sélectionnez un outil ou glissez directement vos images (HEIC iPhone, JPG, PNG, WebP, SVG) ou un dossier complet. Aucune donnée ne quitte votre navigateur.
          </p>
        </div>

        {/* VEOL Quick Format Tiles */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Formats rapides VEOL (72 ppp auto)
            </span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {VEOL_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool(tool.id)}
                className={`group text-left bg-white rounded-2xl p-4 px-5 border border-stone-200/90 ${tool.accentBorder} shadow-tactile hover:shadow-tactile-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-4 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl ${tool.accentBg} ${tool.accentText} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                  >
                    {tool.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-base font-bold text-stone-900 group-hover:text-orange-600 transition-colors">
                        {tool.title}
                      </h2>
                      <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                        {tool.badge}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{tool.subtitle}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Main 3x3 Balanced Bento Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Outils standards, anonymisation & studio
            </span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MAIN_TOOLS.map((tool) => {
              const CardComponent = tool.externalUrl ? 'a' : 'button';
              const cardProps = tool.externalUrl
                ? {
                    href: tool.externalUrl,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {
                    type: 'button' as const,
                    onClick: () => onSelectTool(tool.id),
                  };

              return (
                <CardComponent
                  key={tool.id}
                  {...cardProps}
                  className={`group text-left bg-white rounded-2xl p-5 border border-stone-200/90 ${
                    tool.accentBorder
                  } shadow-tactile hover:shadow-tactile-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[180px] cursor-pointer ${
                    tool.featured
                      ? 'bg-gradient-to-br from-white to-orange-50/50'
                      : tool.id === 'privacy-blur'
                      ? 'bg-gradient-to-br from-white to-rose-50/40'
                      : tool.id === 'mockup'
                      ? 'bg-gradient-to-br from-white to-cyan-50/35'
                      : tool.externalUrl
                      ? 'bg-gradient-to-br from-white to-emerald-50/25'
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-stone-400">
                        {tool.badge}
                      </span>
                      <div
                        className={`w-10 h-10 rounded-xl ${tool.accentBg} ${tool.accentText} flex items-center justify-center transition-transform group-hover:scale-110`}
                      >
                        {tool.icon}
                      </div>
                    </div>

                    <h2 className="font-display text-lg sm:text-xl font-bold text-stone-900 group-hover:text-orange-600 transition-colors flex items-center gap-2">
                      <span>{tool.title}</span>
                      {tool.externalUrl && (
                        <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors shrink-0" />
                      )}
                    </h2>
                    <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                      {tool.subtitle}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-stone-800">
                    <span>{tool.externalUrl ? 'Accéder au générateur' : "Ouvrir l'outil"}</span>
                    {tool.externalUrl ? (
                      <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                    )}
                  </div>
                </CardComponent>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="mt-14 pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500 font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Penl.img</span>
        </div>
        <div>
          <button
            type="button"
            onClick={onOpenLegal}
            className="hover:text-stone-900 underline underline-offset-2 transition cursor-pointer"
          >
            Mentions légales & Confidentialité (100% Local)
          </button>
        </div>
      </footer>
    </main>
  );
};
