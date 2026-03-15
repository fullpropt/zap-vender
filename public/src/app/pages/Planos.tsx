import { useMemo } from 'react';

export default function Planos() {
  const landingUrl = useMemo(() => '/landing-bruno/index.html', []);

  return (
    <main
      aria-label="Pagina de vendas"
      style={{
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        backgroundColor: '#020202'
      }}
    >
      <iframe
        title="Landing ZapVender"
        src={landingUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </main>
  );
}
