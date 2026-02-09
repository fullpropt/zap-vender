import { useEffect } from 'react';
import { contatosMarkup } from '../legacy/contatosMarkup';

type ContatosGlobals = {
  initContacts?: () => void;
};

export default function Contatos() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/contatos');

      if (cancelled) return;

      const win = window as Window & ContatosGlobals;
      if (typeof win.initContacts === 'function') {
        win.initContacts();
      } else if (typeof (mod as { initContacts?: () => void }).initContacts === 'function') {
        (mod as { initContacts?: () => void }).initContacts?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: contatosMarkup }} />;
}