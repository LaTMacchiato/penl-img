import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, Scale, Server, HardDrive, Cookie, ExternalLink, FileText, AlertTriangle } from 'lucide-react';

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
      className="fixed inset-0 m-auto z-50 w-[94vw] max-w-2xl max-h-[90vh] bg-white rounded-3xl border border-stone-200/90 shadow-2xl p-0 backdrop:bg-stone-900/60 backdrop:backdrop-blur-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center font-mono font-bold text-xs shadow-tactile">
            <Scale className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-base sm:text-lg text-stone-900 leading-tight">
              Mentions légales, RGPD & CGU
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
            <span className="font-mono text-xs text-orange-600">01.</span> Éditeur du site (LCEN Art. 6-III)
          </h3>
          <div className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700 space-y-1.5">
            <p>
              Site édité par <strong>Thomas Marchand</strong>, agissant à titre personnel et non professionnel.
            </p>
            <p>
              Contact électronique :{' '}
              <a
                href="mailto:contact@thmarchand.fr"
                className="font-mono text-orange-600 hover:underline font-semibold"
              >
                contact@thmarchand.fr
              </a>
            </p>
            <p className="text-[11px] text-stone-500">
              Conformément à l'article 6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), l'éditeur a transmis ses éléments d'identification personnelle à l'hébergeur ci-après désigné, garantissant la préservation de son anonymat légal de personne physique tout en assurant la traçabilité requise par la loi.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">02.</span> Hébergement & Transfert hors UE
          </h3>
          <div className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700 space-y-1.5">
            <div className="flex items-start gap-2">
              <Server className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <p>
                  Ce site statique est hébergé par <strong>GitHub Inc.</strong> (service GitHub Pages).
                </p>
                <p className="text-[12px] text-stone-500">
                  Adresse : 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.<br />
                  Téléphone : +1 (877) 448-4820 • Site web : <a href="https://pages.github.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-800">pages.github.com</a>
                </p>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 border-t border-stone-200/60 pt-1.5">
              <strong>Garantie des transferts de données :</strong> GitHub Inc. est certifié conforme au Cadre de protection des données Union Européenne - États-Unis (<em>EU-U.S. Data Privacy Framework</em>), assurant un niveau adéquat de protection des données conformément à la décision d'adéquation de la Commission européenne du 10 juillet 2023 (Art. 45 du RGPD).
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">03.</span> Traitement des images : 100 % Local (Privacy by Design)
          </h3>
          <div className="bg-emerald-500/10 border border-emerald-600/20 rounded-xl p-3.5 text-emerald-950 space-y-2">
            <p className="font-medium text-xs sm:text-sm">
              Toutes les opérations d'édition (redimensionnement, compression, conversion, recadrage, pipette de suppression de fond et mockups) sont réalisées <strong>exclusivement dans la mémoire vive de votre navigateur web</strong>.
            </p>
            <ul className="text-emerald-900 text-xs space-y-1 list-disc list-inside">
              <li>Aucune image, métadonnée EXIF ou coordonnée GPS ne quitte votre appareil.</li>
              <li>Aucun transfert réseau ni téléversement vers un serveur ou un service cloud.</li>
              <li>Aucun modèle distant ni ressource tierce externe n'est téléchargé lors de l'utilisation.</li>
              <li>L'application s'exécute de manière entièrement autonome, même sans connexion Internet.</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">04.</span> Données personnelles, Journaux réseau & Droits RGPD
          </h3>
          <div className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700 space-y-2">
            <p>
              L'éditeur ne procède à <strong>aucune collecte, aucun stockage et aucun profilage</strong> de données personnelles, et n'intègre aucun traceur d'audience ou régie publicitaire.
            </p>
            <p className="text-[11px] text-stone-500">
              <strong>Journaux de sécurité (Logs techniques) :</strong> Lors de la délivrance des pages statiques, l'hébergeur GitHub enregistre de façon transitoire l'adresse IP et les requêtes HTTP dans ses journaux de connexion afin d'assurer la sécurité du réseau et la défense contre les cyberattaques (base légale : intérêt légitime, Art. 6.1.f du RGPD). Consultez la{' '}
              <a
                href="https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-800 underline inline-flex items-center gap-0.5"
              >
                Déclaration de confidentialité de GitHub <ExternalLink className="w-2.5 h-2.5" />
              </a>.
            </p>
            <div className="border-t border-stone-200/60 pt-2 text-[11px] text-stone-600 space-y-1">
              <p>
                <strong>Vos droits :</strong> Conformément aux articles 15 à 22 du RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de limitation sur vos données. Pour toute demande : <a href="mailto:contact@thmarchand.fr" className="underline font-mono">contact@thmarchand.fr</a>.
              </p>
              <p>
                <strong>Réclamation CNIL :</strong> Si vous considérez que le traitement de vos données ne respecte pas la réglementation, vous avez le droit d'introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) :{' '}
                <a
                  href="https://www.cnil.fr/plaintes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 underline font-semibold inline-flex items-center gap-0.5"
                >
                  www.cnil.fr/plaintes <ExternalLink className="w-2.5 h-2.5" />
                </a>.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">05.</span> Absence de Cookies & Stockage Local (ePrivacy)
          </h3>
          <div className="flex items-start gap-2 bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700">
            <Cookie className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p>
                Ce site <strong>n'utilise aucun cookie traceur, publicitaire ou de mesure d'audience</strong>.
              </p>
              <p className="text-[11px] text-stone-500">
                Seul le cache technique de votre navigateur (<em>Cache Storage</em> via Service Worker PWA) est sollicité pour permettre le fonctionnement hors-ligne et la rapidité d'exécution. Ce mécanisme est strictement nécessaire à la fourniture du service expressément demandé par l'utilisateur et entre dans le champ d'exemption de consentement prévu par l'article 82 de la loi Informatique et Libertés et les lignes directrices de la CNIL.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">06.</span> Conditions d'Utilisation & Limitation de Responsabilité
          </h3>
          <div className="bg-amber-500/10 border border-amber-600/20 rounded-xl p-3 text-stone-800 space-y-1.5 text-xs">
            <p>
              L'application <strong>Penl.img</strong> est mise à disposition gratuitement « en l'état » (<em>as is</em>), sans garantie d'aucune sorte, expresse ou implicite, quant à son adéquation à un usage professionnel spécifique ou à l'absence de dysfonctionnement technique.
            </p>
            <p className="text-stone-700">
              <strong>Sauvegarde des fichiers originaux :</strong> L'utilisateur est seul responsable de conserver une copie intégrale de sauvegarde de ses photographies originales avant d'effectuer un traitement. L'éditeur décline toute responsabilité en cas de perte de données ou d'altération de fichiers.
            </p>
            <p className="text-stone-700">
              <strong>Droits d'auteur et droit à l'image :</strong> L'utilisateur garantit détenir l'intégralité des droits de propriété intellectuelle et les autorisations requises (notamment le consentement des personnes photographiées) sur les images qu'il importe et traite dans l'outil.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section className="space-y-1.5">
          <h3 className="font-display font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            <span className="font-mono text-xs text-orange-600">07.</span> Propriété Intellectuelle & Licences Libres
          </h3>
          <p className="bg-stone-50 border border-stone-200/70 rounded-xl p-3 text-stone-700 text-xs">
            Le code source de Penl.img est distribué sous <strong>licence libre MIT</strong>. Le décodage local HEIF/HEIC s'appuie sur la bibliothèque open source <em>heic-to / libheif</em> (licence libre LGPL-3.0). Les polices typographiques intégrées (Plus Jakarta Sans, Inter, JetBrains Mono) sont distribuées sous licence libre <em>SIL Open Font License 1.1</em>. Les icônes vectorielles sont issues du projet <em>Lucide Icons</em> sous licence ISC/MIT.
          </p>
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
