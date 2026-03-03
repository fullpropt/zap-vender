import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './faq.css';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  badge?: string;
}

const FAQ_PREFIX = 'faq-';

export default function FaqSection() {
  const faqItems: FaqItem[] = useMemo(
    () => [
      {
        id: 'pagamento',
        question: 'Como funciona o pagamento?',
        answer:
          'A cobranca e mensal recorrente, com renovacao automatica. Voce pode cancelar quando quiser, sem burocracia.',
        badge: 'Financeiro'
      },
      {
        id: 'fidelidade',
        question: 'Existe fidelidade ou contrato minimo?',
        answer: 'Nao. O plano e flexivel e sem fidelidade obrigatoria.'
      },
      {
        id: 'plano-incluso',
        question: 'O que esta incluso no plano?',
        answer:
          '- CRM\n- Inbox\n- Campanhas\n- Automacoes\n- Funil\n- WhatsApps',
        badge: 'Recursos'
      },
      {
        id: 'implantacao',
        question: 'Como funciona a implantacao?',
        answer:
          'O acesso e liberado de forma imediata apos a confirmacao e voce pode contratar suporte opcional de implantacao.',
        badge: 'Onboarding'
      },
      {
        id: 'upgrade',
        question: 'Posso fazer upgrade depois?',
        answer:
          'Sim. Voce pode migrar de plano a qualquer momento, mantendo historico e dados ja cadastrados.'
      },
      {
        id: 'checkout',
        question: 'Posso contratar direto pelo checkout?',
        answer:
          'Sim. A estrutura permite checkout direto com Stripe, Asaas ou Mercado Pago.'
      }
    ],
    []
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const [panelHeights, setPanelHeights] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLElement | null>(null);
  const panelContentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prefersReducedMotionRef = useRef(false);

  const parseHashToFaqId = useCallback((hash: string): string | null => {
    const normalized = String(hash || '').trim();
    if (!normalized) return null;

    const direct = normalized.replace(/^#/, '').toLowerCase();
    if (direct.startsWith(FAQ_PREFIX)) {
      return direct.slice(FAQ_PREFIX.length);
    }

    const match = direct.match(/faq-([a-z0-9-]+)/i);
    return match ? match[1].toLowerCase() : null;
  }, []);

  const openItemFromHash = useCallback(
    (hash: string) => {
      const targetId = parseHashToFaqId(hash);
      if (!targetId) return;

      const exists = faqItems.some((item) => item.id === targetId);
      if (!exists) return;

      setOpenId(targetId);

      window.requestAnimationFrame(() => {
        const target = document.getElementById(`${FAQ_PREFIX}item-${targetId}`);
        if (!target) return;
        target.scrollIntoView({
          behavior: prefersReducedMotionRef.current ? 'auto' : 'smooth',
          block: 'center'
        });
      });
    },
    [faqItems, parseHashToFaqId]
  );

  const updatePanelHeights = useCallback(() => {
    const nextHeights: Record<string, number> = {};
    faqItems.forEach((item) => {
      nextHeights[item.id] = panelContentRefs.current[item.id]?.scrollHeight ?? 0;
    });
    setPanelHeights(nextHeights);
  }, [faqItems]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
    };

    applyPreference();
    mediaQuery.addEventListener('change', applyPreference);

    return () => {
      mediaQuery.removeEventListener('change', applyPreference);
    };
  }, []);

  useEffect(() => {
    updatePanelHeights();
    const onResize = () => updatePanelHeights();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [updatePanelHeights]);

  useEffect(() => {
    openItemFromHash(window.location.hash);
    const onHashChange = () => openItemFromHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [openItemFromHash]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const cards = Array.from(host.querySelectorAll<HTMLElement>('.faq-accordion-item'));
    if (!cards.length) return;

    if (prefersReducedMotionRef.current) {
      cards.forEach((card) => card.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const renderAnswer = (answer: string) => {
    const lines = answer
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const looksLikeList = lines.length > 1 && lines.every((line) => line.startsWith('-'));
    if (!looksLikeList) {
      return <p>{answer}</p>;
    }

    return (
      <ul>
        {lines.map((line) => (
          <li key={line}>{line.replace(/^-+\s*/, '')}</li>
        ))}
      </ul>
    );
  };

  return (
    <section className="faq-section-premium" aria-labelledby="faq-title" ref={containerRef}>
      <div className="faq-section-head">
        <h2 id="faq-title">Perguntas frequentes</h2>
        <p>Tudo que voce precisa saber para comecar com seguranca.</p>
      </div>

      <div className="faq-accordion-grid">
        {faqItems.map((item, index) => {
          const expanded = openId === item.id;
          const panelId = `${FAQ_PREFIX}panel-${item.id}`;
          const triggerId = `${FAQ_PREFIX}trigger-${item.id}`;
          const itemHashId = `${FAQ_PREFIX}${item.id}`;
          const contentHeight = panelHeights[item.id] ?? 0;

          return (
            <article
              className="faq-accordion-item"
              id={`${FAQ_PREFIX}item-${item.id}`}
              key={item.id}
              style={{ transitionDelay: `${index * 55}ms` }}
            >
              <button
                type="button"
                id={triggerId}
                className="faq-accordion-trigger"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => handleToggle(item.id)}
              >
                <span className="faq-trigger-copy">
                  {item.badge && <span className="faq-badge">{item.badge}</span>}
                  <span className="faq-question">{item.question}</span>
                </span>
                <span className={`faq-arrow ${expanded ? 'is-open' : ''}`} aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                data-hash={itemHashId}
                className={`faq-accordion-panel ${expanded ? 'is-open' : ''}`}
                style={{
                  maxHeight: expanded ? `${contentHeight}px` : '0px',
                  opacity: expanded ? 1 : 0,
                  transform: expanded ? 'translateY(0px)' : 'translateY(-6px)'
                }}
              >
                <div
                  className="faq-accordion-content"
                  ref={(el) => {
                    panelContentRefs.current[item.id] = el;
                  }}
                >
                  {renderAnswer(item.answer)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
