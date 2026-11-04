import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, Scale, Server, HardDrive, Cookie, ExternalLink } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClickOutside);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto z-50 w-[92vw] max-w-2xl max-h-[88vh] bg-white rounded-3xl border border-stone-200/90 shadow-2xl p-0 backdrop:bg-stone-900/60 backdrop:backdrop-blur-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center font-mono font-bold text-xs shadow-tactile">
            <Scale className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-base sm:text-lg text-stone-900 leading-tight">
              Mentions légales & Confidentialité
            </h2>
            <p className="font-mono text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Architecture 100% Locale • Zéro Collecte • RGPD & LCEN
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
        {/* Section 1 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">01.</span> Éditeur du site
          </h3>
          <p className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700">
            Site édité par <strong>Thomas Marchand</strong>.<br />
            Contact :{' '}
            <a
              href="mailto:contact@thmarchand.fr"
              className="font-mono text-orange-600 hover:underline font-semibold"
            >
              contact@thmarchand.fr
            </a>
            <br />
            <span className="text-[11px] text-stone-500 mt-1 block">
              Conformément à l'article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).
            </span>
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">02.</span> Hébergement
          </h3>
          <p className="flex items-start gap-2 bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700">
            <Server className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <span>
              Ce site est hébergé par <strong>GitHub Inc.</strong>, 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (service GitHub Pages).
            </span>
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">03.</span> Traitement des images (100 % Local & Hors-ligne)
          </h3>
          <div className="bg-emerald-500/10 border border-emerald-600/20 rounded-xl p-3 text-emerald-950 space-y-1">
            <p className="font-medium">
              Toutes les opérations de traitement, de modification, de conversion et de recadrage d'images réalisées sur Penl.img s'effectuent <strong>exclusivement en local dans la mémoire vive de votre navigateur</strong>.
            </p>
            <p className="text-emerald-800 text-[11px]">
              Aucune image, aucun fichier ni aucune métadonnée associée ne quitte votre appareil ni n'est envoyé vers un serveur distant. Les traitements reposent uniquement sur l'API HTML5 Canvas, WebAssembly et le cache d'exécution de votre machine.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">04.</span> Données personnelles et journaux serveur (RGPD)
          </h3>
          <p className="text-stone-700">
            L'éditeur du site ne collecte, ne stocke et n'analyse <strong>aucune donnée personnelle</strong>, et n'utilise aucun outil de mesure d'audience, de traçage, ni de ressource tierce externe (les polices et scripts sont hébergés 100% en local).
          </p>
          <p className="text-[11px] text-stone-500">
            Toutefois, à des fins de sécurité et de prévention des abus (défense contre les attaques DDoS), l'hébergeur GitHub Pages enregistre temporairement l'adresse IP des visiteurs dans ses journaux techniques (logs) sur la base de l'intérêt légitime (Art. 6.1.f du RGPD). Pour plus d'informations, consultez la{' '}
            <a
              href="https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-700 underline inline-flex items-center gap-0.5"
            >
              Déclaration de confidentialité de GitHub <ExternalLink className="w-2.5 h-2.5" />
            </a>.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">05.</span> Stockage local (Cookies / LocalStorage)
          </h3>
          <div className="flex items-start gap-2 bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700">
            <Cookie className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                Ce site <strong>n'utilise aucun cookie tiers ou publicitaire</strong>.
              </p>
              <p className="text-[11px] text-stone-500">
                Il utilise uniquement le stockage local de votre navigateur (localStorage / Cache Storage pour le fonctionnement hors-ligne PWA) afin de mémoriser vos préférences d'interface. Ces données techniques sont strictement nécessaires au fonctionnement de l'outil et sont exemptées de consentement conformément aux directives de la CNIL.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-stone-100 bg-[#FAF8F5]/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>penlimg.thmarchand.fr</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-tactile transition cursor-pointer"
        >
          Fermer
        </button>
      </div>
    </dialog>
  );
};
