import { useEffect } from 'react';
import { campanhasMarkup } from '../legacy/campanhasMarkup';

type CampanhasGlobals = {
  initCampanhas?: () => void;
};

export default function Campanhas() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/campanhas');

      if (cancelled) return;

      const win = window as Window & CampanhasGlobals;
      if (typeof win.initCampanhas === 'function') {
        win.initCampanhas();
      } else if (typeof (mod as { initCampanhas?: () => void }).initCampanhas === 'function') {
        (mod as { initCampanhas?: () => void }).initCampanhas?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: campanhasMarkup }} />;
}