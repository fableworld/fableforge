import { useState } from 'react';
import { AlertTriangle, Download, BookmarkPlus, X } from 'lucide-react';
import styles from './EphemeralBanner.module.css';

export interface EphemeralBannerProps {
  registryName: string;
  onImportRegistry: () => void;
  onSaveToCollection: () => void;
  onClose: () => void;
}

/**
 * Banner shown on the character detail page when viewing an ephemeral character
 * (loaded via deep link without importing the registry).
 *
 * Offers 3 actions:
 * 1. Import registry — adds the registry to monitored registries
 * 2. Save character — saves just this character to a local collection
 * 3. Close — dismiss the banner (character stays ephemeral)
 */
export function EphemeralBanner({
  registryName,
  onImportRegistry,
  onSaveToCollection,
  onClose,
}: EphemeralBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    onClose();
  };

  return (
    <div className={styles['ephemeral-banner']} role="alert">
      <AlertTriangle size={18} className={styles['ephemeral-banner__icon']} />

      <div className={styles['ephemeral-banner__text']}>
        <div className={styles['ephemeral-banner__title']}>
          Visualizzazione effimera
        </div>
        <div className={styles['ephemeral-banner__description']}>
          Questo personaggio è da &quot;{registryName}&quot; e sarà perso all&apos;uscita della pagina.
        </div>
      </div>

      <div className={styles['ephemeral-banner__actions']}>
        <button
          className={`${styles['ephemeral-banner__btn']} ${styles['ephemeral-banner__btn--import']}`}
          onClick={onImportRegistry}
          title="Importa il registry completo"
        >
          <Download size={13} />
          Importa
        </button>

        <button
          className={`${styles['ephemeral-banner__btn']} ${styles['ephemeral-banner__btn--save']}`}
          onClick={onSaveToCollection}
          title="Salva solo questo personaggio in una collezione locale"
        >
          <BookmarkPlus size={13} />
          Salva
        </button>

        <button
          className={`${styles['ephemeral-banner__btn']} ${styles['ephemeral-banner__btn--close']}`}
          onClick={handleClose}
          title="Chiudi banner"
          aria-label="Chiudi banner effimero"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
