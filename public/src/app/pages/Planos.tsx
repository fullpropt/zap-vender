import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FooterPremium from '../components/FooterPremium';
import PlatformMock from '../components/PlatformMock';
import { brandFullLogoUrl, brandLogoUrl, brandName } from '../lib/brand';

const pricingPlans = [
  {
    name: 'Starter',
    subtitle: 'Plano essencial para quem está iniciando a operação.',
    monthlyPrice: 'R$ 99',
    billing: 'Cobrança trimestral de R$ 297.',
    whatsappIncluded: 1,
    featuresState: 'Recursos avan\u00E7ados: N\u00E3o inclusos',
    ctaLabel: 'Escolher Starter',
    featured: false
  },
  {
    name: 'Premium',
    subtitle: 'Melhor equilíbrio para escalar atendimento e vendas.',
    monthlyPrice: 'R$ 199',
    billing: 'Cobrança trimestral de R$ 597.',
    whatsappIncluded: 3,
    featuresState: 'Todos os recursos liberados',
    ctaLabel: 'Escolher Premium',
    featured: true
  },
  {
    name: 'Business',
    subtitle: 'Camada para times com mais volume e mais operação.',
    monthlyPrice: 'R$ 349',
    billing: 'Cobrança trimestral de R$ 1.047.',
    whatsappIncluded: 5,
    featuresState: 'Todos os recursos liberados',
    ctaLabel: 'Escolher Business',
    featured: false
  }
];

const comparisonRows = [
  {
    feature: 'CRM + Inbox de atendimento',
    pro: 'Incluído',
    equipe: 'Incluído',
    enterprise: 'Incluído'
  },
  {
    feature: 'Campanhas + fila de envios',
    pro: 'Incluído',
    equipe: 'Incluído',
    enterprise: 'Incluído'
  },
  {
    feature: 'Automações e fluxos',
    pro: 'Incluído',
    equipe: 'Incluído',
    enterprise: 'Incluído'
  },
  {
    feature: 'Organização para equipe / permissões',
    pro: 'Essencial',
    equipe: 'Avançado (planejado)',
    enterprise: 'Avançado'
  },
  {
    feature: 'Onboarding e suporte',
    pro: 'Padrão',
    equipe: 'Prioritário (planejado)',
    enterprise: 'SLA / consultivo'
  },
  {
    feature: 'Customizações e integrações',
    pro: 'Sob avaliação',
    equipe: 'Opcional',
    enterprise: 'Prioritário'
  }
];

const resourceHighlights = [
  {
    title: 'Inbox operacional',
    subtitle: 'Atenda com contexto',
    description: 'Visualize mensagens, mídias e histórico do lead em um fluxo único de atendimento.'
  },
  {
    title: 'CRM e contatos',
    subtitle: 'Relação comercial organizada',
    description: 'Cadastre, segmente e acompanhe leads com informações centralizadas e filtros por sessão.'
  },
  {
    title: 'Campanhas e fila',
    subtitle: 'Envio com controle',
    description: 'Dispare mensagens com fila, reenvio e controle de throughput para reduzir risco operacional.'
  },
  {
    title: 'Automações e fluxos',
    subtitle: 'Menos trabalho manual',
    description: 'Crie jornadas e respostas para acelerar atendimento, follow-up e qualificação.'
  },
  {
    title: 'Gestão de contas WhatsApp',
    subtitle: 'Operação multi-sessão',
    description: 'Gerencie sessões, status de conexão e distribuição de envios a partir do painel.'
  },
  {
    title: 'Funil comercial',
    subtitle: 'Visão de pipeline',
    description: 'Acompanhe andamento das oportunidades e tome decisões com base no progresso real.'
  }
];

const journeySteps = [
  {
    step: '01',
    title: 'Captar e organizar',
    text: 'Entradas de contato e atendimento chegam ao painel, com visão de conversa e cadastro do lead.'
  },
  {
    step: '02',
    title: 'Atender e qualificar',
    text: 'Equipe responde no inbox, registra contexto e move oportunidades no funil.'
  },
  {
    step: '03',
    title: 'Automatizar e escalar',
    text: 'Fluxos, campanhas e fila de envio ajudam a manter constância sem sobrecarregar o time.'
  }
];

const heroAudienceChips = [
  'Agências',
  'Times comerciais',
  'Infoprodutos',
  'Prestadores',
  'Inside sales'
];

const strategyPillars = [
  {
    tag: 'WhatsApp + CRM',
    title: 'Atendimento centralizado',
    text: 'Concentre conversas, contatos e histórico em um único painel para tirar o time do improviso.'
  },
  {
    tag: 'Funil + Inbox',
    title: 'Processo comercial visível',
    text: 'Organize leads por etapa e acompanhe o funil com contexto real de atendimento.'
  },
  {
    tag: 'Fila + automação',
    title: 'Escala com controle',
    text: 'Use campanhas, filas e automações para crescer sem perder previsibilidade operacional.'
  }
];

const strategyProblems = [
  'Leads se perdem quando atendimento e CRM não conversam.',
  'Equipe atende sem contexto quando o histórico fica espalhado.',
  'Escala de envio sem fila e automação gera risco operacional.',
  'Decisão comercial piora quando não existe visão clara de funil.'
];

const strategyOutcomes = [
  'Atendimento com contexto + operação organizada em um painel.',
  'Mais clareza para a equipe comercial sobre status e próximos passos.',
  'Base pronta para crescer com campanhas, fluxos e novos planos.'
];

type HighlightTabId = 'dashboard' | 'chatInterno' | 'integracao' | 'meta';

type HighlightResourceItem = {
  subtitle: string;
  title: string;
  description: string;
  wide?: boolean;
};

type HighlightView = {
  id: HighlightTabId;
  navLabel: string;
  badge: string;
  title: string;
  subtitle: string;
  primaryText: string;
  secondaryText: string;
  stats: [{ value: string; label: string }, { value: string; label: string }];
  previewLeft: string[];
  previewRight: string[];
  resourceHeading: string;
  resourceSubtitle: string;
  resourceItems: HighlightResourceItem[];
};

const highlightViews: HighlightView[] = [
  {
    id: 'dashboard',
    navLabel: 'Dashboard',
    badge: 'Certificada pela Meta',
    title: 'Dashboard completo',
    subtitle: 'em tempo real.',
    primaryText: 'Acompanhe atendimentos, contatos, setores, agendamentos e campanhas em um painel único e organizado.',
    secondaryText: 'Tudo atualizado em tempo real para decisões mais rápidas e operação previsível.',
    stats: [
      { value: '674', label: 'Conversas no bot' },
      { value: '25', label: 'Atendentes online' }
    ],
    previewLeft: resourceHighlights.slice(0, 3).map((resource) => resource.title),
    previewRight: journeySteps.map((step) => step.title),
    resourceHeading: 'O que existe dentro da plataforma',
    resourceSubtitle: 'Resumo enxuto dos recursos para mostrar valor antes de entrar em detalhes de planos.',
    resourceItems: resourceHighlights.map((resource, index) => ({
      ...resource,
      wide: index === 0 || index === 3
    }))
  },
  {
    id: 'chatInterno',
    navLabel: 'Recursos',
    badge: 'Recursos principais',
    title: 'O que existe dentro',
    subtitle: 'da plataforma.',
    primaryText: 'Veja rapidamente os módulos que sua operação ganha antes de entrar na comparação de planos.',
    secondaryText: 'Tudo pensado para atendimento, CRM, campanhas e funil no mesmo fluxo de trabalho.',
    stats: [
      { value: '6', label: 'Módulos principais' },
      { value: '1', label: 'Painel unificado' }
    ],
    previewLeft: resourceHighlights.slice(0, 3).map((resource) => resource.title),
    previewRight: resourceHighlights.slice(3, 6).map((resource) => resource.title),
    resourceHeading: 'Colaboração em tempo real',
    resourceSubtitle: 'Estruture atendimento multi-time sem perder contexto comercial.',
    resourceItems: [
      {
        subtitle: 'Atendimento compartilhado',
        title: 'Fila por setor',
        description: 'Direcione cada conversa para o time certo e evite duplicidade de resposta.',
        wide: true
      },
      {
        subtitle: 'Contexto interno',
        title: 'Notas e repasses',
        description: 'Registre informações internas antes de transferir o atendimento.'
      },
      {
        subtitle: 'Controle de dono',
        title: 'Responsável ativo',
        description: 'Defina quem está conduzindo cada lead no momento.'
      },
      {
        subtitle: 'SLA comercial',
        title: 'Prioridades por etapa',
        description: 'Priorize conversas críticas para manter resposta no tempo esperado.',
        wide: true
      },
      {
        subtitle: 'Histórico único',
        title: 'Linha do tempo',
        description: 'Veja toda a jornada do lead no mesmo painel.'
      },
      {
        subtitle: 'Produtividade',
        title: 'Atalhos de resposta',
        description: 'Padronize respostas sem perder personalização.'
      }
    ]
  },
  {
    id: 'integracao',
    navLabel: 'Operação',
    badge: 'Operação conectada',
    title: 'Operação',
    subtitle: 'sem friccao.',
    primaryText: 'Conecte CRM, Inbox, campanhas e automações para manter dados sincronizados e operação escalável.',
    secondaryText: 'A equipe trabalha em um fluxo único enquanto os módulos trocam contexto em tempo real.',
    stats: [
      { value: '14', label: 'Integrações ativas' },
      { value: '99.8%', label: 'Entrega de eventos' }
    ],
    previewLeft: ['Webhook de eventos', 'Conexão com CRM', 'Sincronização de contatos'],
    previewRight: ['Fila de envio', 'Status por sessão', 'Logs de entrega'],
    resourceHeading: 'Base conectada para crescer',
    resourceSubtitle: 'Integre sistemas sem quebrar o fluxo de atendimento e vendas.',
    resourceItems: [
      {
        subtitle: 'API e webhook',
        title: 'Eventos em tempo real',
        description: 'Dispare automações e sincronizações conforme a interação acontece.',
        wide: true
      },
      {
        subtitle: 'Dados consistentes',
        title: 'Sync de contatos',
        description: 'Mantenha cadastro e status alinhados entre sistemas.'
      },
      {
        subtitle: 'Campanhas',
        title: 'Orquestração de envios',
        description: 'Ative campanhas com regras e filas por prioridade.'
      },
      {
        subtitle: 'Visibilidade',
        title: 'Log operacional',
        description: 'Rastreie erros, tentativas e sucesso de cada entrega.',
        wide: true
      },
      {
        subtitle: 'Segurança',
        title: 'Controle de credenciais',
        description: 'Gerencie acessos e tokens por equipe.'
      },
      {
        subtitle: 'Escalabilidade',
        title: 'Arquitetura pronta',
        description: 'Cresça volume sem refazer a operação.'
      }
    ]
  },
  {
    id: 'meta',
    navLabel: 'Estratégia',
    badge: 'Confiança de canal',
    title: 'Operação',
    subtitle: 'certificada.',
    primaryText: 'Com boas práticas de canal, sua equipe reduz risco de bloqueio e ganha previsibilidade no atendimento.',
    secondaryText: 'Padronize mensagens, acompanhe qualidade e mantenha governança da operação WhatsApp.',
    stats: [
      { value: '100%', label: 'Governanca de conta' },
      { value: '24/7', label: 'Monitoramento ativo' }
    ],
    previewLeft: ['Templates aprovados', 'Qualidade de sessão', 'Histórico de conformidade'],
    previewRight: ['Alertas de risco', 'Políticas de uso', 'Auditoria de operação'],
    resourceHeading: 'Confiança para operar em escala',
    resourceSubtitle: 'Proteja a conta e mantenha consistência no canal comercial.',
    resourceItems: [
      {
        subtitle: 'Conformidade',
        title: 'Políticas do canal',
        description: 'Mantenha equipe alinhada ao uso correto do WhatsApp.',
        wide: true
      },
      {
        subtitle: 'Qualidade',
        title: 'Monitoramento contínuo',
        description: 'Acompanhe indicadores para agir antes de incidentes.'
      },
      {
        subtitle: 'Governança',
        title: 'Permissões por perfil',
        description: 'Defina acesso por papel e responsabilidade.'
      },
      {
        subtitle: 'Previsibilidade',
        title: 'Histórico auditável',
        description: 'Tenha registro completo de alterações e eventos.',
        wide: true
      },
      {
        subtitle: 'Escalação',
        title: 'Alertas operacionais',
        description: 'Notifique rapidamente riscos de interrupção.'
      },
      {
        subtitle: 'Padrão',
        title: 'Biblioteca de mensagens',
        description: 'Centralize modelos para manter consistência.'
      }
    ]
  }
];

export default function Planos() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${brandName} | Planos`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  const [activeHighlightTab, setActiveHighlightTab] = useState<HighlightTabId>('dashboard');
  const [highlightTransition, setHighlightTransition] = useState<
    'idle' | 'out-next' | 'in-next' | 'out-prev' | 'in-prev'
  >('idle');
  const highlightSectionRef = useRef<HTMLElement | null>(null);
  const highlightShellRef = useRef<HTMLDivElement | null>(null);
  const activeHighlightTabRef = useRef<HighlightTabId>('dashboard');
  const wasHighlightLockedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const highlightSwitchLockedRef = useRef(false);
  const highlightSwitchUnlockTimeoutRef = useRef<number | null>(null);
  const highlightTransitionOutTimeoutRef = useRef<number | null>(null);
  const highlightTransitionInTimeoutRef = useRef<number | null>(null);
  const highlightTouchStartYRef = useRef<number | null>(null);
  const highlightTouchStartXRef = useRef<number | null>(null);
  const activeHighlightView = highlightViews.find((view) => view.id === activeHighlightTab) ?? highlightViews[0];
  const highlightTabOrder = highlightViews.map((view) => view.id);
  const activeHighlightIndex = Math.max(0, highlightTabOrder.indexOf(activeHighlightTab));
  const highlightNavProgress = highlightTabOrder.length > 1
    ? (activeHighlightIndex / (highlightTabOrder.length - 1)) * 100
    : 0;
  const highlightNavThumbTop = `clamp(0px, calc(${highlightNavProgress}% - 17px), calc(100% - 34px))`;

  useEffect(() => {
    activeHighlightTabRef.current = activeHighlightTab;
  }, []);

  useEffect(() => {
    return () => {
      if (highlightSwitchUnlockTimeoutRef.current !== null) {
        window.clearTimeout(highlightSwitchUnlockTimeoutRef.current);
      }

      if (highlightTransitionOutTimeoutRef.current !== null) {
        window.clearTimeout(highlightTransitionOutTimeoutRef.current);
      }

      if (highlightTransitionInTimeoutRef.current !== null) {
        window.clearTimeout(highlightTransitionInTimeoutRef.current);
      }
    };
  }, []);

  const highlightSwapOutDuration = 210;
  const highlightSwapInDuration = 420;
  const highlightSwapCooldown = 480;

  const lockHighlightSwitch = () => {
    highlightSwitchLockedRef.current = true;

    if (highlightSwitchUnlockTimeoutRef.current !== null) {
      window.clearTimeout(highlightSwitchUnlockTimeoutRef.current);
    }

    highlightSwitchUnlockTimeoutRef.current = window.setTimeout(() => {
      highlightSwitchLockedRef.current = false;
    }, highlightSwapCooldown);
  };

  const startHighlightSwap = (nextTab: HighlightTabId, direction: 'next' | 'prev') => {
    if (nextTab === activeHighlightTabRef.current) return false;

    if (highlightTransitionOutTimeoutRef.current !== null) {
      window.clearTimeout(highlightTransitionOutTimeoutRef.current);
    }

    if (highlightTransitionInTimeoutRef.current !== null) {
      window.clearTimeout(highlightTransitionInTimeoutRef.current);
    }

    setHighlightTransition(direction === 'next' ? 'out-next' : 'out-prev');

    highlightTransitionOutTimeoutRef.current = window.setTimeout(() => {
      activeHighlightTabRef.current = nextTab;
      setActiveHighlightTab(nextTab);
      setHighlightTransition(direction === 'next' ? 'in-next' : 'in-prev');

      highlightTransitionInTimeoutRef.current = window.setTimeout(() => {
        setHighlightTransition('idle');
      }, highlightSwapInDuration);
    }, highlightSwapOutDuration);

    return true;
  };

  const changeHighlightToTab = (nextTab: HighlightTabId) => {
    if (nextTab === activeHighlightTabRef.current) return false;

    const currentIndex = highlightTabOrder.indexOf(activeHighlightTabRef.current);
    const nextIndex = highlightTabOrder.indexOf(nextTab);
    const direction = nextIndex > currentIndex ? 'next' : 'prev';

    return startHighlightSwap(nextTab, direction);
  };

  const changeHighlightByStep = (step: 1 | -1) => {
    const currentIndex = highlightTabOrder.indexOf(activeHighlightTabRef.current);
    if (currentIndex === -1) return false;

    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= highlightTabOrder.length) return false;

    const nextTab = highlightTabOrder[nextIndex];
    const direction = step > 0 ? 'next' : 'prev';

    return startHighlightSwap(nextTab, direction);
  };

  const canMoveHighlightByStep = (step: 1 | -1) => {
    const currentIndex = highlightTabOrder.indexOf(activeHighlightTabRef.current);
    if (currentIndex === -1) return false;

    const nextIndex = currentIndex + step;
    return nextIndex >= 0 && nextIndex < highlightTabOrder.length;
  };

  const getHighlightLockMetrics = () => {
    const target = highlightShellRef.current ?? highlightSectionRef.current;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (!target) {
      return {
        isLocked: false,
        source: 'none',
        top: 0,
        bottom: 0,
        height: 0,
        visibleHeight: 0,
        visibleRatio: 0,
        viewportHeight,
        fitsViewport: false
      };
    }

    const rect = target.getBoundingClientRect();
    const epsilon = 4;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const height = Math.max(rect.height, 1);
    const visibleRatio = visibleHeight / height;
    const fitsViewport = height <= viewportHeight - 8;
    const lockByFit = rect.top >= -epsilon && rect.bottom <= viewportHeight + epsilon;
    const lockTopBand = 96;
    const lockBottomBand = Math.max(lockTopBand + 40, viewportHeight - 96);
    const lockByPinned = rect.top <= lockTopBand && rect.bottom >= lockBottomBand;
    const lockByDominant = visibleRatio >= 0.74 && lockByPinned;
    const isLocked = fitsViewport ? lockByFit : lockByDominant;

    return {
      isLocked,
      source: target === highlightShellRef.current ? 'shell' : 'section',
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      visibleHeight,
      visibleRatio,
      viewportHeight,
      fitsViewport
    };
  };

  const isHighlightLockZone = () => getHighlightLockMetrics().isLocked;

  useEffect(() => {
    const updateHighlightDebug = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const scrollingDown = currentScrollY >= lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;

      const metrics = getHighlightLockMetrics();

      const justEnteredLock = metrics.isLocked && !wasHighlightLockedRef.current;
      wasHighlightLockedRef.current = metrics.isLocked;

      if (!justEnteredLock || highlightSwitchLockedRef.current) return;

      // Entrada no highlight: alinha a aba ao sentido da rolagem para travar de forma consistente.
      const entryTab: HighlightTabId = scrollingDown ? 'dashboard' : 'meta';
      if (activeHighlightTabRef.current === entryTab) return;

      activeHighlightTabRef.current = entryTab;
      setHighlightTransition('idle');
      setActiveHighlightTab(entryTab);
    };

    lastScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    updateHighlightDebug();
    window.addEventListener('scroll', updateHighlightDebug, { passive: true });
    window.addEventListener('resize', updateHighlightDebug);

    return () => {
      window.removeEventListener('scroll', updateHighlightDebug);
      window.removeEventListener('resize', updateHighlightDebug);
    };
  }, []);

  useEffect(() => {
    const handleGlobalWheel = (event: globalThis.WheelEvent) => {
      if (!isHighlightLockZone()) return;
      if (event.deltaY === 0) return;
      if (Math.abs(event.deltaY) < 2) return;

      const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
      const canMove = canMoveHighlightByStep(direction);

      // Sem card nessa direção: libera rolagem normal da página.
      if (!canMove) {
        return;
      }

      // Enquanto a troca está em cooldown, mantém a página estável.
      if (highlightSwitchLockedRef.current) {
        if (event.cancelable) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
        event.stopPropagation();
      }

      const changed = changeHighlightByStep(direction);
      if (!changed) return;
      lockHighlightSwitch();
    };

    const handleGlobalTouchStart = (event: globalThis.TouchEvent) => {
      if (!isHighlightLockZone()) return;
      const touch = event.touches[0];
      if (!touch) return;
      highlightTouchStartYRef.current = touch.clientY;
      highlightTouchStartXRef.current = touch.clientX;
    };

    const handleGlobalTouchMove = (event: globalThis.TouchEvent) => {
      if (!isHighlightLockZone()) return;
      if (highlightTouchStartYRef.current === null) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaY = highlightTouchStartYRef.current - touch.clientY;
      if (Math.abs(deltaY) < 2) return;
      const deltaX = highlightTouchStartXRef.current === null ? 0 : Math.abs(highlightTouchStartXRef.current - touch.clientX);
      const step: 1 | -1 = deltaY > 0 ? 1 : -1;
      const canMove = canMoveHighlightByStep(step);
      if (highlightSwitchLockedRef.current) return;
      if (Math.abs(deltaY) < 34 || deltaX > Math.abs(deltaY)) return;
      if (!canMove) return;

      if (event.cancelable) {
        event.preventDefault();
        event.stopPropagation();
      }

      const changed = changeHighlightByStep(step);
      if (!changed) return;

      highlightTouchStartYRef.current = touch.clientY;
      highlightTouchStartXRef.current = touch.clientX;
      lockHighlightSwitch();
    };

    const handleGlobalTouchEnd = () => {
      highlightTouchStartYRef.current = null;
      highlightTouchStartXRef.current = null;
    };

    document.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      document.removeEventListener('touchstart', handleGlobalTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleGlobalTouchMove, { capture: true });
      document.removeEventListener('touchend', handleGlobalTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', handleGlobalTouchEnd, { capture: true });
    };
  }, [activeHighlightTab]);

  const highlightShellClassName = [
    'highlight-model-shell',
    `is-${activeHighlightView.id.toLowerCase()}`,
    highlightTransition === 'out-next' ? 'is-transition-out-next' : '',
    highlightTransition === 'in-next' ? 'is-transition-in-next' : '',
    highlightTransition === 'out-prev' ? 'is-transition-out-prev' : '',
    highlightTransition === 'in-prev' ? 'is-transition-in-prev' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="sales-page">
      <style>{`
        .sales-page {
          --bg: #040b09;
          --bg-2: #020605;
          --panel: rgba(6, 20, 23, 0.88);
          --panel-strong: rgba(4, 15, 18, 0.96);
          --line: rgba(35, 198, 111, 0.12);
          --text: #eef7f7;
          --muted: #aac6c6;
          --brand: #23c66f;
          --brand-2: #15a34a;
          --accent: #f6b84e;
          --section-pad: 20px;
          color: var(--text);
          min-height: 100vh;
          background:
            radial-gradient(1280px 620px at 50% -10%, rgba(35, 198, 111, 0.12) 0%, rgba(35, 198, 111, 0) 72%),
            radial-gradient(900px 500px at 86% 16%, rgba(35, 198, 111, 0.1) 0%, rgba(35, 198, 111, 0) 64%),
            radial-gradient(760px 420px at 12% 88%, rgba(35, 198, 111, 0.06) 0%, rgba(35, 198, 111, 0) 68%),
            linear-gradient(180deg, #050d0a 0%, var(--bg) 48%, var(--bg-2) 100%);
          position: relative;
          overflow-x: hidden;
        }

        .sales-page * {
          box-sizing: border-box;
        }

        .sales-page::before,
        .sales-page::after {
          content: '';
          position: fixed;
          inset: auto;
          pointer-events: none;
          z-index: -1;
          opacity: 0.32;
        }

        .sales-page::before {
          width: 560px;
          height: 560px;
          top: -160px;
          right: -140px;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.1);
          transform: rotate(14deg);
          background: radial-gradient(circle at 35% 35%, rgba(35, 198, 111, 0.22), rgba(35, 198, 111, 0));
          filter: blur(12px);
        }

        .sales-page::after {
          width: 500px;
          height: 500px;
          bottom: 10px;
          left: -130px;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.06);
          background: radial-gradient(circle at 50% 50%, rgba(35, 198, 111, 0.16), rgba(35, 198, 111, 0));
          transform: rotate(-14deg);
          filter: blur(14px);
        }

        .sales-shell {
          position: relative;
          z-index: 1;
          width: min(1360px, calc(100% - 28px));
          margin: 0 auto;
          padding: 14px 14px 26px;
          border-radius: 28px;
          border: 1px solid rgba(35, 198, 111, 0.1);
          background:
            radial-gradient(620px 280px at 50% 0%, rgba(35, 198, 111, 0.13), rgba(35, 198, 111, 0) 70%),
            linear-gradient(180deg, rgba(4, 13, 15, 0.97), rgba(3, 10, 12, 0.99));
          box-shadow:
            0 28px 70px rgba(2, 8, 8, 0.34),
            0 6px 20px rgba(2, 8, 8, 0.16);
          overflow: hidden;
          animation: page-enter 420ms ease-out;
        }

        .sales-shell::before {
          content: '';
          position: absolute;
          inset: -120px -40px auto;
          height: 320px;
          border-radius: 999px;
          background: radial-gradient(circle at 50% 50%, rgba(35, 198, 111, 0.22), rgba(35, 198, 111, 0) 70%);
          z-index: 0;
          pointer-events: none;
          filter: blur(8px);
        }

        .sales-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
            radial-gradient(500px 260px at 86% 26%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0));
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.5));
        }

        .sales-nav-sticky {
          position: static;
          top: auto;
          z-index: 2;
          margin-bottom: 22px;
        }

        .sales-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(35, 198, 111, 0.1);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.006)),
            rgba(4, 13, 15, 0.8);
          backdrop-filter: blur(14px);
          margin-bottom: 0;
          position: relative;
          z-index: 1;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
        }

        .sales-nav::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          pointer-events: none;
          border: 1px solid rgba(35, 198, 111, 0.06);
          opacity: 1;
        }

        .sales-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .sales-brand img {
          width: 128px;
          height: auto;
          display: block;
          filter: drop-shadow(0 8px 20px rgba(35, 198, 111, 0.12));
        }

        .sales-nav-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .sales-nav-links {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
          padding: 4px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
        }

        .sales-nav-link {
          border: 1px solid transparent;
          background: transparent;
          color: #d3e9e9;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
        }

        .sales-nav-link:hover {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(35, 198, 111, 0.12);
          color: #eff9f9;
        }

        .sales-brand:focus-visible,
        .sales-nav-link:focus-visible,
        .sales-btn:focus-visible,
        .sales-footer-links a:focus-visible,
        .sales-footer-links button:focus-visible {
          outline: 2px solid rgba(53, 224, 132, 0.6);
          outline-offset: 2px;
          border-radius: 8px;
        }

        .sales-nav-link:focus-visible {
          background: rgba(35, 198, 111, 0.08);
          border-color: rgba(35, 198, 111, 0.18);
          color: #eff9f9;
        }

        .sales-btn {
          appearance: none;
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 10px 15px;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
          white-space: nowrap;
        }

        .sales-btn:hover {
          transform: translateY(-1px);
        }

        .sales-btn-outline {
          color: var(--text);
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .sales-btn-outline:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(35, 198, 111, 0.22);
        }

        .sales-btn-primary {
          color: #04140b;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)) padding-box,
            linear-gradient(135deg, #68f6ab, #35e084 42%, var(--brand) 100%);
          box-shadow:
            0 10px 24px rgba(21, 163, 74, 0.22),
            0 0 0 1px rgba(35, 198, 111, 0.18);
        }

        .sales-btn-primary:hover {
          box-shadow:
            0 14px 28px rgba(21, 163, 74, 0.28),
            0 0 0 1px rgba(35, 198, 111, 0.2);
        }

        .sales-btn-primary:focus-visible {
          box-shadow:
            0 12px 26px rgba(21, 163, 74, 0.22),
            0 0 0 1px rgba(35, 198, 111, 0.2),
            0 0 0 4px rgba(53, 224, 132, 0.16);
        }

        .sales-page main {
          display: grid;
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        .sales-page main > section {
          position: relative;
          z-index: 1;
          width: 100%;
          margin-inline: 0;
        }

        .sales-hero,
        .solution-section,
        .resources-section,
        .journey-section,
        .plans-section,
        #faq-comercial {
          scroll-margin-top: 108px;
        }

        .sales-hero {
          display: block;
          margin-bottom: 0;
        }

        .hero-copy,
        .hero-copy,
        .hero-card {
          border-radius: 22px;
          border: 1px solid var(--line);
          background: linear-gradient(165deg, rgba(10, 29, 33, 0.96), rgba(8, 23, 27, 0.94));
        }

        .hero-copy {
          padding: clamp(22px, 3.4vw, 36px);
          position: relative;
          overflow: hidden;
          text-align: center;
          border-radius: 24px;
          background:
            radial-gradient(680px 280px at 50% 0%, rgba(35, 198, 111, 0.14), rgba(35, 198, 111, 0) 72%),
            radial-gradient(420px 220px at 6% 26%, rgba(94, 217, 255, 0.07), rgba(94, 217, 255, 0) 75%),
            linear-gradient(180deg, rgba(7, 21, 24, 0.96), rgba(5, 16, 19, 0.98));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 24px 40px rgba(0, 0, 0, 0.18);
        }

        .hero-copy > * {
          position: relative;
          z-index: 1;
        }

        .hero-copy::before {
          content: '';
          position: absolute;
          inset: auto -80px -110px auto;
          width: 340px;
          height: 340px;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 35%, rgba(35, 198, 111, 0.16), rgba(35, 198, 111, 0));
          z-index: 0;
        }

        .hero-copy::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 100% 34px, 34px 100%;
          opacity: 0.22;
          mask-image: radial-gradient(circle at 50% 22%, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.22) 72%);
        }

        .hero-title {
          margin: 0 auto;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          font-size: clamp(32px, 4.6vw, 62px);
          line-height: 0.98;
          letter-spacing: -0.04em;
          max-width: 15ch;
          text-wrap: balance;
        }

        .hero-title strong {
          color: transparent;
          background: linear-gradient(180deg, #ebfff4 0%, #8ef7be 58%, #4ce48f 100%);
          -webkit-background-clip: text;
          background-clip: text;
          text-shadow: 0 0 24px rgba(35, 198, 111, 0.08);
        }

        .hero-brand-name {
          display: inline-block;
          margin-left: 0.16em;
          color: #e9fff3;
          font-weight: 900;
          letter-spacing: -0.02em;
          text-shadow: 0 0 22px rgba(35, 198, 111, 0.18);
        }

        .hero-benefit-list {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 9px;
          margin: 18px auto 0;
          padding: 0;
          list-style: none;
          max-width: 860px;
        }

        .hero-benefit-list li {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.012));
          padding: 9px 13px;
          font-size: 12px;
          color: #d7ecec;
          line-height: 1.2;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .hero-cta-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          margin-top: 16px;
        }

        .hero-proof-row {
          margin: 16px auto 0;
          max-width: 980px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.01);
          padding: 8px 10px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: center;
        }

        .hero-proof-label {
          color: #aac3c3;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .hero-proof-chips {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 5px;
        }

        .hero-proof-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.012);
          padding: 5px 9px;
          color: #cfe2e2;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
        }

        .hero-proof-chip::before {
          content: '';
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(107, 246, 171, 0.95);
        }

        .hero-note {
          margin-top: 12px;
          color: #99b6b6;
          font-size: 12px;
        }

        .hero-visual {
          margin: clamp(34px, 4.6vw, 46px) auto 0;
          max-width: 920px;
          border-radius: 22px;
          border: 1px solid rgba(72, 128, 112, 0.3);
          background: linear-gradient(170deg, rgba(7, 22, 25, 0.96), rgba(5, 16, 19, 0.98));
          padding: 14px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
        }

        .hero-visual::before {
          content: none;
        }

        .hero-visual::after {
          content: none;
        }

        .hero-screen {
          position: relative;
          z-index: 1;
          border-radius: 0;
          border: none;
          background: transparent;
          padding: 0;
          box-shadow: none;
        }

        .hero-screen-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
          flex-wrap: wrap;
          padding: 0 4px;
        }

        .hero-screen-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #eaf8f8;
          font-size: 13px;
          font-weight: 700;
        }

        .hero-screen-brand img {
          width: 26px;
          height: 26px;
          display: block;
          filter: drop-shadow(0 6px 12px rgba(35, 198, 111, 0.16));
        }

        .hero-screen-tabs {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
        }

        .hero-screen-tabs span {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.015);
          color: #c9dddd;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 9px;
        }

        .hero-illustration-wrap {
          display: grid;
          gap: 0;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
        }

        .hero-illustration {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 12px;
          border: none;
          background: transparent;
          box-shadow: none;
        }

        .hero-real-mock {
          display: grid;
          grid-template-columns: 186px 1fr;
          gap: 9px;
          width: 100%;
          min-width: 0;
          padding: 9px;
          min-height: 404px;
          border-radius: 14px;
          border: 1px solid rgba(70, 125, 110, 0.3);
          background:
            radial-gradient(420px 180px at 84% 0%, rgba(35, 198, 111, 0.11), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(5, 18, 22, 0.98), rgba(4, 13, 17, 1));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.015);
        }

        .hero-real-sidebar {
          border-radius: 13px;
          border: 1px solid rgba(66, 118, 104, 0.24);
          background: rgba(8, 27, 30, 0.88);
          padding: 9px;
          display: grid;
          align-content: space-between;
          gap: 8px;
          min-width: 0;
        }

        .hero-real-sidebar-main {
          display: grid;
          gap: 8px;
          align-items: stretch;
        }

        .hero-real-sidebar-brand {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          padding: 1px 2px 6px;
        }

        .hero-real-sidebar-brand img {
          width: 92px;
          height: auto;
          display: block;
          filter: drop-shadow(0 8px 18px rgba(35, 198, 111, 0.2));
        }

        .hero-real-sidebar-groups {
          display: grid;
          gap: 8px;
        }

        .hero-real-sidebar-group {
          display: grid;
          gap: 4px;
        }

        .hero-real-sidebar-label {
          color: #8ab3a5;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding-left: 3px;
          text-align: left;
        }

        .hero-real-nav-item {
          border-radius: 10px;
          border: 1px solid rgba(77, 128, 112, 0.2);
          background: rgba(12, 34, 37, 0.58);
          min-height: 28px;
          padding: 5px 7px;
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-start;
          text-align: left;
          color: #bfdacb;
          font-size: 10px;
          font-weight: 600;
        }

        .hero-real-nav-item.is-active {
          border-color: rgba(58, 214, 130, 0.36);
          background: linear-gradient(90deg, rgba(30, 117, 83, 0.46), rgba(22, 60, 72, 0.32));
          color: #edfff6;
          box-shadow: none;
        }

        .hero-real-nav-icon-box {
          width: 15px;
          height: 15px;
          border-radius: 4px;
          border: 1px solid rgba(122, 171, 156, 0.3);
          background: rgba(20, 45, 47, 0.74);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .hero-real-nav-icon {
          width: 10px;
          height: 10px;
          color: currentColor;
          opacity: 0.92;
          display: inline-block;
          flex: 0 0 auto;
        }

        .hero-real-nav-item.is-active .hero-real-nav-icon-box {
          border-color: rgba(107, 248, 175, 0.58);
          background: rgba(30, 95, 72, 0.42);
          box-shadow: 0 0 0 2px rgba(53, 224, 132, 0.14);
        }

        .hero-real-nav-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hero-real-sidebar-footer {
          border-top: 1px solid rgba(74, 121, 109, 0.24);
          padding-top: 7px;
        }

        .hero-real-exit {
          border-radius: 10px;
          border: 1px solid rgba(198, 126, 140, 0.34);
          background: linear-gradient(180deg, rgba(87, 40, 56, 0.64), rgba(68, 33, 44, 0.74));
          min-height: 31px;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f2d4dc;
          font-size: 10px;
          font-weight: 700;
        }

        .hero-real-main {
          border-radius: 13px;
          border: 1px solid rgba(62, 112, 98, 0.24);
          background: rgba(8, 26, 30, 0.88);
          padding: 9px;
          display: grid;
          align-content: start;
          gap: 8px;
          min-width: 0;
        }

        .hero-real-header h3 {
          margin: 0;
          color: #e8f7f0;
          font-size: 15px;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        .hero-real-header p {
          margin: 4px 0 0;
          color: #95b6ab;
          font-size: 9px;
          line-height: 1.35;
        }

        .hero-real-top-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.9fr);
          gap: 8px;
          min-width: 0;
        }

        .hero-real-card {
          border-radius: 11px;
          border: 1px solid rgba(67, 123, 107, 0.22);
          background: rgba(11, 31, 35, 0.52);
          padding: 8px;
          min-width: 0;
        }

        .hero-real-card-title {
          margin: 0;
          color: #e4f4ee;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }

        .hero-real-period-form {
          margin-top: 8px;
          display: grid;
          gap: 6px;
        }

        .hero-real-field {
          border-radius: 8px;
          border: 1px solid rgba(70, 124, 108, 0.3);
          background: rgba(19, 42, 46, 0.7);
          min-height: 24px;
          padding: 5px 8px;
          color: #d2e9df;
          font-size: 9px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .hero-real-field::after {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 2px;
          border: 1px solid rgba(149, 210, 187, 0.4);
          background: rgba(12, 33, 37, 0.7);
          flex: 0 0 auto;
        }

        .hero-real-chart-meta {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hero-real-chip {
          border-radius: 8px;
          border: 1px solid rgba(71, 126, 110, 0.3);
          background: rgba(17, 39, 43, 0.72);
          color: #d1e9dd;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
          padding: 6px 8px;
          white-space: nowrap;
        }

        .hero-real-chip.is-current {
          border-color: rgba(64, 234, 148, 0.5);
          background: rgba(40, 154, 108, 0.34);
          color: #dfffee;
        }

        .hero-real-toggle-group {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .hero-real-toggle {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          border: 1px solid rgba(69, 122, 107, 0.3);
          background: rgba(17, 39, 43, 0.72);
          color: #8eb5a6;
          font-size: 9px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .hero-real-toggle.is-active {
          border-color: rgba(64, 234, 148, 0.5);
          background: rgba(37, 134, 102, 0.34);
          color: #e1fff0;
        }

        .hero-real-chart {
          margin-top: 8px;
          border-radius: 10px;
          border: 1px solid rgba(69, 121, 107, 0.2);
          background:
            linear-gradient(rgba(109, 160, 143, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(109, 160, 143, 0.05) 1px, transparent 1px),
            rgba(11, 31, 35, 0.46);
          background-size: 100% 24px, 34px 100%, auto;
          padding: 7px 7px 5px;
          display: grid;
          gap: 5px;
        }

        .hero-real-chart-svg {
          width: 100%;
          height: 76px;
          display: block;
        }

        .hero-real-chart-axis {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          color: #7ea99c;
          font-size: 8px;
          font-weight: 600;
        }

        .hero-real-general-list {
          margin: 8px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .hero-real-general-list li {
          border-bottom: 1px solid rgba(70, 124, 109, 0.28);
          padding-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          color: #a4c7ba;
          font-size: 9px;
        }

        .hero-real-general-list li:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .hero-real-general-list strong {
          color: #e8f6ef;
          font-size: 15px;
          line-height: 1;
        }

        .hero-real-events {
          margin-top: 1px;
          display: grid;
          gap: 8px;
        }

        .hero-real-events-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hero-real-events-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hero-real-event-empty {
          min-height: 62px;
          border-radius: 9px;
          border: 1px dashed rgba(70, 124, 109, 0.28);
          background: rgba(12, 35, 39, 0.44);
          padding: 8px;
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 5px;
          text-align: center;
        }

        .hero-real-event-empty strong {
          color: #d8efe6;
          font-size: 10px;
          line-height: 1.2;
        }

        .hero-real-event-empty span {
          color: #93b7aa;
          font-size: 9px;
          line-height: 1.3;
          max-width: 90%;
        }

        .hero-real-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }

        .hero-real-metric-card {
          border-radius: 10px;
          border: 1px solid rgba(67, 121, 107, 0.22);
          background: rgba(11, 31, 35, 0.52);
          padding: 7px;
          display: grid;
          gap: 6px;
        }

        .hero-real-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .hero-real-metric-icon {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          border: 1px solid rgba(92, 150, 130, 0.32);
          background: rgba(18, 49, 42, 0.76);
        }

        .hero-real-metric-icon.is-green {
          border-color: rgba(63, 227, 145, 0.44);
          background: rgba(30, 120, 87, 0.45);
        }

        .hero-real-metric-icon.is-amber {
          border-color: rgba(250, 187, 83, 0.42);
          background: rgba(141, 93, 27, 0.42);
        }

        .hero-real-metric-icon.is-cyan {
          border-color: rgba(88, 210, 193, 0.46);
          background: rgba(24, 108, 97, 0.44);
        }

        .hero-real-metric-card strong {
          color: #e8f6ef;
          font-size: 16px;
          line-height: 1;
        }

        .hero-real-metric-delta {
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 3px 6px;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
        }

        .hero-real-metric-delta.is-positive {
          border-color: rgba(64, 234, 148, 0.4);
          background: rgba(40, 152, 108, 0.25);
          color: #caf9df;
        }

        .hero-real-metric-delta.is-negative {
          border-color: rgba(232, 95, 116, 0.42);
          background: rgba(153, 50, 68, 0.25);
          color: #ffd4dc;
        }

        .hero-real-metric-card span {
          color: #95b8ab;
          font-size: 9px;
          line-height: 1.3;
        }

        .hero-real-funnel {
          margin-top: 1px;
        }

        .hero-real-funnel-grid {
          margin-top: 8px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .hero-real-funnel-stage {
          border-radius: 9px;
          border: 1px solid rgba(67, 121, 107, 0.22);
          background: rgba(14, 35, 39, 0.5);
          min-height: 58px;
          padding: 7px;
          display: grid;
          align-content: center;
          gap: 4px;
          position: relative;
          text-align: center;
        }
        .hero-real-funnel-stage:not(:first-child)::before {
          content: '->';
          position: absolute;
          left: -11px;
          top: 50%;
          transform: translateY(-50%);
          color: #7fa99c;
          font-size: 11px;
          line-height: 1;
        }

        .hero-real-funnel-stage strong {
          color: #47de93;
          font-size: 19px;
          line-height: 1;
        }

        .hero-real-funnel-stage span {
          color: #9ec4b7;
          font-size: 9px;
          line-height: 1.2;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .hero-real-funnel-stage i {
          font-style: normal;
          color: #92b4a7;
          font-size: 9px;
          line-height: 1;
        }

        .hero-illustration-caption {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          padding: 10px;
          text-align: left;
        }

        .hero-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .hero-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          color: #d6e9e9;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 8px;
          white-space: nowrap;
        }

        .hero-legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          display: inline-block;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04);
        }

        .hero-legend-dot.is-green {
          background: #35e084;
          box-shadow: 0 0 0 4px rgba(53, 224, 132, 0.12);
        }

        .hero-legend-dot.is-amber {
          background: #f6b84e;
          box-shadow: 0 0 0 4px rgba(246, 184, 78, 0.12);
        }

        .hero-legend-dot.is-cyan {
          background: #5ed9ff;
          box-shadow: 0 0 0 4px rgba(94, 217, 255, 0.12);
        }

        .hero-illustration-copy {
          margin: 0;
          color: #abc5c5;
          font-size: 12px;
          line-height: 1.5;
        }

        .hero-ui-layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 10px;
        }

        .hero-ui-card {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.02);
          padding: 10px;
          text-align: left;
        }

        .hero-ui-card h4 {
          margin: 0 0 8px;
          font-size: 12px;
          letter-spacing: 0.01em;
          color: #e8f5f5;
        }

        .hero-ui-stack {
          display: grid;
          gap: 8px;
        }

        .hero-ui-chip {
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.015);
          padding: 8px 9px;
          color: #d1e4e4;
          font-size: 11px;
          line-height: 1.35;
        }

        .hero-ui-chip strong {
          color: #effcfc;
          display: block;
          margin-bottom: 2px;
          font-size: 11px;
        }

        .hero-chat-list {
          display: grid;
          gap: 8px;
        }

        .hero-chat-item {
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
          padding: 8px 9px;
          display: grid;
          gap: 5px;
        }

        .hero-chat-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: #d8eeee;
        }

        .hero-chat-head strong {
          color: #f0fbfb;
          font-weight: 700;
        }

        .hero-chat-item p {
          margin: 0;
          color: #a9c2c2;
          font-size: 11px;
          line-height: 1.45;
        }

        .hero-floating-tag {
          position: absolute;
          z-index: 2;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.22);
          background: rgba(8, 28, 20, 0.78);
          color: #ccfae0;
          font-size: 11px;
          font-weight: 700;
          padding: 7px 10px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(6px);
        }

        .hero-floating-tag.is-top {
          top: 10px;
          right: 14px;
        }

        .hero-floating-tag.is-bottom {
          bottom: 12px;
          left: 14px;
        }
        .hero-card {
          padding: 22px;
          display: grid;
          align-content: start;
          gap: 14px;
          background:
            linear-gradient(180deg, rgba(35, 198, 111, 0.08) 0%, rgba(35, 198, 111, 0) 42%),
            linear-gradient(165deg, rgba(9, 28, 32, 0.97), rgba(7, 21, 24, 0.97));
        }

        .price-kicker {
          color: #b6cccc;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-size: 11px;
        }

        .price-name {
          margin: 0;
          font-size: 24px;
          line-height: 1.1;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .price-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-top: 2px;
          flex-wrap: wrap;
        }

        .price-value {
          font-size: clamp(34px, 4vw, 46px);
          line-height: 0.95;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #ecfff4;
        }

        .price-cycle {
          color: #bcd4d4;
          font-size: 14px;
          padding-bottom: 6px;
        }

        .price-highlight {
          border-radius: 14px;
          border: 1px solid rgba(246, 184, 78, 0.22);
          background: rgba(246, 184, 78, 0.08);
          color: #ffe5b3;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.4;
        }

        .price-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
        }

        .price-list li {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          padding: 10px 12px 10px 34px;
          position: relative;
          color: #ddeeed;
          font-size: 13px;
          line-height: 1.45;
        }

        .price-list li::before {
          content: '+';
          position: absolute;
          left: 11px;
          top: 9px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: rgba(35, 198, 111, 0.14);
          color: #42e28e;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(35, 198, 111, 0.25);
        }

        .price-actions {
          display: grid;
          gap: 10px;
          margin-top: 2px;
        }

        .price-actions .sales-btn {
          text-align: center;
          justify-content: center;
          display: inline-flex;
          align-items: center;
          min-height: 44px;
        }

        .price-footnote {
          color: #93adad;
          font-size: 12px;
          line-height: 1.45;
        }

        .solution-section,
        .resources-section,
        .journey-section,
        .plans-section {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(35, 198, 111, 0.08);
          background:
            radial-gradient(560px 220px at 80% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0) 72%),
            linear-gradient(180deg, rgba(7, 21, 24, 0.9), rgba(5, 16, 18, 0.96));
          padding: var(--section-pad);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .solution-section::before,
        .resources-section::before,
        .journey-section::before,
        .plans-section::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0));
          opacity: 0.75;
        }

        .solution-section,
        .resources-section,
        .journey-section {
          margin-bottom: 16px;
        }

        .section-variant-left,
        .section-variant-right,
        .section-variant-frame,
        .section-variant-plain {
          width: 100%;
          max-width: 100%;
          margin-inline: 0;
        }

        .section-variant-left {
          background:
            radial-gradient(560px 220px at 8% 0%, rgba(35, 198, 111, 0.1), rgba(35, 198, 111, 0) 72%),
            linear-gradient(180deg, rgba(7, 21, 24, 0.9), rgba(5, 16, 18, 0.96));
        }

        .section-variant-right {
          background:
            radial-gradient(560px 220px at 92% 0%, rgba(94, 217, 255, 0.1), rgba(94, 217, 255, 0) 72%),
            radial-gradient(460px 200px at 20% 100%, rgba(246, 184, 78, 0.09), rgba(246, 184, 78, 0) 70%),
            linear-gradient(180deg, rgba(7, 21, 24, 0.9), rgba(5, 16, 18, 0.96));
        }

        .section-variant-frame {
          border-color: rgba(35, 198, 111, 0.14);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.02),
            0 18px 30px rgba(0, 0, 0, 0.14);
          background:
            radial-gradient(620px 260px at 84% 2%, rgba(35, 198, 111, 0.12), rgba(35, 198, 111, 0) 72%),
            linear-gradient(180deg, rgba(7, 21, 24, 0.92), rgba(5, 16, 18, 0.97));
        }

        .section-variant-plain {
          border: none;
          background: transparent;
          box-shadow: none;
          padding: var(--section-pad);
        }

        .section-variant-plain::before {
          display: none;
        }

        .section-variant-plain .section-head {
          margin-bottom: 16px;
        }

        .resources-section.section-variant-plain {
          position: relative;
        }

        .resources-section.section-variant-plain::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 22px;
          border: 1px solid rgba(35, 198, 111, 0.09);
          background:
            radial-gradient(560px 180px at 50% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0) 72%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.012), rgba(255, 255, 255, 0.004));
          pointer-events: none;
          z-index: 0;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.02),
            0 0 0 1px rgba(35, 198, 111, 0.03);
        }

        .resources-section.section-variant-plain > * {
          position: relative;
          z-index: 1;
        }

        .resources-section.section-variant-plain .resource-grid {
          margin-top: 14px;
          grid-template-columns: 1.2fr 1fr 1fr;
        }

        .resources-section.section-variant-plain .resource-card {
          background:
            radial-gradient(240px 120px at 80% 0%, rgba(35, 198, 111, 0.09), rgba(35, 198, 111, 0)),
            linear-gradient(165deg, rgba(11, 28, 31, 0.94), rgba(7, 18, 21, 0.98));
        }

        .resources-section.section-variant-plain .resource-card:nth-child(1),
        .resources-section.section-variant-plain .resource-card:nth-child(4) {
          grid-column: span 2;
          min-height: 164px;
        }

        .section-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 7px 10px;
          border: 1px solid rgba(35, 198, 111, 0.2);
          background: rgba(35, 198, 111, 0.06);
          color: #c4f8da;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .section-tag::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #35e084;
          box-shadow: 0 0 0 4px rgba(53, 224, 132, 0.15);
        }

        .section-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 14px;
        }

        .section-panel {
          border-radius: 16px;
          border: 1px solid rgba(35, 198, 111, 0.06);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.012));
          padding: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .section-panel p {
          margin: 0;
          color: #aac1c1;
          font-size: 13px;
          line-height: 1.6;
        }

        .pillar-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .pillar-card {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.008));
          padding: 12px;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .pillar-stat {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 700;
          color: #d5fbe4;
          border: 1px solid rgba(35, 198, 111, 0.18);
          background: rgba(35, 198, 111, 0.06);
        }

        .pillar-title {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
        }

        .pillar-text {
          margin: 0;
          color: #a9c0c0;
          font-size: 12px;
          line-height: 1.55;
        }

        .problem-list,
        .resource-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }

        .problem-list li,
        .resource-list li {
          border-radius: 12px;
          border: 1px solid rgba(35, 198, 111, 0.05);
          background: rgba(255, 255, 255, 0.02);
          padding: 10px 12px;
          color: #d8ecec;
          font-size: 12px;
          line-height: 1.5;
        }

        .resource-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .resource-card {
          border-radius: 14px;
          border: 1px solid rgba(35, 198, 111, 0.06);
          background:
            radial-gradient(240px 120px at 80% 0%, rgba(35, 198, 111, 0.07), rgba(35, 198, 111, 0)),
            linear-gradient(165deg, rgba(11, 28, 31, 0.92), rgba(7, 18, 21, 0.96));
          padding: 12px;
          display: grid;
          gap: 8px;
          min-height: 150px;
          align-content: start;
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }

        .resource-card:hover {
          transform: translateY(-2px);
          border-color: rgba(35, 198, 111, 0.18);
          box-shadow: 0 16px 24px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(35, 198, 111, 0.05);
        }

        .resource-kicker {
          color: #9ec2b4;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .resource-title {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
        }

        .resource-desc {
          margin: 0;
          color: #a7c0c0;
          font-size: 12px;
          line-height: 1.55;
        }

        .journey-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .journey-card {
          border-radius: 14px;
          border: 1px solid rgba(35, 198, 111, 0.06);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
          padding: 12px;
          display: grid;
          gap: 8px;
          transition: transform 160ms ease, border-color 160ms ease;
        }

        .journey-card:hover {
          transform: translateY(-2px);
          border-color: rgba(35, 198, 111, 0.16);
        }

        .journey-step {
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.2);
          background: rgba(35, 198, 111, 0.06);
          color: #c9f8dc;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 5px 8px;
        }

        .journey-title {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
        }

        .journey-text {
          margin: 0;
          color: #a9c0c0;
          font-size: 12px;
          line-height: 1.55;
        }

        .plans-section {
          margin-top: clamp(0.9rem, 1.8vw, 1.4rem);
        }

        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .section-head > div {
          max-width: 760px;
        }

        .section-head.is-center {
          justify-content: center;
        }

        .section-head.is-center > div {
          margin-inline: auto;
          text-align: center;
        }

        .section-head.is-right {
          justify-content: flex-start;
        }

        .section-head.is-right > div {
          margin-left: 0;
          text-align: left;
        }

        .feature-highlight-section {
          scroll-margin-top: 92px;
          overscroll-behavior-y: contain;
          --hl-green: #35d989;
          --hl-cyan: #53d1ff;
          --hl-amber: #f3c164;
          --hl-coral: #ff9b78;
          --hl-ink: #113127;
        }

        .section-anchor {
          display: block;
          position: relative;
          top: -92px;
          visibility: hidden;
          pointer-events: none;
        }

        .highlight-model-shell {
          --hl-main-card-height: clamp(500px, 36vw, 620px);
          --hl-shell-border: rgba(151, 188, 172, 0.34);
          --hl-shell-a: rgba(83, 209, 255, 0.2);
          --hl-shell-b: rgba(243, 193, 100, 0.19);
          --hl-shell-c: rgba(53, 217, 137, 0.15);
          --hl-shell-start: rgba(237, 244, 242, 0.97);
          --hl-shell-end: rgba(223, 232, 228, 0.93);

          --hl-badge-border: rgba(70, 142, 130, 0.34);
          --hl-badge-bg: linear-gradient(90deg, rgba(159, 225, 183, 0.62), rgba(176, 230, 248, 0.58), rgba(246, 217, 157, 0.52));
          --hl-badge-text: #173d32;

          --hl-preview-border: rgba(58, 108, 96, 0.22);
          --hl-preview-a: rgba(92, 214, 255, 0.2);
          --hl-preview-b: rgba(246, 197, 101, 0.2);
          --hl-preview-c: rgba(62, 181, 126, 0.14);
          --hl-preview-start: rgba(251, 255, 254, 0.97);
          --hl-preview-end: rgba(236, 244, 241, 0.95);

          --hl-brand-border: rgba(34, 89, 76, 0.2);
          --hl-brand-bg: linear-gradient(135deg, rgba(196, 235, 213, 0.68), rgba(210, 241, 252, 0.64));
          --hl-dot-a: #24c877;
          --hl-dot-b: #4fc9ff;
          --hl-search-line: linear-gradient(90deg, rgba(38, 122, 99, 0.36), rgba(67, 177, 214, 0.28));

          --hl-stat-1-border: rgba(62, 166, 196, 0.26);
          --hl-stat-1-bg: linear-gradient(180deg, rgba(214, 244, 255, 0.78), rgba(255, 255, 255, 0.86));
          --hl-stat-2-border: rgba(184, 141, 62, 0.28);
          --hl-stat-2-bg: linear-gradient(180deg, rgba(255, 243, 215, 0.76), rgba(255, 255, 255, 0.86));

          --hl-row-left-border: rgba(67, 168, 203, 0.22);
          --hl-row-left-bg: rgba(236, 248, 255, 0.9);
          --hl-row-right-border: rgba(191, 149, 73, 0.22);
          --hl-row-right-bg: rgba(255, 247, 231, 0.9);

          display: grid;
          grid-template-columns: 252px minmax(280px, 420px) minmax(360px, 1fr);
          gap: 18px;
          align-items: stretch;
          border-radius: 22px;
          border: 1px solid var(--hl-shell-border);
          background:
            radial-gradient(560px 230px at 12% 0%, var(--hl-shell-a), rgba(83, 209, 255, 0)),
            radial-gradient(540px 220px at 84% 8%, var(--hl-shell-b), rgba(243, 193, 100, 0)),
            radial-gradient(620px 260px at 50% 100%, var(--hl-shell-c), rgba(53, 217, 137, 0)),
            linear-gradient(180deg, var(--hl-shell-start), var(--hl-shell-end));
          padding: 18px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.64),
            0 24px 44px rgba(0, 0, 0, 0.24);
          will-change: transform, opacity;
          transform-origin: 50% 50%;
          backface-visibility: hidden;
          touch-action: auto;
        }

        .highlight-model-shell.is-transition-out-next {
          animation: highlight-card-out-next 210ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .highlight-model-shell.is-transition-in-next {
          animation: highlight-card-in-next 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .highlight-model-shell.is-transition-out-prev {
          animation: highlight-card-out-prev 210ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        .highlight-model-shell.is-transition-in-prev {
          animation: highlight-card-in-prev 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes highlight-card-out-next {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }

          to {
            opacity: 0.965;
            transform: translate3d(0, -4px, 0) scale(0.998);
          }
        }

        @keyframes highlight-card-in-next {
          from {
            opacity: 0.935;
            transform: translate3d(0, 6px, 0) scale(0.996);
          }

          58% {
            opacity: 0.985;
            transform: translate3d(0, 0.5px, 0) scale(0.999);
          }

          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes highlight-card-out-prev {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }

          to {
            opacity: 0.965;
            transform: translate3d(0, 4px, 0) scale(0.998);
          }
        }

        @keyframes highlight-card-in-prev {
          from {
            opacity: 0.935;
            transform: translate3d(0, -6px, 0) scale(0.996);
          }

          58% {
            opacity: 0.985;
            transform: translate3d(0, -0.5px, 0) scale(0.999);
          }

          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .highlight-model-shell.is-transition-out-next,
          .highlight-model-shell.is-transition-in-next,
          .highlight-model-shell.is-transition-out-prev,
          .highlight-model-shell.is-transition-in-prev {
            animation: none;
          }
        }

        .highlight-model-shell.is-dashboard {
          --hl-shell-border: rgba(110, 148, 111, 0.36);
          --hl-shell-a: rgba(96, 135, 91, 0.34);
          --hl-shell-b: rgba(78, 124, 95, 0.2);
          --hl-shell-c: rgba(63, 107, 83, 0.2);
          --hl-shell-start: rgba(6, 25, 22, 0.98);
          --hl-shell-end: rgba(3, 16, 14, 0.98);

          --hl-badge-border: rgba(112, 162, 120, 0.42);
          --hl-badge-bg: linear-gradient(90deg, rgba(43, 84, 59, 0.78), rgba(65, 108, 71, 0.72), rgba(34, 66, 50, 0.78));
          --hl-badge-text: #f2fff7;

          --hl-preview-border: rgba(73, 124, 104, 0.32);
          --hl-preview-a: rgba(66, 131, 101, 0.2);
          --hl-preview-b: rgba(85, 121, 82, 0.16);
          --hl-preview-c: rgba(58, 103, 83, 0.14);
          --hl-preview-start: rgba(6, 24, 21, 0.98);
          --hl-preview-end: rgba(4, 18, 16, 0.96);
        }

        .highlight-model-shell.is-chatinterno {
          --hl-shell-border: rgba(131, 178, 145, 0.36);
          --hl-shell-a: rgba(126, 187, 149, 0.32);
          --hl-shell-b: rgba(81, 156, 117, 0.24);
          --hl-shell-c: rgba(60, 126, 95, 0.2);
          --hl-shell-start: rgba(10, 35, 29, 0.98);
          --hl-shell-end: rgba(6, 24, 20, 0.98);

          --hl-badge-border: rgba(132, 197, 151, 0.44);
          --hl-badge-bg: linear-gradient(90deg, rgba(52, 108, 78, 0.76), rgba(83, 146, 103, 0.7), rgba(44, 86, 65, 0.78));
          --hl-badge-text: #f2fff8;

          --hl-preview-border: rgba(92, 155, 125, 0.32);
          --hl-preview-a: rgba(96, 172, 130, 0.26);
          --hl-preview-b: rgba(128, 183, 131, 0.2);
          --hl-preview-c: rgba(66, 127, 100, 0.18);
          --hl-preview-start: rgba(10, 36, 30, 0.96);
          --hl-preview-end: rgba(7, 27, 22, 0.95);

          --hl-brand-border: rgba(112, 172, 140, 0.38);
          --hl-brand-bg: linear-gradient(135deg, rgba(41, 86, 62, 0.84), rgba(60, 112, 79, 0.8));
          --hl-dot-a: #6ce2a7;
          --hl-dot-b: #b5f4c4;
          --hl-search-line: linear-gradient(90deg, rgba(113, 201, 150, 0.58), rgba(134, 214, 156, 0.4));

          --hl-stat-1-border: rgba(112, 186, 147, 0.34);
          --hl-stat-1-bg: linear-gradient(180deg, rgba(20, 55, 44, 0.92), rgba(13, 40, 33, 0.9));
          --hl-stat-2-border: rgba(116, 180, 132, 0.34);
          --hl-stat-2-bg: linear-gradient(180deg, rgba(21, 57, 43, 0.92), rgba(13, 39, 31, 0.9));

          --hl-row-left-border: rgba(110, 180, 141, 0.32);
          --hl-row-left-bg: rgba(15, 48, 39, 0.9);
          --hl-row-right-border: rgba(126, 187, 141, 0.32);
          --hl-row-right-bg: rgba(16, 50, 40, 0.9);
        }

        .highlight-model-shell.is-chatinterno {
          --hl-shell-border: rgba(170, 208, 187, 0.2);
          --hl-shell-a: rgba(46, 212, 122, 0.15);
          --hl-shell-b: rgba(29, 109, 76, 0.18);
          --hl-shell-c: rgba(18, 60, 47, 0.25);
          --hl-shell-start: rgba(15, 46, 35, 0.98);
          --hl-shell-end: rgba(18, 60, 47, 0.97);
          gap: clamp(1.5rem, 2.1vw, 2rem);
          padding: clamp(1.5rem, 2.2vw, 2rem);
          border-radius: 24px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 14px 30px rgba(5, 17, 12, 0.18);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav {
          border-color: rgba(255, 255, 255, 0.36);
          background: linear-gradient(180deg, rgba(249, 252, 251, 0.9), rgba(239, 246, 242, 0.84));
          box-shadow: none;
          backdrop-filter: blur(6px);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy {
          border-radius: 24px;
          padding: clamp(1.6rem, 2.1vw, 2rem);
          gap: 1rem;
          background:
            radial-gradient(520px 240px at 24% 8%, rgba(46, 212, 122, 0.12), rgba(46, 212, 122, 0) 72%),
            linear-gradient(160deg, rgba(11, 38, 30, 0.68), rgba(10, 33, 27, 0.54));
        }

        .highlight-model-shell.is-chatinterno .highlight-model-title {
          font-size: clamp(3rem, 4.2vw, 4rem);
          line-height: 0.98;
          color: #f2fff8;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-subtitle {
          color: #d3eadf;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy p {
          color: #bbd6ca;
          font-size: 1.08rem;
          line-height: 1.6;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-cta {
          margin-top: 0.55rem;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-cta .sales-btn-primary {
          background: linear-gradient(135deg, #2ed47a, #39dc86);
          border-color: rgba(46, 212, 122, 0.48);
          color: #0a261c;
          box-shadow: 0 10px 24px rgba(46, 212, 122, 0.24);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-cta .sales-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(46, 212, 122, 0.28);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-preview {
          border-radius: 24px;
          padding: clamp(0.8rem, 1.2vw, 1rem);
          background: linear-gradient(160deg, rgba(9, 34, 26, 0.62), rgba(7, 28, 22, 0.46));
        }

        .highlight-model-shell.is-chatinterno .highlight-model-preview .platform-mock {
          opacity: 0.9;
        }

        .highlight-model-shell.is-chatinterno .platform-mock__frame {
          border-color: rgba(188, 219, 203, 0.14);
          background:
            radial-gradient(340px 130px at 14% 0%, rgba(46, 212, 122, 0.08), rgba(46, 212, 122, 0)),
            linear-gradient(180deg, rgba(246, 252, 249, 0.88), rgba(237, 246, 242, 0.82));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            0 8px 16px rgba(5, 17, 12, 0.08);
        }

        .highlight-model-shell.is-chatinterno .platform-mock__sidebar,
        .highlight-model-shell.is-chatinterno .platform-mock__metric,
        .highlight-model-shell.is-chatinterno .platform-mock__module,
        .highlight-model-shell.is-chatinterno .platform-mock__footer-card,
        .highlight-model-shell.is-chatinterno .platform-mock__lead-row,
        .highlight-model-shell.is-chatinterno .platform-mock__event-row,
        .highlight-model-shell.is-chatinterno .platform-mock__table-row,
        .highlight-model-shell.is-chatinterno .platform-mock__search,
        .highlight-model-shell.is-chatinterno .platform-mock__chart-grid {
          border-color: rgba(27, 86, 66, 0.1);
          box-shadow: none;
        }

        .highlight-model-shell.is-chatinterno .platform-mock__module--featured {
          border-color: rgba(46, 212, 122, 0.22);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao {
          --hl-shell-border: rgba(129, 206, 120, 0.38);
          --hl-shell-a: rgba(156, 253, 132, 0.24);
          --hl-shell-b: rgba(116, 194, 102, 0.2);
          --hl-shell-c: rgba(83, 154, 84, 0.2);
          --hl-shell-start: rgba(7, 25, 16, 0.98);
          --hl-shell-end: rgba(4, 16, 11, 0.98);

          --hl-badge-border: rgba(146, 233, 126, 0.44);
          --hl-badge-bg: linear-gradient(90deg, rgba(37, 90, 43, 0.78), rgba(57, 125, 63, 0.72), rgba(28, 70, 35, 0.78));
          --hl-badge-text: #f2fff2;

          --hl-preview-border: rgba(113, 181, 109, 0.34);
          --hl-preview-a: rgba(156, 253, 132, 0.22);
          --hl-preview-b: rgba(118, 197, 105, 0.16);
          --hl-preview-c: rgba(90, 153, 82, 0.16);
          --hl-preview-start: rgba(7, 25, 16, 0.96);
          --hl-preview-end: rgba(4, 17, 11, 0.95);
        }

        .highlight-model-shell.is-meta {
          --hl-shell-border: rgba(26, 59, 47, 0.14);
          --hl-shell-a: rgba(255, 255, 255, 0);
          --hl-shell-b: rgba(255, 255, 255, 0);
          --hl-shell-c: rgba(255, 255, 255, 0);
          --hl-shell-start: #ffffff;
          --hl-shell-end: #ffffff;

          --hl-badge-border: rgba(190, 118, 93, 0.34);
          --hl-badge-bg: linear-gradient(90deg, rgba(255, 206, 188, 0.66), rgba(255, 225, 167, 0.6), rgba(196, 236, 252, 0.52));
          --hl-badge-text: #5b2f25;

          --hl-preview-border: rgba(26, 59, 47, 0.12);
          --hl-preview-a: rgba(255, 255, 255, 0);
          --hl-preview-b: rgba(255, 255, 255, 0);
          --hl-preview-c: rgba(255, 255, 255, 0);
          --hl-preview-start: #ffffff;
          --hl-preview-end: #ffffff;

          --hl-brand-border: rgba(186, 117, 94, 0.28);
          --hl-brand-bg: linear-gradient(135deg, rgba(255, 219, 205, 0.72), rgba(255, 238, 195, 0.66));
          --hl-dot-a: #ff9d7c;
          --hl-dot-b: #f3bf59;
          --hl-search-line: linear-gradient(90deg, rgba(193, 113, 84, 0.42), rgba(183, 140, 52, 0.32));

          --hl-stat-1-border: rgba(201, 122, 94, 0.3);
          --hl-stat-1-bg: linear-gradient(180deg, rgba(255, 233, 224, 0.8), rgba(255, 255, 255, 0.88));
          --hl-stat-2-border: rgba(186, 141, 62, 0.3);
          --hl-stat-2-bg: linear-gradient(180deg, rgba(255, 245, 216, 0.8), rgba(255, 255, 255, 0.88));

          --hl-row-left-border: rgba(26, 59, 47, 0.12);
          --hl-row-left-bg: #ffffff;
          --hl-row-right-border: rgba(26, 59, 47, 0.12);
          --hl-row-right-bg: #ffffff;
        }

        .highlight-model-nav {
          border-right: 1px solid rgba(18, 47, 40, 0.14);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.74);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 246, 0.94));
          padding: 12px 12px 12px 24px;
          min-height: 100%;
          position: relative;
        }

        .highlight-model-nav-rail {
          position: absolute;
          left: 8px;
          top: 12px;
          bottom: 12px;
          width: 4px;
          border-radius: 999px;
          background: rgba(119, 160, 140, 0.18);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
        }

        .highlight-model-nav-rail-thumb {
          position: absolute;
          left: 0;
          width: 4px;
          height: 34px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(149, 229, 177, 0.96), rgba(107, 206, 146, 0.96));
          box-shadow: 0 0 0 1px rgba(127, 196, 150, 0.44), 0 8px 16px rgba(76, 153, 112, 0.28);
          transition: top 300ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .highlight-model-nav-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
        }

        .highlight-model-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          width: 100%;
          padding: 10px 12px;
          color: #5b6e67;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          background: transparent;
          border: 1px solid transparent;
          appearance: none;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .highlight-model-nav-item:not(.is-active):hover {
          color: #243f37;
          background: rgba(255, 255, 255, 0.45);
          border-color: rgba(18, 48, 40, 0.16);
          transform: translateY(-1px);
        }

        .highlight-model-nav-item:focus-visible {
          outline: 2px solid rgba(35, 198, 111, 0.5);
          outline-offset: 2px;
        }

        .highlight-model-nav-item.is-active {
          color: #14392f;
          border-color: rgba(52, 145, 88, 0.22);
          box-shadow: 0 10px 18px rgba(27, 103, 69, 0.16);
        }

        .highlight-model-nav-list li:nth-child(1) .highlight-model-nav-item.is-active {
          color: #effff6;
          background: linear-gradient(120deg, rgba(77, 127, 88, 0.64), rgba(35, 66, 52, 0.76));
          border-color: rgba(122, 179, 124, 0.5);
          box-shadow: 0 10px 18px rgba(5, 21, 16, 0.42);
        }

        .highlight-model-nav-list li:nth-child(2) .highlight-model-nav-item.is-active {
          color: #f1fff8;
          background: linear-gradient(120deg, rgba(95, 158, 113, 0.66), rgba(39, 79, 58, 0.78));
          border-color: rgba(142, 202, 149, 0.5);
          box-shadow: 0 10px 18px rgba(7, 25, 18, 0.38);
        }

        .highlight-model-nav-list li:nth-child(3) .highlight-model-nav-item.is-active {
          color: #163327;
          background: linear-gradient(120deg, #e3efe8, #d7e7dd);
          border-color: rgba(72, 124, 101, 0.22);
          box-shadow: 0 8px 14px rgba(10, 26, 18, 0.12);
        }

        .highlight-model-nav-list li:nth-child(4) .highlight-model-nav-item.is-active {
          color: #122d23;
          background: linear-gradient(120deg, #ffffff, #f7faf8);
          border-color: rgba(67, 110, 92, 0.18);
          box-shadow: 0 8px 14px rgba(8, 18, 13, 0.08);
        }

        .highlight-model-nav-icon {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          border: 1px solid rgba(18, 50, 41, 0.24);
          background: rgba(255, 255, 255, 0.52);
          position: relative;
        }

        .highlight-model-nav-list li:nth-child(1) .highlight-model-nav-icon,
        .highlight-model-nav-list li:nth-child(2) .highlight-model-nav-icon,
        .highlight-model-nav-list li:nth-child(3) .highlight-model-nav-icon,
        .highlight-model-nav-list li:nth-child(4) .highlight-model-nav-icon {
          border-color: rgba(96, 171, 132, 0.34);
          background: linear-gradient(180deg, rgba(235, 250, 242, 0.96), rgba(223, 245, 233, 0.94));
        }

        .highlight-model-nav-list li:nth-child(1) .highlight-model-nav-icon::before,
        .highlight-model-nav-list li:nth-child(1) .highlight-model-nav-icon::after,
        .highlight-model-nav-list li:nth-child(2) .highlight-model-nav-icon::before,
        .highlight-model-nav-list li:nth-child(2) .highlight-model-nav-icon::after,
        .highlight-model-nav-list li:nth-child(3) .highlight-model-nav-icon::before,
        .highlight-model-nav-list li:nth-child(3) .highlight-model-nav-icon::after,
        .highlight-model-nav-list li:nth-child(4) .highlight-model-nav-icon::before,
        .highlight-model-nav-list li:nth-child(4) .highlight-model-nav-icon::after {
          background: rgba(56, 137, 100, 0.96);
        }

        .highlight-model-nav-icon::before,
        .highlight-model-nav-icon::after {
          content: '';
          position: absolute;
          background: rgba(23, 65, 53, 0.88);
          border-radius: 1px;
        }

        .highlight-model-nav-icon::before {
          width: 10px;
          height: 2px;
          left: 6px;
          top: 8px;
        }

        .highlight-model-nav-icon::after {
          width: 6px;
          height: 2px;
          left: 6px;
          top: 13px;
        }

        .highlight-model-copy {
          display: grid;
          align-content: start;
          gap: 14px;
          color: #102f27;
          padding-top: 8px;
          min-height: var(--hl-main-card-height);
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy {
          color: #e6f6ef;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy {
          color: #ebfbf3;
        }

        .highlight-model-shell.is-integracao .highlight-model-copy {
          color: #ecfbe7;
        }

        .highlight-model-brand {
          display: inline-flex;
          align-items: center;
          width: 58px;
          opacity: 0.84;
        }

        .highlight-model-brand img {
          width: 100%;
          height: auto;
          display: block;
        }

        .highlight-model-badge {
          width: fit-content;
          border-radius: 10px;
          border: 1px solid var(--hl-badge-border);
          background: var(--hl-badge-bg);
          color: var(--hl-badge-text);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          padding: 8px 10px;
        }

        .highlight-model-title {
          margin: 0;
          font-size: 45px;
          line-height: 0.97;
          letter-spacing: -0.03em;
          color: #113227;
          max-width: 10ch;
          text-wrap: balance;
        }

        .highlight-model-shell.is-dashboard .highlight-model-title {
          color: #f5fff9;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-title {
          color: #f5fff9;
        }

        .highlight-model-shell.is-integracao .highlight-model-title {
          color: #f6fff3;
        }

        .highlight-model-subtitle {
          margin: 0;
          color: #5d746d;
          font-size: 33px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          max-width: 12ch;
        }

        .highlight-model-shell.is-dashboard .highlight-model-subtitle {
          color: #cde3d9;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-subtitle {
          color: #d4e9de;
        }

        .highlight-model-shell.is-integracao .highlight-model-subtitle {
          color: #d0e9cc;
        }

        .highlight-model-copy p {
          margin: 0;
          color: #5f756e;
          font-size: 15px;
          line-height: 1.55;
          max-width: 34ch;
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy p {
          color: #a9c6ba;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy p {
          color: #b5d1c3;
        }

        .highlight-model-shell.is-integracao .highlight-model-copy p {
          color: #b4ccb0;
        }

        .highlight-model-cta {
          justify-content: flex-start;
          margin-top: 2px;
        }

        .highlight-integration-tab {
          grid-column: 2 / -1;
          display: grid;
          grid-template-columns: 0.96fr 1.04fr;
          gap: 12px;
          align-items: stretch;
        }

        .highlight-integration-copy {
          border-radius: 16px;
          border: 1px solid var(--hl-preview-border);
          background:
            radial-gradient(260px 120px at 0% 0%, var(--hl-preview-a), rgba(95, 204, 160, 0)),
            linear-gradient(180deg, rgba(9, 31, 20, 0.92), rgba(6, 20, 13, 0.9));
          padding: 16px;
          min-height: var(--hl-main-card-height);
          box-shadow:
            inset 0 1px 0 rgba(184, 252, 165, 0.12),
            0 14px 28px rgba(5, 17, 10, 0.36);
        }

        .highlight-integration-copy .section-tag {
          margin-bottom: 12px;
        }

        .highlight-integration-title {
          margin: 0;
          font-size: 38px;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #f4fff1;
          max-width: 15ch;
        }

        .highlight-integration-subtitle {
          margin: 10px 0 0;
          color: #b7cfb3;
          font-size: 14px;
          line-height: 1.6;
          max-width: 44ch;
        }

        .highlight-integration-track {
          border-radius: 16px;
          border: 1px solid var(--hl-preview-border);
          background:
            radial-gradient(360px 160px at 100% 0%, var(--hl-preview-b), rgba(95, 204, 160, 0)),
            radial-gradient(320px 140px at 0% 100%, var(--hl-preview-c), rgba(95, 204, 160, 0)),
            linear-gradient(180deg, rgba(8, 28, 18, 0.95), rgba(4, 17, 11, 0.94));
          padding: 12px;
          overflow: hidden;
          min-height: var(--hl-main-card-height);
          box-shadow:
            inset 0 1px 0 rgba(185, 253, 167, 0.08),
            0 14px 28px rgba(5, 18, 10, 0.38);
        }

        .highlight-operation-mock {
          display: grid;
          gap: 10px;
          min-height: 340px;
          width: 100%;
          min-width: 0;
        }

        .highlight-operation-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: start;
          gap: 10px;
          min-width: 0;
        }

        .highlight-operation-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(156, 253, 132, 0.48);
          background: rgba(156, 253, 132, 0.14);
          color: #dfffd7;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.03em;
          padding: 7px 11px;
        }

        .highlight-operation-pill::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #9cfd84;
          box-shadow: 0 0 0 5px rgba(156, 253, 132, 0.16);
        }

        .highlight-operation-status {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          flex-wrap: wrap;
          min-width: 0;
          max-width: 100%;
        }

        .highlight-operation-status span {
          border-radius: 999px;
          border: 1px solid rgba(138, 222, 126, 0.42);
          background: rgba(47, 92, 46, 0.52);
          color: #ddffd3;
          font-size: 10px;
          font-weight: 700;
          padding: 6px 9px;
          line-height: 1;
        }

        .highlight-operation-layout {
          display: grid;
          grid-template-columns: minmax(0, 186px) minmax(0, 1fr);
          gap: 10px;
          flex: 1;
          width: 100%;
          min-height: 0;
          min-width: 0;
        }

        .highlight-operation-sidebar {
          border-radius: 13px;
          border: 1px solid rgba(108, 176, 103, 0.3);
          background: rgba(8, 30, 19, 0.72);
          padding: 10px;
          display: grid;
          align-content: start;
          gap: 7px;
          min-width: 0;
        }

        .highlight-operation-sidebar-head {
          color: #cce8c5;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 2px 4px 5px;
        }

        .highlight-operation-nav-item {
          border-radius: 10px;
          border: 1px solid rgba(94, 156, 93, 0.28);
          background: rgba(16, 43, 28, 0.72);
          min-height: 31px;
          padding: 7px 8px;
          color: #bedab8;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
        }

        .highlight-operation-nav-item .icon {
          width: 13px;
          height: 13px;
          color: currentColor;
          opacity: 0.9;
          flex: 0 0 auto;
        }

        .highlight-operation-nav-item.is-active {
          color: #f4fff1;
          border-color: rgba(156, 253, 132, 0.56);
          background: linear-gradient(90deg, rgba(55, 120, 58, 0.68), rgba(30, 66, 35, 0.8));
          box-shadow: 0 0 0 1px rgba(156, 253, 132, 0.12);
        }

        .highlight-operation-main {
          border-radius: 13px;
          border: 1px solid rgba(104, 170, 102, 0.3);
          background: rgba(8, 30, 20, 0.72);
          padding: 10px;
          display: grid;
          gap: 9px;
          align-content: start;
          min-width: 0;
        }

        .highlight-operation-main-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 9px;
          min-width: 0;
        }

        .highlight-operation-main-head h4 {
          margin: 0;
          color: #f4fff1;
          font-size: 15px;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        .highlight-operation-main-head p {
          margin: 0;
          color: #aec9ab;
          font-size: 11px;
          line-height: 1.3;
        }

        .highlight-operation-kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
          min-width: 0;
        }

        .highlight-operation-kpi {
          border-radius: 10px;
          border: 1px solid rgba(100, 163, 97, 0.28);
          background: rgba(15, 43, 29, 0.78);
          padding: 7px;
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .highlight-operation-kpi strong {
          color: #f3fff0;
          font-size: 17px;
          line-height: 1;
        }

        .highlight-operation-kpi span {
          color: #a9c5a6;
          font-size: 10px;
          line-height: 1.2;
        }

        .highlight-operation-modules {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
          gap: 8px;
          min-width: 0;
        }

        .highlight-operation-module {
          border-radius: 11px;
          border: 1px solid rgba(99, 164, 96, 0.28);
          background: rgba(14, 40, 27, 0.8);
          padding: 8px;
          display: grid;
          gap: 7px;
          align-content: start;
          min-width: 0;
        }

        .highlight-operation-module.is-inbox {
          border-color: rgba(156, 253, 132, 0.5);
          background: linear-gradient(180deg, rgba(22, 56, 35, 0.84), rgba(13, 36, 24, 0.82));
        }

        .highlight-operation-module-tag {
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(156, 253, 132, 0.44);
          background: rgba(156, 253, 132, 0.14);
          color: #e4ffd9;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          padding: 6px 9px;
        }

        .highlight-operation-module h5 {
          margin: 0;
          color: #efffec;
          font-size: 13px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .highlight-operation-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .highlight-operation-list li {
          border-radius: 8px;
          border: 1px solid rgba(103, 171, 100, 0.28);
          background: rgba(19, 49, 33, 0.72);
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          color: #b9d4b5;
          font-size: 10px;
          line-height: 1.2;
          min-width: 0;
        }

        .highlight-operation-list li strong {
          color: #efffec;
          font-size: 11px;
          font-weight: 700;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .highlight-operation-list li span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .highlight-operation-stage-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .highlight-operation-stage-list li {
          display: grid;
          gap: 4px;
        }

        .highlight-operation-stage-list span {
          color: #b5d1b2;
          font-size: 10px;
          line-height: 1.2;
        }

        .highlight-operation-stage-list i {
          font-style: normal;
          color: #defed5;
          font-size: 11px;
          font-weight: 700;
        }

        .highlight-operation-stage-bar {
          height: 6px;
          border-radius: 999px;
          background: rgba(156, 253, 132, 0.2);
          overflow: hidden;
        }

        .highlight-operation-stage-bar > span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(126, 222, 109, 0.9), rgba(156, 253, 132, 0.98));
        }

        .highlight-strategy-tab {
          grid-column: 2 / -1;
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 12px;
          align-items: stretch;
        }

        .highlight-strategy-panel {
          border-radius: 16px;
          border: 1px solid var(--hl-preview-border);
          background:
            radial-gradient(260px 120px at 0% 0%, var(--hl-preview-a), rgba(95, 204, 160, 0)),
            radial-gradient(320px 140px at 100% 0%, var(--hl-preview-b), rgba(95, 204, 160, 0)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(249, 245, 238, 0.84));
          padding: 16px;
          min-height: var(--hl-main-card-height);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            0 12px 22px rgba(20, 32, 27, 0.08);
        }

        .highlight-strategy-left .section-tag,
        .highlight-strategy-right .section-tag {
          margin-bottom: 12px;
        }

        .highlight-strategy-title {
          margin: 0;
          font-size: 38px;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #183d31;
          max-width: 16ch;
          text-wrap: balance;
        }

        .highlight-strategy-subtitle {
          margin: 10px 0 0;
          color: #58716a;
          font-size: 15px;
          line-height: 1.6;
          max-width: 56ch;
        }

        .highlight-strategy-intro {
          margin: 14px 0 0;
          border-radius: 14px;
          border: 1px solid var(--hl-preview-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(249, 245, 238, 0.82));
          padding: 14px;
          color: #5f7770;
          font-size: 16px;
          line-height: 1.55;
        }

        .highlight-strategy-pillar-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        .highlight-strategy-pillar {
          border-radius: 14px;
          border: 1px solid var(--hl-row-left-border);
          background: linear-gradient(180deg, var(--hl-row-left-bg), rgba(255, 255, 255, 0.88));
          padding: 12px;
          display: grid;
          gap: 9px;
          align-content: start;
          min-height: 100%;
        }

        .highlight-strategy-pill {
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(53, 217, 137, 0.34);
          background: rgba(53, 217, 137, 0.12);
          color: #225842;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          padding: 6px 10px;
        }

        .highlight-strategy-pillar h4 {
          margin: 0;
          color: #1c4739;
          font-size: 19px;
          line-height: 1.15;
          letter-spacing: -0.02em;
          text-wrap: balance;
        }

        .highlight-strategy-pillar p {
          margin: 0;
          color: #5f7770;
          font-size: 15px;
          line-height: 1.45;
        }

        .highlight-strategy-right {
          display: grid;
          align-content: start;
        }

        .highlight-strategy-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .highlight-strategy-list li {
          border-radius: 13px;
          border: 1px solid var(--hl-row-right-border);
          background: linear-gradient(180deg, var(--hl-row-right-bg), rgba(255, 255, 255, 0.88));
          padding: 11px 14px;
          color: #28433b;
          font-size: 16px;
          line-height: 1.45;
        }

        .highlight-strategy-divider {
          margin-top: 14px;
        }

        .highlight-strategy-divider .section-tag {
          margin-bottom: 10px;
        }

        .highlight-model-preview {
          border-radius: 16px;
          border: none;
          background: transparent;
          padding: 0;
          min-height: var(--hl-main-card-height);
          box-shadow: none;
        }

        .highlight-model-preview > .platform-mock,
        .highlight-model-preview > .hero-screen {
          height: 100%;
        }

        .highlight-model-preview.is-dashboard-preview .hero-screen-top {
          margin-bottom: 6px;
          padding: 0 2px;
        }

        .highlight-model-preview.is-dashboard-preview .hero-screen-brand {
          font-size: 12px;
        }

        .highlight-model-preview.is-dashboard-preview .hero-screen-brand img {
          width: 22px;
          height: 22px;
        }

        .highlight-model-preview.is-dashboard-preview .hero-real-mock {
          min-height: 360px;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav {
          border-right-color: rgba(110, 155, 129, 0.22);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item {
          color: #a8c3b7;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item:not(.is-active):hover {
          color: #eefdf5;
          background: rgba(61, 99, 77, 0.34);
          border-color: rgba(108, 157, 121, 0.34);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-icon {
          border-color: rgba(102, 149, 126, 0.3);
          background: rgba(18, 49, 40, 0.72);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-icon::before,
        .highlight-model-shell.is-dashboard .highlight-model-nav-icon::after {
          background: rgba(198, 224, 211, 0.92);
        }

        .highlight-model-shell.is-dashboard .hero-screen-brand {
          color: #ecfbf3;
        }

        .highlight-model-shell.is-dashboard .hero-real-mock {
          border-color: rgba(76, 134, 109, 0.38);
          background:
            radial-gradient(420px 180px at 84% 0%, rgba(71, 153, 102, 0.2), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(5, 23, 21, 0.98), rgba(3, 15, 13, 0.98));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .highlight-model-shell.is-dashboard .hero-real-sidebar,
        .highlight-model-shell.is-dashboard .hero-real-main {
          border-color: rgba(77, 131, 108, 0.34);
          background: rgba(8, 29, 26, 0.9);
        }

        .highlight-model-shell.is-dashboard .hero-real-sidebar-label {
          color: #9dc5b5;
        }

        .highlight-model-shell.is-dashboard .hero-real-nav-item {
          border-color: rgba(77, 130, 109, 0.3);
          background: rgba(15, 42, 37, 0.72);
          color: #d3eadd;
        }

        .highlight-model-shell.is-dashboard .hero-real-nav-item.is-active {
          border-color: rgba(99, 195, 140, 0.52);
          background: linear-gradient(90deg, rgba(38, 121, 82, 0.58), rgba(22, 64, 53, 0.62));
          color: #f0fff8;
        }

        .highlight-model-shell.is-dashboard .hero-real-nav-icon-box {
          border-color: rgba(123, 172, 149, 0.36);
          background: rgba(18, 49, 41, 0.76);
        }

        .highlight-model-shell.is-dashboard .hero-real-card {
          border-color: rgba(80, 137, 112, 0.28);
          background: rgba(12, 36, 32, 0.7);
        }

        .highlight-model-shell.is-dashboard .hero-real-header h3,
        .highlight-model-shell.is-dashboard .hero-real-card-title,
        .highlight-model-shell.is-dashboard .hero-real-general-list strong,
        .highlight-model-shell.is-dashboard .hero-real-metric-card strong,
        .highlight-model-shell.is-dashboard .hero-real-event-empty strong {
          color: #f1fff8;
        }

        .highlight-model-shell.is-dashboard .hero-real-header p,
        .highlight-model-shell.is-dashboard .hero-real-general-list li,
        .highlight-model-shell.is-dashboard .hero-real-event-empty span,
        .highlight-model-shell.is-dashboard .hero-real-metric-card span,
        .highlight-model-shell.is-dashboard .hero-real-funnel-stage span,
        .highlight-model-shell.is-dashboard .hero-real-funnel-stage i {
          color: #a8c7ba;
        }

        .highlight-model-shell.is-dashboard .hero-real-field,
        .highlight-model-shell.is-dashboard .hero-real-chip,
        .highlight-model-shell.is-dashboard .hero-real-toggle {
          border-color: rgba(83, 142, 116, 0.36);
          background: rgba(18, 45, 39, 0.76);
          color: #def2e8;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav {
          border-right-color: rgba(115, 171, 136, 0.24);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item {
          color: #b4d2c3;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active):hover {
          color: #f1fff9;
          background: rgba(68, 116, 88, 0.34);
          border-color: rgba(121, 182, 139, 0.34);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon {
          border-color: rgba(112, 170, 136, 0.32);
          background: rgba(22, 61, 46, 0.74);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon::before,
        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon::after {
          background: rgba(205, 233, 217, 0.94);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-brand {
          color: #effff7;
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-brand-context {
          color: #b9d8c9;
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-search {
          border-color: rgba(96, 159, 127, 0.3);
          background: rgba(17, 50, 40, 0.78);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-stat strong {
          color: #f2fff8;
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-stat span {
          color: #b4d1c3;
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-column {
          border-color: rgba(88, 152, 121, 0.28);
          background: rgba(13, 43, 35, 0.8);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-row {
          border-color: rgba(94, 161, 126, 0.28);
          background: rgba(16, 49, 39, 0.82);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-row-title {
          color: #e9fbf2;
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-row::before,
        .highlight-model-shell.is-chatinterno .highlight-preview-row::after {
          background: rgba(171, 223, 195, 0.26);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-chart {
          border-color: rgba(94, 161, 126, 0.28);
          background: rgba(14, 45, 36, 0.82);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-chart-line {
          background: rgba(171, 223, 195, 0.22);
        }

        .highlight-model-shell.is-chatinterno .highlight-preview-chart-line.is-green {
          background: linear-gradient(180deg, rgba(153, 243, 188, 0.84), rgba(88, 173, 126, 0.34));
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav,
        .highlight-model-shell.is-chatinterno .highlight-model-copy,
        .highlight-model-shell.is-chatinterno .highlight-model-preview,
        .highlight-model-shell.is-chatinterno .platform-mock__frame {
          border: none;
          box-shadow: none;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav {
          background: linear-gradient(145deg, #123c2f, #0f2e23);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy {
          background: linear-gradient(145deg, #2d6d52, #255e47);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-preview {
          background: linear-gradient(145deg, #e3efe8, #d7e7dd);
        }

        .highlight-model-shell.is-chatinterno .platform-mock__frame {
          background: linear-gradient(145deg, #ffffff, #f7faf8);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-preview .platform-mock {
          opacity: 1;
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active) {
          color: rgba(238, 251, 245, 0.88);
          border-color: rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.04);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active):hover {
          color: #f6fff9;
          border-color: rgba(255, 255, 255, 0.26);
          background: rgba(255, 255, 255, 0.1);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav {
          border-right-color: rgba(132, 204, 121, 0.24);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-item {
          color: #bed9b8;
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-item:not(.is-active):hover {
          color: #f4fff1;
          background: rgba(70, 131, 63, 0.36);
          border-color: rgba(156, 253, 132, 0.42);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-icon {
          border-color: rgba(128, 196, 117, 0.34);
          background: rgba(22, 59, 28, 0.76);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-icon::before,
        .highlight-model-shell.is-integracao .highlight-model-nav-icon::after {
          background: rgba(223, 255, 213, 0.94);
        }

        .highlight-model-shell.is-integracao .highlight-integration-copy .section-tag,
        .highlight-model-shell.is-integracao .highlight-integration-track .section-tag {
          border-color: rgba(156, 253, 132, 0.42);
          background: rgba(156, 253, 132, 0.12);
          color: #dfffd6;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav,
        .highlight-model-shell.is-chatinterno .highlight-model-nav,
        .highlight-model-shell.is-integracao .highlight-model-nav,
        .highlight-model-shell.is-meta .highlight-model-nav {
          border-right-color: rgba(23, 57, 48, 0.14);
          border-color: rgba(255, 255, 255, 0.74);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 246, 0.94));
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item:not(.is-active),
        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active),
        .highlight-model-shell.is-integracao .highlight-model-nav-item:not(.is-active),
        .highlight-model-shell.is-meta .highlight-model-nav-item:not(.is-active) {
          color: #304840;
          border-color: rgba(23, 58, 48, 0.1);
          background: rgba(255, 255, 255, 0.62);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item:not(.is-active):hover,
        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active):hover,
        .highlight-model-shell.is-integracao .highlight-model-nav-item:not(.is-active):hover,
        .highlight-model-shell.is-meta .highlight-model-nav-item:not(.is-active):hover {
          color: #18382f;
          border-color: rgba(23, 58, 48, 0.18);
          background: rgba(255, 255, 255, 0.96);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-icon,
        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon,
        .highlight-model-shell.is-integracao .highlight-model-nav-icon,
        .highlight-model-shell.is-meta .highlight-model-nav-icon {
          border-color: rgba(96, 171, 132, 0.34);
          background: linear-gradient(180deg, rgba(235, 250, 242, 0.96), rgba(223, 245, 233, 0.94));
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-icon::before,
        .highlight-model-shell.is-dashboard .highlight-model-nav-icon::after,
        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon::before,
        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon::after,
        .highlight-model-shell.is-integracao .highlight-model-nav-icon::before,
        .highlight-model-shell.is-integracao .highlight-model-nav-icon::after,
        .highlight-model-shell.is-meta .highlight-model-nav-icon::before,
        .highlight-model-shell.is-meta .highlight-model-nav-icon::after {
          background: rgba(56, 137, 100, 0.96);
        }

        /* Progressive gradient by tab: Dashboard -> Recursos -> Operação -> Estratégia */
        .highlight-model-shell.is-dashboard .highlight-model-nav {
          border: none;
          box-shadow: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 246, 0.94));
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy,
        .highlight-model-shell.is-dashboard .highlight-model-preview,
        .highlight-model-shell.is-dashboard .hero-real-mock {
          border: none;
          box-shadow: none;
          background:
            radial-gradient(420px 240px at 8% 0%, rgba(156, 253, 132, 0.14), rgba(156, 253, 132, 0) 72%),
            radial-gradient(360px 220px at 100% 0%, rgba(45, 109, 82, 0.2), rgba(45, 109, 82, 0) 72%),
            linear-gradient(145deg, #123c2f, #0f2e23);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item:not(.is-active) {
          color: #304840;
          border-color: rgba(23, 58, 48, 0.1);
          background: rgba(255, 255, 255, 0.62);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-item:not(.is-active):hover {
          color: #18382f;
          border-color: rgba(23, 58, 48, 0.18);
          background: rgba(255, 255, 255, 0.96);
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav-icon {
          border-color: rgba(96, 171, 132, 0.34);
          background: linear-gradient(180deg, rgba(235, 250, 242, 0.96), rgba(223, 245, 233, 0.94));
        }

        .highlight-model-shell.is-dashboard .hero-real-sidebar,
        .highlight-model-shell.is-dashboard .hero-real-main,
        .highlight-model-shell.is-dashboard .hero-real-card,
        .highlight-model-shell.is-dashboard .hero-real-metric-card,
        .highlight-model-shell.is-dashboard .hero-real-funnel-stage,
        .highlight-model-shell.is-dashboard .hero-real-nav-item,
        .highlight-model-shell.is-dashboard .hero-real-field,
        .highlight-model-shell.is-dashboard .hero-real-chip,
        .highlight-model-shell.is-dashboard .hero-real-toggle {
          background: linear-gradient(145deg, rgba(18, 60, 47, 0.92), rgba(15, 46, 35, 0.9));
          border-color: rgba(184, 223, 203, 0.22);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav {
          border: none;
          box-shadow: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 246, 0.94));
        }

        .highlight-model-shell.is-chatinterno .highlight-model-copy,
        .highlight-model-shell.is-chatinterno .highlight-model-preview,
        .highlight-model-shell.is-chatinterno .platform-mock__frame {
          --resources-panel-surface: linear-gradient(145deg, rgba(11, 38, 30, 0.92), rgba(9, 31, 25, 0.9));
          --resources-card-surface: linear-gradient(145deg, rgba(19, 58, 46, 0.93), rgba(16, 48, 38, 0.9));
          --resources-sidebar-surface: linear-gradient(145deg, rgba(21, 62, 49, 0.95), rgba(18, 52, 41, 0.93));
          border: none;
          box-shadow: none;
          background:
            radial-gradient(420px 240px at 8% 0%, rgba(46, 212, 122, 0.16), rgba(46, 212, 122, 0) 72%),
            radial-gradient(360px 220px at 100% 0%, rgba(18, 60, 47, 0.2), rgba(18, 60, 47, 0) 72%),
            linear-gradient(145deg, #2d6d52, #255e47);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active) {
          color: #304840;
          border-color: rgba(23, 58, 48, 0.1);
          background: rgba(255, 255, 255, 0.62);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-item:not(.is-active):hover {
          color: #18382f;
          border-color: rgba(23, 58, 48, 0.18);
          background: rgba(255, 255, 255, 0.96);
        }

        .highlight-model-shell.is-chatinterno .highlight-model-nav-icon {
          border-color: rgba(96, 171, 132, 0.34);
          background: linear-gradient(180deg, rgba(235, 250, 242, 0.96), rgba(223, 245, 233, 0.94));
        }

        .highlight-model-shell.is-chatinterno .platform-mock__sidebar {
          background: var(--resources-sidebar-surface);
          border-color: rgba(184, 223, 203, 0.26);
        }

        .highlight-model-shell.is-chatinterno .platform-mock__panel {
          background: var(--resources-panel-surface);
          border-color: rgba(184, 223, 203, 0.22);
        }

        .highlight-model-shell.is-chatinterno .platform-mock__metric,
        .highlight-model-shell.is-chatinterno .platform-mock__module,
        .highlight-model-shell.is-chatinterno .platform-mock__footer-card,
        .highlight-model-shell.is-chatinterno .platform-mock__lead-row,
        .highlight-model-shell.is-chatinterno .platform-mock__event-row,
        .highlight-model-shell.is-chatinterno .platform-mock__table-row,
        .highlight-model-shell.is-chatinterno .platform-mock__search,
        .highlight-model-shell.is-chatinterno .platform-mock__chart-grid {
          background: var(--resources-card-surface);
          border-color: rgba(184, 223, 203, 0.24);
        }

        .highlight-model-shell.is-chatinterno .platform-mock__brand strong,
        .highlight-model-shell.is-chatinterno .platform-mock__sidebar-item span,
        .highlight-model-shell.is-chatinterno .platform-mock__metric strong,
        .highlight-model-shell.is-chatinterno .platform-mock__module h4,
        .highlight-model-shell.is-chatinterno .platform-mock__module-badge,
        .highlight-model-shell.is-chatinterno .platform-mock__table-head strong,
        .highlight-model-shell.is-chatinterno .platform-mock__lead-id strong,
        .highlight-model-shell.is-chatinterno .platform-mock__event-row strong,
        .highlight-model-shell.is-chatinterno .platform-mock__funnel-head strong {
          color: #f2fff8;
        }

        .highlight-model-shell.is-chatinterno .platform-mock__pill,
        .highlight-model-shell.is-chatinterno .platform-mock__metric span,
        .highlight-model-shell.is-chatinterno .platform-mock__module-count,
        .highlight-model-shell.is-chatinterno .platform-mock__lead-id span,
        .highlight-model-shell.is-chatinterno .platform-mock__table-head span,
        .highlight-model-shell.is-chatinterno .platform-mock__event-row span,
        .highlight-model-shell.is-chatinterno .platform-mock__funnel-head span,
        .highlight-model-shell.is-chatinterno .platform-mock__sidebar-label {
          color: #c5dfd2;
        }

        .highlight-model-shell.is-integracao .highlight-model-nav {
          border: none;
          box-shadow: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 249, 246, 0.94));
        }

        .highlight-model-shell.is-integracao .highlight-integration-copy,
        .highlight-model-shell.is-integracao .highlight-integration-track {
          border: none;
          box-shadow: none;
          background:
            radial-gradient(320px 180px at 10% 0%, rgba(156, 253, 132, 0.12), rgba(156, 253, 132, 0) 72%),
            linear-gradient(145deg, #e3efe8, #d7e7dd);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-item:not(.is-active) {
          color: #27463b;
          border-color: rgba(44, 86, 68, 0.14);
          background: rgba(255, 255, 255, 0.58);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-item:not(.is-active):hover {
          color: #163327;
          border-color: rgba(44, 86, 68, 0.2);
          background: rgba(255, 255, 255, 0.86);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav-icon {
          border-color: rgba(96, 171, 132, 0.34);
          background: linear-gradient(180deg, rgba(235, 250, 242, 0.96), rgba(223, 245, 233, 0.94));
        }

        .highlight-model-shell.is-integracao .highlight-integration-title,
        .highlight-model-shell.is-integracao .highlight-operation-main-head h4,
        .highlight-model-shell.is-integracao .highlight-operation-module h5 {
          color: #153327;
        }

        .highlight-model-shell.is-integracao .highlight-integration-subtitle,
        .highlight-model-shell.is-integracao .highlight-operation-main-head p,
        .highlight-model-shell.is-integracao .highlight-operation-kpi span {
          color: #3d5f53;
        }

        .highlight-model-shell.is-integracao .highlight-operation-sidebar,
        .highlight-model-shell.is-integracao .highlight-operation-main {
          background:
            radial-gradient(220px 120px at 0% 0%, rgba(156, 253, 132, 0.1), rgba(156, 253, 132, 0) 72%),
            linear-gradient(145deg, rgba(227, 239, 232, 0.96), rgba(215, 231, 221, 0.92));
          border-color: rgba(44, 86, 68, 0.18);
        }

        .highlight-model-shell.is-integracao .highlight-operation-kpi,
        .highlight-model-shell.is-integracao .highlight-operation-module,
        .highlight-model-shell.is-integracao .highlight-operation-list li,
        .highlight-model-shell.is-integracao .highlight-operation-nav-item {
          background: linear-gradient(145deg, rgba(227, 239, 232, 0.98), rgba(215, 231, 221, 0.94));
          border-color: rgba(44, 86, 68, 0.2);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-operation-nav-item {
          color: #23483a;
        }

        .highlight-model-shell.is-integracao .highlight-operation-nav-item.is-active {
          color: #12382b;
          border-color: rgba(120, 191, 109, 0.52);
          background: linear-gradient(120deg, rgba(156, 253, 132, 0.3), rgba(128, 206, 118, 0.24));
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-operation-sidebar-head,
        .highlight-model-shell.is-integracao .highlight-operation-list li,
        .highlight-model-shell.is-integracao .highlight-operation-stage-list span,
        .highlight-model-shell.is-integracao .highlight-operation-stage-list i,
        .highlight-model-shell.is-integracao .highlight-operation-kpi strong,
        .highlight-model-shell.is-integracao .highlight-operation-module-tag {
          color: #1f4737;
        }

        .highlight-model-shell.is-integracao .highlight-operation-list li strong {
          color: #12372b;
        }

        .highlight-model-shell.is-integracao .highlight-operation-status span,
        .highlight-model-shell.is-integracao .highlight-operation-pill {
          background: rgba(156, 253, 132, 0.2);
          border-color: rgba(120, 191, 109, 0.4);
          color: #1f4737;
        }

        .highlight-model-shell.is-integracao .highlight-operation-stage-bar {
          background: rgba(74, 129, 95, 0.18);
        }

        .highlight-model-shell.is-meta .highlight-model-nav,
        .highlight-model-shell.is-meta .highlight-strategy-panel {
          border: none;
          box-shadow: none;
          background: #ffffff;
        }

        .highlight-model-shell.is-meta {
          background: #ffffff;
        }

        .highlight-model-shell.is-meta .highlight-strategy-panel,
        .highlight-model-shell.is-meta .highlight-strategy-intro,
        .highlight-model-shell.is-meta .highlight-strategy-pillar,
        .highlight-model-shell.is-meta .highlight-strategy-list li {
          background: #ffffff;
          border-color: rgba(25, 58, 47, 0.12);
          box-shadow: none;
        }

        .highlight-model-shell.is-dashboard {
          gap: clamp(1.5rem, 2.1vw, 2rem);
          padding: clamp(1.5rem, 2.2vw, 2rem);
          border-radius: 24px;
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy {
          border-radius: 24px;
          padding: clamp(1.6rem, 2.1vw, 2rem);
          gap: 1rem;
        }

        .highlight-model-shell.is-dashboard .highlight-model-title {
          font-size: clamp(3rem, 4.2vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.035em;
          max-width: 9ch;
        }

        .highlight-model-shell.is-dashboard .highlight-model-subtitle {
          font-size: clamp(2.2rem, 3.2vw, 3.1rem);
          line-height: 1.08;
          max-width: 10ch;
          color: #d3eadf;
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy p {
          font-size: 1.08rem;
          line-height: 1.6;
          max-width: 36ch;
          color: #bbd6ca;
        }

        .highlight-model-shell.is-dashboard .highlight-model-cta {
          margin-top: 0.55rem;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav,
        .highlight-model-shell.is-dashboard .highlight-model-preview {
          border-radius: 24px;
          padding: clamp(0.8rem, 1.2vw, 1rem);
        }

        .highlight-model-shell.is-integracao,
        .highlight-model-shell.is-meta {
          gap: clamp(1.5rem, 2.1vw, 2rem);
          padding: clamp(1.5rem, 2.2vw, 2rem);
          border-radius: 24px;
        }

        .highlight-model-shell.is-dashboard {
          background:
            radial-gradient(560px 250px at 8% 0%, rgba(156, 253, 132, 0.16), rgba(156, 253, 132, 0) 74%),
            radial-gradient(540px 240px at 88% 0%, rgba(45, 109, 82, 0.22), rgba(45, 109, 82, 0) 74%),
            linear-gradient(145deg, #123c2f, #0f2e23);
        }

        .highlight-model-shell.is-chatinterno {
          background:
            radial-gradient(560px 250px at 8% 0%, rgba(46, 212, 122, 0.14), rgba(46, 212, 122, 0) 74%),
            radial-gradient(540px 240px at 88% 0%, rgba(18, 60, 47, 0.18), rgba(18, 60, 47, 0) 74%),
            linear-gradient(145deg, #245742, #1e4b39);
        }

        .highlight-model-shell.is-integracao {
          background:
            radial-gradient(560px 250px at 8% 0%, rgba(156, 253, 132, 0.16), rgba(156, 253, 132, 0) 74%),
            radial-gradient(540px 240px at 88% 0%, rgba(45, 109, 82, 0.22), rgba(45, 109, 82, 0) 74%),
            linear-gradient(145deg, #123c2f, #0f2e23);
        }

        .highlight-model-shell.is-integracao .highlight-model-nav,
        .highlight-model-shell.is-meta .highlight-model-nav {
          border-radius: 24px;
          padding: clamp(0.8rem, 1.2vw, 1rem);
        }

        .highlight-model-shell.is-integracao .highlight-integration-tab {
          gap: clamp(1.2rem, 1.7vw, 1.6rem);
        }

        .highlight-model-shell.is-integracao .highlight-integration-copy,
        .highlight-model-shell.is-integracao .highlight-integration-track {
          border-radius: 24px;
          padding: clamp(1.35rem, 2vw, 1.8rem);
        }

        .highlight-model-shell.is-integracao .highlight-integration-title {
          font-size: clamp(3rem, 4.2vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.035em;
          max-width: 9ch;
        }

        .highlight-model-shell.is-integracao .highlight-integration-subtitle {
          font-size: 1.08rem;
          line-height: 1.6;
          max-width: 36ch;
        }

        .highlight-model-shell.is-integracao .highlight-model-cta {
          margin-top: 0.55rem;
        }

        .highlight-model-shell.is-meta .highlight-strategy-tab {
          gap: clamp(1.2rem, 1.7vw, 1.6rem);
        }

        .highlight-model-shell.is-meta .highlight-strategy-panel {
          border-radius: 24px;
          padding: clamp(1.35rem, 2vw, 1.8rem);
        }

        .highlight-model-shell.is-meta .highlight-strategy-title {
          font-size: clamp(3rem, 4.2vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.035em;
          max-width: 9ch;
        }

        .highlight-model-shell.is-meta .highlight-strategy-subtitle,
        .highlight-model-shell.is-meta .highlight-strategy-intro,
        .highlight-model-shell.is-meta .highlight-strategy-list li,
        .highlight-model-shell.is-meta .highlight-strategy-pillar p {
          font-size: 1.08rem;
          line-height: 1.6;
        }

        .highlight-preview-top {
          display: grid;
          grid-template-columns: 132px 1fr;
          gap: 8px;
          align-items: center;
        }

        .highlight-preview-brand {
          border-radius: 10px;
          border: 1px solid var(--hl-brand-border);
          background: var(--hl-brand-bg);
          min-height: 36px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #173b30;
          font-size: 12px;
          font-weight: 700;
        }

        .highlight-preview-brand-main {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .highlight-preview-brand-context {
          margin-left: auto;
          color: #4a655e;
          font-size: 10px;
          font-weight: 600;
          max-width: 106px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .highlight-preview-brand-dot {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--hl-dot-a), var(--hl-dot-b));
          box-shadow: 0 0 0 4px rgba(79, 201, 255, 0.16);
        }

        .highlight-preview-search {
          border-radius: 10px;
          border: 1px solid rgba(50, 102, 90, 0.16);
          background: rgba(255, 255, 255, 0.72);
          min-height: 36px;
          position: relative;
        }

        .highlight-preview-search::after {
          content: '';
          position: absolute;
          left: 12px;
          right: 28%;
          top: 50%;
          height: 6px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: var(--hl-search-line);
        }

        .highlight-preview-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .highlight-preview-stat {
          border-radius: 12px;
          border: 1px solid rgba(56, 106, 95, 0.2);
          background: rgba(255, 255, 255, 0.82);
          min-height: 74px;
          padding: 10px;
          display: grid;
          align-content: center;
          gap: 4px;
        }

        .highlight-preview-stat:nth-child(1) {
          border-color: var(--hl-stat-1-border);
          background: var(--hl-stat-1-bg);
        }

        .highlight-preview-stat:nth-child(2) {
          border-color: var(--hl-stat-2-border);
          background: var(--hl-stat-2-bg);
        }

        .highlight-preview-stat strong {
          color: #173d31;
          font-size: 23px;
          line-height: 1;
        }

        .highlight-preview-stat span {
          color: #5d736d;
          font-size: 11px;
          line-height: 1.25;
        }

        .highlight-preview-main {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 8px;
          min-height: 0;
          flex: 1;
        }

        .highlight-preview-column {
          border-radius: 12px;
          border: 1px solid rgba(58, 108, 96, 0.18);
          background: rgba(255, 255, 255, 0.78);
          padding: 10px;
          display: grid;
          align-content: start;
          gap: 8px;
        }

        .highlight-preview-row {
          border-radius: 10px;
          border: 1px solid rgba(57, 106, 95, 0.16);
          background: rgba(248, 253, 251, 0.92);
          padding: 9px;
          display: grid;
          gap: 6px;
        }

        .highlight-preview-column:first-child .highlight-preview-row {
          border-color: var(--hl-row-left-border);
          background: var(--hl-row-left-bg);
        }

        .highlight-preview-column:last-child .highlight-preview-row {
          border-color: var(--hl-row-right-border);
          background: var(--hl-row-right-bg);
        }

        .highlight-preview-row-title {
          color: #24483e;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.3;
        }

        .highlight-preview-row::before,
        .highlight-preview-row::after {
          content: '';
          height: 6px;
          border-radius: 999px;
          background: rgba(23, 61, 49, 0.18);
          display: block;
        }

        .highlight-preview-row::after {
          width: 68%;
        }

        .highlight-preview-chart {
          border-radius: 10px;
          border: 1px solid rgba(57, 106, 95, 0.16);
          background: rgba(249, 253, 251, 0.9);
          padding: 9px;
          min-height: 130px;
          display: grid;
          align-content: end;
          gap: 6px;
        }

        .highlight-preview-chart-line {
          height: 2px;
          border-radius: 999px;
          background: rgba(32, 84, 71, 0.2);
        }

        .highlight-preview-chart-line.is-green {
          height: 28px;
          border-radius: 999px 999px 5px 5px;
          background: linear-gradient(180deg, rgba(86, 206, 255, 0.78), rgba(74, 196, 125, 0.28));
          width: 84%;
          justify-self: center;
        }

        .highlight-model-resource-card {
          margin-top: clamp(1.4rem, 2.8vw, 2rem);
          display: grid;
          gap: 0.9rem;
        }

        .highlight-model-resource-head h3 {
          margin: 0;
          color: #e6f4f3;
          font-size: 16px;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .highlight-model-resource-head p {
          margin: 4px 0 0;
          color: #9cb8b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .cardsContainer {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: stretch;
          gap: 1.5rem;
        }

        .highlight-model-resource-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1.5rem;
          align-items: stretch;
        }

        .highlight-model-resource-card .card {
          border-radius: 20px;
          padding: 2rem;
          height: 100%;
          min-height: clamp(170px, 13vw, 210px);
          box-sizing: border-box;
        }

        .highlight-model-resource-item {
          --card-bg-a: #123c2f;
          --card-bg-b: #0f3126;
          --card-kicker: #b9dece;
          --card-title: #eff9f4;
          --card-text: #c9dfd5;
          border-radius: 20px;
          border: none;
          box-shadow: none;
          background: linear-gradient(145deg, var(--card-bg-a), var(--card-bg-b));
          padding: 2rem;
          min-height: clamp(170px, 13vw, 210px);
          height: 100%;
          display: grid;
          align-content: start;
          gap: 0.58rem;
          transition: transform 180ms ease, filter 180ms ease;
          overflow: hidden;
        }

        .highlight-model-resource-item:hover {
          transform: translateY(-3px);
          filter: brightness(1.02);
        }

        .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: hsl(152 28% 34%);
          --card-bg-b: hsl(150 27% 30%);
          --card-kicker: #d8ebde;
          --card-title: #f5fbf8;
          --card-text: #ddece4;
        }

        .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: hsl(142 34% 92%);
          --card-bg-b: hsl(142 28% 88%);
          --card-kicker: #3b6154;
          --card-title: #183227;
          --card-text: #35554a;
        }

        .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #ffffff;
          --card-bg-b: #f4f7f5;
          --card-kicker: #385e51;
          --card-title: #162f26;
          --card-text: #345348;
        }

        .highlight-model-resource-kicker {
          color: var(--card-kicker);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .highlight-model-resource-item h4 {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
          color: var(--card-title);
          letter-spacing: -0.01em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .highlight-model-resource-item p {
          margin: 0;
          color: var(--card-text);
          font-size: 12px;
          line-height: 1.52;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .highlight-model-resource-card.is-chatinterno {
          margin-top: clamp(1.6rem, 2.4vw, 2.2rem);
          gap: 0.95rem;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-head h3 {
          color: #eaf8f1;
          font-size: 1.05rem;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-head p {
          color: #b5d2c4;
          font-size: 0.9rem;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-grid {
          gap: clamp(1.5rem, 1.9vw, 2rem);
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item {
          border: none;
          border-radius: 20px;
          box-shadow: none;
          min-height: clamp(170px, 13vw, 210px);
          height: 100%;
          padding: 2rem;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(1) {
          --card-bg-a: #123c2f;
          --card-bg-b: #0f2e23;
          --card-kicker: #b8dbc9;
          --card-title: #f2fbf6;
          --card-text: #cae3d7;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: #2d6d52;
          --card-bg-b: #255e47;
          --card-kicker: #d6ece1;
          --card-title: #f6fcf9;
          --card-text: #dfefe7;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: #e3efe8;
          --card-bg-b: #d7e7dd;
          --card-kicker: #3a6153;
          --card-title: #173327;
          --card-text: #36584b;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #ffffff;
          --card-bg-b: #f7faf8;
          --card-kicker: #355d4f;
          --card-title: #132d24;
          --card-text: #325347;
        }

        .journey-layout {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 14px;
          align-items: start;
        }

        .journey-copy-pane {
          border-radius: 16px;
          border: 1px solid rgba(35, 198, 111, 0.07);
          background:
            radial-gradient(240px 120px at 0% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.01));
          padding: 14px;
        }

        .journey-track {
          position: relative;
          border-radius: 16px;
          border: 1px solid rgba(35, 198, 111, 0.07);
          background:
            radial-gradient(280px 120px at 100% 0%, rgba(35, 198, 111, 0.06), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.01));
          padding: 12px;
          overflow: hidden;
        }

        .journey-track::before {
          content: '';
          position: absolute;
          left: 26px;
          top: 22px;
          bottom: 22px;
          width: 1px;
          background: linear-gradient(180deg, rgba(53, 224, 132, 0.38), rgba(53, 224, 132, 0.05));
          pointer-events: none;
          z-index: 0;
        }

        .journey-grid.journey-grid-timeline {
          grid-template-columns: 1fr;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .journey-grid.journey-grid-timeline .journey-card {
          position: relative;
          padding-left: 42px;
          min-height: 88px;
        }

        .journey-grid.journey-grid-timeline .journey-card::before {
          content: '';
          position: absolute;
          left: 14px;
          top: 20px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #35e084;
          box-shadow:
            0 0 0 4px rgba(53, 224, 132, 0.1),
            0 0 12px rgba(53, 224, 132, 0.16);
        }

        .journey-grid.journey-grid-timeline .journey-step {
          margin-bottom: 2px;
        }

        .section-title {
          margin: 0;
          font-size: 20px;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }

        .pricing-card {
          position: relative;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(260px 150px at 100% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0)),
            linear-gradient(160deg, rgba(10, 25, 29, 0.96), rgba(6, 17, 20, 0.98));
          padding: 20px;
          display: grid;
          gap: 12px;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
        }

        .pricing-card.is-featured {
          background:
            radial-gradient(320px 170px at 100% 0%, rgba(35, 198, 111, 0.16), rgba(35, 198, 111, 0)),
            linear-gradient(160deg, rgba(5, 13, 16, 0.99), rgba(3, 9, 12, 0.99));
          border-color: rgba(35, 198, 111, 0.38);
          box-shadow:
            0 14px 36px rgba(35, 198, 111, 0.2),
            0 0 0 1px rgba(35, 198, 111, 0.14);
        }

        .pricing-popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.35);
          background: linear-gradient(180deg, rgba(35, 198, 111, 0.26), rgba(35, 198, 111, 0.16));
          color: #d5ffe7;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 5px 12px;
          white-space: nowrap;
        }

        .pricing-name {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.02em;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
        }

        .pricing-subtitle {
          margin: 0;
          color: #aac2c2;
          font-size: 13px;
          line-height: 1.5;
          min-height: 40px;
        }

        .pricing-price-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .pricing-price {
          margin: 0;
          font-size: 40px;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .pricing-period {
          color: #a9c1c1;
          font-size: 14px;
          font-weight: 700;
        }

        .pricing-billing {
          margin: -2px 0 0;
          color: #91abab;
          font-size: 12px;
          line-height: 1.45;
        }

        .pricing-meta-list {
          margin: 2px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }

        .pricing-meta-item {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          color: #d8eaea;
          padding: 9px 10px;
          font-size: 12px;
          line-height: 1.4;
        }

        .pricing-meta-item strong {
          color: #f0fbfb;
          font-size: 13px;
        }

        .pricing-advanced-state {
          color: #bad8d8;
        }

        .pricing-advanced-state.is-locked {
          color: #d8cfbf;
        }

        .pricing-button {
          margin-top: 6px;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(35, 198, 111, 0.3);
          background: rgba(35, 198, 111, 0.1);
          color: #d6ffe8;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.01em;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .pricing-button:hover {
          transform: translateY(-2px);
          background: rgba(35, 198, 111, 0.15);
          box-shadow: 0 10px 24px rgba(35, 198, 111, 0.18);
        }

        .pricing-button.is-featured {
          background: linear-gradient(135deg, rgba(35, 198, 111, 0.92), rgba(21, 163, 74, 0.92));
          border-color: rgba(35, 198, 111, 0.55);
          color: #04130c;
          box-shadow: 0 8px 24px rgba(35, 198, 111, 0.24);
        }

        .pricing-button.is-featured:hover {
          background: linear-gradient(135deg, #35e084, #23c66f);
          box-shadow: 0 14px 30px rgba(35, 198, 111, 0.3);
        }

        .plan-unified-compare {
          margin-top: 16px;
          grid-column: 1 / -1;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(520px 220px at 8% 0%, rgba(35, 198, 111, 0.09), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.008));
          overflow: hidden;
        }

        .plan-compare-details {
          margin: 0;
        }

        .plan-compare-details summary {
          width: 100%;
          list-style: none;
          cursor: pointer;
          color: #e8f4f0;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(90deg, rgba(35, 198, 111, 0.06), rgba(13, 31, 33, 0.18));
          transition: background 160ms ease, color 160ms ease;
        }

        .plan-compare-details summary::-webkit-details-marker {
          display: none;
        }

        .plan-compare-details summary:hover {
          background: linear-gradient(90deg, rgba(35, 198, 111, 0.1), rgba(13, 31, 33, 0.26));
        }

        .plan-compare-details summary:focus-visible {
          outline: 2px solid rgba(126, 243, 177, 0.55);
          outline-offset: -2px;
        }

        .plan-compare-summary-main {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .plan-compare-summary-icon {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          background: rgba(255, 255, 255, 0.03);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex: 0 0 auto;
        }

        .plan-compare-summary-icon::before,
        .plan-compare-summary-icon::after {
          content: '';
          position: absolute;
          background: rgba(233, 248, 241, 0.95);
          border-radius: 999px;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .plan-compare-summary-icon::before {
          width: 8px;
          height: 1.6px;
        }

        .plan-compare-summary-icon::after {
          width: 1.6px;
          height: 8px;
        }

        .plan-compare-summary-meta {
          font-size: 11px;
          font-weight: 600;
          color: #9db8b3;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .plan-compare-details[open] summary {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(90deg, rgba(35, 198, 111, 0.12), rgba(13, 31, 33, 0.3));
        }

        .plan-compare-details[open] .plan-compare-summary-icon::after {
          opacity: 0;
          transform: scaleY(0.3);
        }

        .comparison-table-wrap {
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(3, 11, 13, 0.54);
          margin: 12px;
        }

        .comparison-table {
          width: 100%;
          min-width: 660px;
          border-collapse: collapse;
        }

        .comparison-table th,
        .comparison-table td {
          padding: 11px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          text-align: left;
          vertical-align: top;
          font-size: 12px;
          line-height: 1.45;
        }

        .comparison-table thead th {
          color: #d7ecec;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.02);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .comparison-table tbody tr:last-child td {
          border-bottom: none;
        }

        .comparison-table th:first-child,
        .comparison-table td:first-child {
          width: 34%;
          color: #eef8f8;
          font-weight: 600;
        }

        .comparison-table td:not(:first-child) {
          color: #bfd6d6;
        }

        .faq-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .faq-item {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.01));
          padding: 12px;
        }

        .faq-item h3 {
          margin: 0 0 6px;
          font-size: 14px;
        }

        .faq-item p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .sales-footer {
          margin-top: 18px;
          border-radius: 18px;
          border: 1px solid rgba(12, 31, 35, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.72));
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
          color: #11262b;
          overflow: hidden;
        }

        .sales-footer-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr 0.9fr;
          gap: 12px;
          padding: 14px;
        }

        .sales-footer-card {
          border-radius: 14px;
          border: 1px solid rgba(12, 31, 35, 0.06);
          background: rgba(255, 255, 255, 0.62);
          padding: 12px;
        }

        .sales-footer-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #0f2428;
          text-decoration: none;
          font-weight: 800;
          font-size: 15px;
          margin-bottom: 8px;
        }

        .sales-footer-brand img {
          width: 28px;
          height: 28px;
          display: block;
        }

        .sales-footer-copy {
          margin: 0;
          color: #4b676d;
          font-size: 12px;
          line-height: 1.55;
        }

        .sales-footer-title {
          margin: 0 0 8px;
          color: #0f2529;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .sales-footer-links {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .sales-footer-links a,
        .sales-footer-links button {
          width: fit-content;
          max-width: 100%;
          border: none;
          background: transparent;
          padding: 0;
          text-decoration: none;
          color: #315b63;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
        }

        .sales-footer-links a:hover,
        .sales-footer-links button:hover {
          color: #11714a;
          text-decoration: underline;
        }

        .sales-footer-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .sales-footer-tag {
          border-radius: 999px;
          border: 1px solid rgba(12, 31, 35, 0.08);
          background: rgba(255, 255, 255, 0.74);
          color: #2f545b;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 8px;
          line-height: 1;
        }

        .sales-footer-bottom {
          border-top: 1px solid rgba(12, 31, 35, 0.06);
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          color: #5a7379;
          font-size: 11px;
        }

        .sales-footer-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sales-footer-cta .sales-btn {
          min-height: 38px;
          padding: 8px 12px;
          font-size: 12px;
          border-radius: 10px;
        }

        /* Final override: Operacao com cards internos escurecidos em ~50% */
        .highlight-model-shell.is-integracao {
          --operation-surface: linear-gradient(145deg, #6f7a6b, #677266);
          --operation-surface-soft: linear-gradient(145deg, #778274, #6f7a70);
          --operation-copy-surface: linear-gradient(145deg, #7b8777, #727e6f);
          --operation-border: rgba(205, 225, 214, 0.24);
          --operation-text-1: #f3fbf7;
          --operation-text-2: #d2e0d7;
          --operation-text-3: #c2d4ca;
          background:
            radial-gradient(560px 250px at 8% 0%, rgba(214, 242, 224, 0.07), rgba(214, 242, 224, 0) 74%),
            radial-gradient(540px 240px at 88% 0%, rgba(147, 200, 169, 0.08), rgba(147, 200, 169, 0) 74%),
            linear-gradient(145deg, #3d8460, #356f52);
        }

        .highlight-model-shell.is-integracao .highlight-integration-copy {
          background:
            radial-gradient(420px 220px at 10% 0%, rgba(166, 223, 165, 0.12), rgba(166, 223, 165, 0) 72%),
            var(--operation-copy-surface);
          border-color: var(--operation-border);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-integration-track {
          background:
            radial-gradient(420px 220px at 10% 0%, rgba(166, 223, 165, 0.1), rgba(166, 223, 165, 0) 72%),
            var(--operation-copy-surface);
          border-color: var(--operation-border);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-integration-title {
          color: var(--operation-text-1);
        }

        .highlight-model-shell.is-integracao .highlight-integration-subtitle {
          color: var(--operation-text-2);
        }

        .highlight-model-shell.is-integracao .highlight-operation-sidebar,
        .highlight-model-shell.is-integracao .highlight-operation-main {
          background: var(--operation-copy-surface);
          border-color: var(--operation-border);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-operation-kpi,
        .highlight-model-shell.is-integracao .highlight-operation-module,
        .highlight-model-shell.is-integracao .highlight-operation-list li,
        .highlight-model-shell.is-integracao .highlight-operation-nav-item {
          background: var(--operation-copy-surface);
          border-color: var(--operation-border);
          box-shadow: none;
        }

        .highlight-model-shell.is-integracao .highlight-operation-nav-item {
          color: var(--operation-text-1);
        }

        .highlight-model-shell.is-integracao .highlight-operation-nav-item.is-active {
          color: #f6fff9;
          border-color: rgba(166, 223, 165, 0.44);
          background: linear-gradient(120deg, rgba(115, 180, 112, 0.48), rgba(86, 146, 88, 0.34));
        }

        .highlight-model-shell.is-integracao .highlight-operation-main-head h4,
        .highlight-model-shell.is-integracao .highlight-operation-module h5,
        .highlight-model-shell.is-integracao .highlight-operation-kpi strong,
        .highlight-model-shell.is-integracao .highlight-operation-list li strong {
          color: var(--operation-text-1);
        }

        .highlight-model-shell.is-integracao .highlight-operation-main-head p,
        .highlight-model-shell.is-integracao .highlight-operation-kpi span,
        .highlight-model-shell.is-integracao .highlight-operation-list li {
          color: var(--operation-text-2);
        }

        .highlight-model-shell.is-integracao .highlight-operation-sidebar-head,
        .highlight-model-shell.is-integracao .highlight-operation-module-tag,
        .highlight-model-shell.is-integracao .highlight-operation-stage-list span,
        .highlight-model-shell.is-integracao .highlight-operation-stage-list i {
          color: var(--operation-text-3);
        }

        .highlight-model-shell.is-integracao .highlight-operation-status span,
        .highlight-model-shell.is-integracao .highlight-operation-pill {
          background: rgba(116, 180, 112, 0.26);
          border-color: rgba(166, 223, 165, 0.4);
          color: #e6f4e9;
        }

        .highlight-model-shell.is-integracao .highlight-operation-stage-bar {
          background: rgba(226, 242, 230, 0.2);
        }

        /* Final override: Dashboard com paleta da landing */
        .highlight-model-shell.is-dashboard {
          --dashboard-base: linear-gradient(90deg, #001319 0%, #001a21 52%, #00141a 100%);
          --dashboard-surface: linear-gradient(160deg, rgba(5, 13, 10, 0.96), rgba(4, 11, 9, 0.95) 58%, rgba(2, 6, 5, 0.98));
          --dashboard-panel-surface: linear-gradient(155deg, rgba(9, 22, 17, 0.92), rgba(7, 17, 13, 0.9));
          --dashboard-card-surface: linear-gradient(155deg, rgba(19, 42, 33, 0.93), rgba(16, 35, 28, 0.9));
          --dashboard-sidebar-surface: linear-gradient(155deg, rgba(21, 46, 36, 0.95), rgba(17, 38, 30, 0.93));
          background:
            radial-gradient(620px 280px at 14% 0%, rgba(35, 198, 111, 0.09), rgba(35, 198, 111, 0) 74%),
            radial-gradient(520px 240px at 90% 4%, rgba(21, 163, 74, 0.07), rgba(21, 163, 74, 0) 74%),
            var(--dashboard-base);
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy,
        .highlight-model-shell.is-dashboard .highlight-model-preview,
        .highlight-model-shell.is-dashboard .hero-real-mock {
          border: none;
          box-shadow: none;
          background:
            radial-gradient(440px 220px at 12% 0%, rgba(35, 198, 111, 0.14), rgba(35, 198, 111, 0) 72%),
            radial-gradient(360px 180px at 96% 8%, rgba(21, 163, 74, 0.12), rgba(21, 163, 74, 0) 74%),
            var(--dashboard-surface);
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy {
          background:
            radial-gradient(420px 220px at 10% 0%, rgba(35, 198, 111, 0.12), rgba(35, 198, 111, 0) 72%),
            linear-gradient(145deg, #123c2f, #0f2e23);
        }

        .highlight-model-shell.is-dashboard .hero-real-main {
          background: var(--dashboard-panel-surface);
          border-color: rgba(35, 198, 111, 0.22);
        }

        .highlight-model-shell.is-dashboard .hero-real-sidebar {
          background: var(--dashboard-sidebar-surface);
          border-color: rgba(35, 198, 111, 0.3);
        }

        .highlight-model-shell.is-dashboard .hero-real-card,
        .highlight-model-shell.is-dashboard .hero-real-metric-card,
        .highlight-model-shell.is-dashboard .hero-real-funnel-stage,
        .highlight-model-shell.is-dashboard .hero-real-nav-item,
        .highlight-model-shell.is-dashboard .hero-real-field,
        .highlight-model-shell.is-dashboard .hero-real-chip,
        .highlight-model-shell.is-dashboard .hero-real-toggle {
          background: var(--dashboard-card-surface);
          border-color: rgba(35, 198, 111, 0.26);
        }

        .highlight-model-shell.is-dashboard .hero-real-nav-item.is-active,
        .highlight-model-shell.is-dashboard .hero-real-toggle.is-active {
          background: linear-gradient(120deg, rgba(35, 198, 111, 0.28), rgba(21, 163, 74, 0.22));
          border-color: rgba(35, 198, 111, 0.44);
        }

        @media (min-width: 981px) {
          .highlight-model-shell.is-dashboard,
          .highlight-model-shell.is-chatinterno,
          .highlight-model-shell.is-integracao,
          .highlight-model-shell.is-meta {
            --hl-main-card-height: 726px;
          }
        }

        /* Final override: Dashboard + Recursos com a mesma geometria */
        .highlight-model-shell.is-dashboard,
        .highlight-model-shell.is-chatinterno {
          grid-template-columns: 252px minmax(280px, 420px) minmax(360px, 1fr);
          gap: clamp(1.5rem, 2.1vw, 2rem);
          padding: clamp(1.5rem, 2.2vw, 2rem);
          border-radius: 24px;
          align-items: stretch;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav,
        .highlight-model-shell.is-dashboard .highlight-model-copy,
        .highlight-model-shell.is-dashboard .highlight-model-preview,
        .highlight-model-shell.is-chatinterno .highlight-model-nav,
        .highlight-model-shell.is-chatinterno .highlight-model-copy,
        .highlight-model-shell.is-chatinterno .highlight-model-preview {
          min-height: var(--hl-main-card-height);
          height: 100%;
          border-radius: 24px;
          align-self: stretch;
        }

        .highlight-model-shell.is-dashboard .highlight-model-nav,
        .highlight-model-shell.is-dashboard .highlight-model-preview,
        .highlight-model-shell.is-chatinterno .highlight-model-nav,
        .highlight-model-shell.is-chatinterno .highlight-model-preview {
          padding: clamp(0.8rem, 1.2vw, 1rem);
        }

        .highlight-model-shell.is-dashboard .highlight-model-copy,
        .highlight-model-shell.is-chatinterno .highlight-model-copy {
          padding: clamp(1.6rem, 2.1vw, 2rem);
        }

        .highlight-model-shell.is-dashboard .highlight-model-preview > .platform-mock,
        .highlight-model-shell.is-dashboard .highlight-model-preview > .platform-mock .platform-mock__frame,
        .highlight-model-shell.is-dashboard .highlight-model-preview > .hero-screen,
        .highlight-model-shell.is-chatinterno .highlight-model-preview > .platform-mock,
        .highlight-model-shell.is-chatinterno .highlight-model-preview > .platform-mock .platform-mock__frame {
          height: 100%;
        }

        /* Estrategia: fundo do card principal com paleta da Operacao e cards internos brancos */
        .highlight-model-shell.is-meta .highlight-strategy-left {
          background: linear-gradient(145deg, #dff4d7, #d4edcc);
          border-color: rgba(56, 101, 56, 0.22);
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-title {
          color: #16331a;
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pill {
          border-color: rgba(56, 101, 56, 0.34);
          background: rgba(255, 255, 255, 0.9);
          color: #305b2e;
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pillar:nth-child(1) {
          background: #ffffff;
          border-color: rgba(56, 101, 56, 0.22);
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pillar:nth-child(2) {
          background: #ffffff;
          border-color: rgba(56, 101, 56, 0.2);
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pillar:nth-child(3) {
          background: #ffffff;
          border-color: rgba(56, 101, 56, 0.18);
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pillar h4 {
          color: #19371d;
        }

        .highlight-model-shell.is-meta .highlight-strategy-left .highlight-strategy-pillar p {
          color: #3a593f;
        }

        .highlight-model-resource-card .highlight-model-resource-grid,
        .highlight-model-resource-card .cardsContainer {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: stretch;
          grid-auto-rows: 1fr;
        }

        .highlight-model-resource-card .highlight-model-resource-item,
        .highlight-model-resource-card .card.highlight-model-resource-item {
          min-height: clamp(170px, 13vw, 210px);
          height: 100%;
          padding: 2rem;
          border-radius: 20px;
          box-sizing: border-box;
          align-self: stretch;
        }

        /* Secondary cards inherit the active tab palette (same family, softened variants) */
        .highlight-model-resource-card .highlight-model-resource-item {
          box-shadow: none;
          border: none;
        }

        .highlight-model-resource-card.is-dashboard .highlight-model-resource-item:nth-child(1) {
          --card-bg-a: #123c2f;
          --card-bg-b: #0f2e23;
          --card-kicker: #bfdccc;
          --card-title: #f3fbf7;
          --card-text: #cde4d8;
        }

        .highlight-model-resource-card.is-dashboard .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: #174535;
          --card-bg-b: #12392d;
          --card-kicker: #c7e3d4;
          --card-title: #f4fcf8;
          --card-text: #d2e8dd;
        }

        .highlight-model-resource-card.is-dashboard .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: #1b4d3a;
          --card-bg-b: #164133;
          --card-kicker: #cfe8db;
          --card-title: #f5fcf9;
          --card-text: #d8ebe1;
        }

        .highlight-model-resource-card.is-dashboard .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #205540;
          --card-bg-b: #194736;
          --card-kicker: #d6ecdf;
          --card-title: #f7fdfa;
          --card-text: #deefe6;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(1) {
          --card-bg-a: #d9e8df;
          --card-bg-b: #cfdfd5;
          --card-kicker: #35594b;
          --card-title: #173227;
          --card-text: #35564a;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: #deede4;
          --card-bg-b: #d4e5da;
          --card-kicker: #365b4d;
          --card-title: #183327;
          --card-text: #37594c;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: #e4f1e9;
          --card-bg-b: #daeade;
          --card-kicker: #385e4f;
          --card-title: #193428;
          --card-text: #395b4d;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #ebf6ef;
          --card-bg-b: #e1f0e6;
          --card-kicker: #3a6151;
          --card-title: #1a3529;
          --card-text: #3a5d4f;
        }

        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item,
        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(1),
        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(2),
        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(3),
        .highlight-model-resource-card.is-chatinterno .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #245742;
          --card-bg-b: #1e4b39;
          --card-kicker: #c0dfd1;
          --card-title: #f1fbf6;
          --card-text: #d0e6dc;
        }

        .highlight-model-resource-card.is-integracao .highlight-model-resource-item:nth-child(1) {
          --card-bg-a: #6f7a6b;
          --card-bg-b: #6a7666;
          --card-kicker: #d4e6d2;
          --card-title: #f0f8ef;
          --card-text: #cdddc9;
        }

        .highlight-model-resource-card.is-integracao .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: #727c6f;
          --card-bg-b: #6d7969;
          --card-kicker: #d8e8d5;
          --card-title: #f3faf1;
          --card-text: #d2e0ce;
        }

        .highlight-model-resource-card.is-integracao .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: #767d72;
          --card-bg-b: #707a6d;
          --card-kicker: #dbe9d8;
          --card-title: #f5fbf3;
          --card-text: #d5e2d1;
        }

        .highlight-model-resource-card.is-integracao .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #797e78;
          --card-bg-b: #747c71;
          --card-kicker: #deebdb;
          --card-title: #f7fcf5;
          --card-text: #d8e4d3;
        }

        .highlight-model-resource-card.is-meta .highlight-model-resource-item:nth-child(1) {
          --card-bg-a: #dff4d7;
          --card-bg-b: #d4edcc;
          --card-kicker: #305b2e;
          --card-title: #16331a;
          --card-text: #36523b;
        }

        .highlight-model-resource-card.is-meta .highlight-model-resource-item:nth-child(2) {
          --card-bg-a: #e5f8de;
          --card-bg-b: #daf1d3;
          --card-kicker: #325d30;
          --card-title: #17341c;
          --card-text: #37553d;
        }

        .highlight-model-resource-card.is-meta .highlight-model-resource-item:nth-child(3) {
          --card-bg-a: #ecfae5;
          --card-bg-b: #e1f5da;
          --card-kicker: #356133;
          --card-title: #19371d;
          --card-text: #3a593f;
        }

        .highlight-model-resource-card.is-meta .highlight-model-resource-item:nth-child(4) {
          --card-bg-a: #f3fdf0;
          --card-bg-b: #e8f8e3;
          --card-kicker: #386538;
          --card-title: #1b3a20;
          --card-text: #3d5d43;
        }

        /* Secondary cards below the 4-tone row inherit a softened matching identity */
        .plans-grid .pricing-card,
        .plan-unified-compare {
          --tone-bg-a: rgba(18, 60, 47, 0.9);
          --tone-bg-b: rgba(15, 46, 35, 0.92);
          --tone-border: rgba(178, 214, 195, 0.18);
          --tone-title: #eef9f4;
          --tone-muted: #c8dfd4;
          --tone-text: #d9eaea;
          --tone-strong: #f1fbf8;
          --tone-surface: rgba(255, 255, 255, 0.06);
          --tone-button-bg: rgba(35, 198, 111, 0.14);
          --tone-button-border: rgba(35, 198, 111, 0.32);
          --tone-button-text: #d7ffe9;
        }

        .plans-grid .pricing-card:nth-child(1) {
          --tone-bg-a: rgba(18, 60, 47, 0.92);
          --tone-bg-b: rgba(15, 46, 35, 0.94);
          --tone-border: rgba(178, 214, 195, 0.18);
        }

        .plans-grid .pricing-card:nth-child(2) {
          --tone-bg-a: rgba(45, 109, 82, 0.88);
          --tone-bg-b: rgba(37, 94, 71, 0.92);
          --tone-border: rgba(197, 227, 212, 0.2);
          --tone-title: #f2fbf7;
          --tone-muted: #d7ece1;
          --tone-text: #e1f0e9;
          --tone-strong: #f8fdfb;
          --tone-surface: rgba(255, 255, 255, 0.1);
          --tone-button-bg: rgba(35, 198, 111, 0.2);
          --tone-button-border: rgba(35, 198, 111, 0.38);
          --tone-button-text: #f3fff9;
        }

        .plans-grid .pricing-card:nth-child(3) {
          --tone-bg-a: rgba(227, 239, 232, 0.96);
          --tone-bg-b: rgba(215, 231, 221, 0.94);
          --tone-border: rgba(43, 84, 66, 0.16);
          --tone-title: #173327;
          --tone-muted: #35584b;
          --tone-text: #385c4f;
          --tone-strong: #173327;
          --tone-surface: rgba(255, 255, 255, 0.58);
          --tone-button-bg: rgba(35, 94, 71, 0.12);
          --tone-button-border: rgba(35, 94, 71, 0.24);
          --tone-button-text: #173327;
        }

        .plan-unified-compare {
          --tone-bg-a: rgba(17, 51, 40, 0.92);
          --tone-bg-b: rgba(12, 39, 30, 0.94);
          --tone-border: rgba(178, 214, 195, 0.2);
          --tone-title: #eafaf1;
          --tone-muted: #bad7c8;
          --tone-text: #d3e8dc;
          --tone-strong: #f4fff8;
          --tone-surface: rgba(20, 61, 48, 0.58);
        }

        .plans-grid .pricing-card {
          border-color: var(--tone-border);
          box-shadow: none;
          background:
            radial-gradient(280px 150px at 100% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0)),
            linear-gradient(160deg, var(--tone-bg-a), var(--tone-bg-b));
        }

        .plans-grid .pricing-card.is-featured {
          box-shadow: none;
        }

        .plans-grid .pricing-name,
        .plans-grid .pricing-price {
          color: var(--tone-title);
        }

        .plans-grid .pricing-subtitle,
        .plans-grid .pricing-billing,
        .plans-grid .pricing-period {
          color: var(--tone-muted);
        }

        .plans-grid .pricing-meta-item {
          border-color: var(--tone-border);
          background: var(--tone-surface);
          color: var(--tone-text);
        }

        .plans-grid .pricing-meta-item strong {
          color: var(--tone-strong);
        }

        .plans-grid .pricing-button {
          border-color: var(--tone-button-border);
          background: var(--tone-button-bg);
          color: var(--tone-button-text);
        }

        .plans-grid .pricing-button:hover {
          box-shadow: none;
          transform: translateY(-2px);
        }

        .plan-unified-compare {
          border-color: var(--tone-border);
          box-shadow: none;
          background:
            radial-gradient(460px 180px at 8% 0%, rgba(35, 198, 111, 0.07), rgba(35, 198, 111, 0)),
            linear-gradient(170deg, var(--tone-bg-a), var(--tone-bg-b));
        }

        .plan-compare-details summary {
          color: var(--tone-title);
          background: linear-gradient(90deg, rgba(35, 198, 111, 0.16), rgba(12, 39, 30, 0.58));
        }

        .plan-compare-details summary:hover {
          background: linear-gradient(90deg, rgba(35, 198, 111, 0.24), rgba(12, 39, 30, 0.7));
        }

        .plan-compare-summary-meta {
          color: var(--tone-muted);
        }

        .plan-compare-summary-icon {
          border-color: rgba(126, 243, 177, 0.36);
          background: rgba(18, 57, 45, 0.58);
        }

        .plan-compare-summary-icon::before,
        .plan-compare-summary-icon::after {
          background: rgba(233, 248, 241, 0.96);
        }

        .comparison-table-wrap {
          border-color: var(--tone-border);
          background: linear-gradient(165deg, rgba(16, 48, 38, 0.82), rgba(10, 32, 25, 0.86));
        }

        .comparison-table thead th {
          color: var(--tone-title);
          background: rgba(23, 66, 52, 0.72);
        }

        .comparison-table th:first-child,
        .comparison-table td:first-child {
          color: var(--tone-title);
        }

        .comparison-table td:not(:first-child) {
          color: var(--tone-text);
        }

        @keyframes page-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sales-shell { animation: none; }
          .sales-btn { transition: none; }
          .sales-btn:hover { transform: none; }
        }

        @media (max-width: 980px) {
          .sales-page {
            --section-pad: 18px;
          }

          .section-variant-left,
          .section-variant-right,
          .section-variant-frame {
            width: 100%;
          }

          .section-variant-plain {
            padding: var(--section-pad);
          }

          .section-grid {
            grid-template-columns: 1fr;
          }

          .hero-illustration-caption {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .hero-proof-row {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .hero-proof-label {
            white-space: normal;
          }

          .hero-legend {
            justify-content: center;
          }

          .hero-proof-chips {
            justify-content: center;
          }

          .hero-real-mock {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .hero-real-top-grid {
            grid-template-columns: 1fr;
          }

          .hero-real-sidebar {
            order: 2;
          }

          .hero-real-main {
            order: 1;
          }

          .hero-real-funnel-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-real-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .plans-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .highlight-model-shell {
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 14px;
          }

          .highlight-model-nav {
            border-right: 1px solid rgba(255, 255, 255, 0.74);
            border-bottom: 1px solid rgba(16, 42, 36, 0.12);
            padding: 10px;
          }

          .highlight-model-nav-rail {
            display: none;
          }

          .highlight-model-nav-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .highlight-model-copy {
            padding-top: 0;
            min-height: 0;
          }

          .highlight-model-title {
            max-width: none;
            font-size: 38px;
          }

          .highlight-model-subtitle {
            max-width: none;
            font-size: 29px;
          }

          .highlight-model-copy p {
            max-width: none;
          }

          .highlight-model-preview {
            min-height: 0;
          }

          .highlight-integration-tab {
            grid-column: auto;
            grid-template-columns: 1fr;
          }

          .highlight-integration-copy {
            padding: 14px;
            min-height: 0;
          }

          .highlight-integration-track {
            min-height: 0;
          }

          .highlight-integration-title {
            font-size: 32px;
            max-width: none;
          }

          .highlight-operation-layout {
            grid-template-columns: 1fr;
          }

          .highlight-operation-modules {
            grid-template-columns: 1fr;
          }

          .highlight-strategy-tab {
            grid-column: auto;
            grid-template-columns: 1fr;
          }

          .highlight-strategy-panel {
            padding: 14px;
            min-height: 0;
          }

          .highlight-strategy-title {
            font-size: 36px;
            max-width: none;
          }

          .highlight-strategy-pillar-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .highlight-preview-main {
            grid-template-columns: 1fr;
          }

          .highlight-model-resource-card {
            grid-column: auto;
          }

          .highlight-model-resource-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .highlight-model-resource-card .card,
          .highlight-model-resource-item {
            min-height: 160px;
            padding: 1.25rem;
          }

          .highlight-model-resource-item.is-wide {
            grid-column: auto;
          }

          .pillar-grid,
          .journey-grid {
            grid-template-columns: 1fr;
          }

          .resource-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .resources-section.section-variant-plain .resource-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .resources-section.section-variant-plain .resource-card:nth-child(1),
          .resources-section.section-variant-plain .resource-card:nth-child(4) {
            grid-column: auto;
            min-height: 150px;
          }

          .sales-footer-grid {
            grid-template-columns: 1fr;
          }

          .faq-grid {
            grid-template-columns: 1fr;
          }

          .journey-layout {
            grid-template-columns: 1fr;
          }

          .journey-copy-pane {
            padding: 12px;
          }

          .journey-track {
            padding: 10px;
          }

          .journey-track::before {
            left: 22px;
            top: 18px;
            bottom: 18px;
          }

          .journey-grid.journey-grid-timeline .journey-card {
            min-height: 0;
            padding-left: 38px;
          }

          .journey-grid.journey-grid-timeline .journey-card::before {
            left: 12px;
            top: 18px;
          }
        }

        @media (max-width: 700px) {
          .sales-page {
            --section-pad: 14px;
          }

          .sales-shell {
            width: calc(100% - 20px);
            padding: 10px 10px 18px;
            border-radius: 18px;
          }

          .sales-nav {
            padding: 10px;
            border-radius: 14px;
            margin-bottom: 14px;
          }

          .sales-nav-sticky {
            margin-bottom: 14px;
          }

          .sales-brand img {
            width: 108px;
          }

          .sales-nav-links {
            width: 100%;
            justify-content: space-between;
            padding: 4px;
            border-radius: 14px;
          }

          .sales-nav-link {
            flex: 1 1 0;
            min-width: 0;
            text-align: center;
            padding: 8px 6px;
            font-size: 12px;
            border-radius: 10px;
          }

          .sales-nav-actions {
            width: 100%;
            justify-content: stretch;
          }

          .sales-nav-actions .sales-btn {
            flex: 1 1 0;
            text-align: center;
          }

          .hero-copy,
          .hero-card,
          .feature-highlight-section,
          .solution-section,
          .resources-section,
          .journey-section,
          .plans-section {
            border-radius: 16px;
          }

          .hero-copy {
            padding: 18px;
            border-radius: 18px;
          }

          .hero-visual {
            margin-top: 28px;
            padding: 10px;
            border-radius: 16px;
          }

          .hero-screen {
            padding: 10px;
          }

          .hero-screen-tabs {
            display: none;
          }

          .hero-illustration-caption {
            padding: 9px;
          }

          .hero-real-sidebar,
          .hero-real-main,
          .hero-real-events {
            padding: 8px;
          }

          .hero-real-top-grid,
          .hero-real-funnel-grid {
            grid-template-columns: 1fr;
          }

          .hero-real-funnel-stage::before {
            display: none;
          }

          .hero-real-metrics {
            grid-template-columns: 1fr;
          }

          .hero-proof-row {
            padding: 9px;
            border-radius: 12px;
          }

          .pillar-grid,
          .resource-grid,
          .journey-grid {
            grid-template-columns: 1fr;
          }

          .highlight-model-shell {
            padding: 12px;
          }

          .highlight-model-nav-list {
            grid-template-columns: 1fr;
          }

          .highlight-model-nav-rail {
            display: none;
          }

          .highlight-model-title {
            font-size: 32px;
          }

          .highlight-model-subtitle {
            font-size: 25px;
          }

          .highlight-model-copy p {
            font-size: 14px;
          }

          .highlight-model-preview {
            padding: 10px;
          }

          .highlight-integration-title {
            font-size: 27px;
          }

          .highlight-integration-subtitle {
            font-size: 13px;
          }

          .highlight-integration-track {
            padding: 10px;
            min-height: 0;
          }

          .highlight-operation-top {
            align-items: flex-start;
          }

          .highlight-operation-status {
            width: 100%;
          }

          .highlight-operation-kpis {
            grid-template-columns: 1fr;
          }

          .highlight-operation-sidebar,
          .highlight-operation-main {
            padding: 9px;
          }

          .highlight-strategy-tab {
            padding: 10px;
          }

          .highlight-strategy-panel {
            padding: 12px;
          }

          .highlight-strategy-title {
            font-size: 29px;
          }

          .highlight-strategy-subtitle,
          .highlight-strategy-intro,
          .highlight-strategy-pillar p,
          .highlight-strategy-list li {
            font-size: 14px;
          }

          .highlight-strategy-pillar h4 {
            font-size: 18px;
          }

          .highlight-strategy-pillar-grid {
            grid-template-columns: 1fr;
          }

          .highlight-preview-top {
            grid-template-columns: 1fr;
          }

          .highlight-preview-stats {
            grid-template-columns: 1fr;
          }

          .highlight-model-resource-grid {
            grid-template-columns: 1fr;
          }

          .highlight-model-resource-card .card,
          .highlight-model-resource-item {
            min-height: 0;
            padding: 1.1rem;
          }

          .section-anchor {
            top: -84px;
          }

          .resources-section.section-variant-plain .resource-grid {
            grid-template-columns: 1fr;
          }

          .resources-section.section-variant-plain::after {
            inset: 0;
            border-radius: 16px;
          }

          .hero-title {
            max-width: none;
          }

          .hero-benefit-list {
            max-width: none;
          }

          .hero-screen-top {
            justify-content: center;
          }

          .hero-floating-tag {
            display: none;
          }

          .section-head {
            margin-bottom: 12px;
          }

          .plans-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .pricing-card {
            padding: 16px;
            border-radius: 16px;
            gap: 10px;
          }

          .pricing-popular-badge {
            top: -10px;
            font-size: 10px;
            padding: 4px 10px;
          }

          .pricing-price {
            font-size: 34px;
          }

          .section-panel {
            padding: 12px;
          }

          .plan-unified-compare {
            padding: 0;
            border-radius: 14px;
          }

          .plan-compare-details summary {
            padding: 12px 13px;
            font-size: 13px;
          }

          .plan-compare-summary-meta {
            display: none;
          }

          .comparison-table-wrap {
            margin: 10px;
          }

          .sales-footer {
            margin-top: 14px;
            border-radius: 14px;
          }

          .sales-footer-grid {
            padding: 12px;
          }

          .sales-footer-card {
            border-radius: 12px;
            padding: 10px;
          }

          .sales-footer-bottom {
            padding: 10px 12px;
          }
        }
      `}</style>

      <div className="sales-shell">
        <div className="sales-nav-sticky">
          <header className="sales-nav" aria-label="Navegação da página de planos">
            <Link to="/planos" className="sales-brand" aria-label={`${brandName} planos`}>
              <img src={brandFullLogoUrl} alt={brandName} />
            </Link>

            <div className="sales-nav-links" aria-label="Atalhos de seção">
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('solucao')}>
                Solução
              </button>
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('recursos')}>
                Recursos
              </button>
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('planos-lista')}>
                Planos
              </button>
            </div>

            <div className="sales-nav-actions">
              <Link to="/login" className="sales-btn sales-btn-outline">Entrar</Link>
              <Link to="/login" className="sales-btn sales-btn-primary">Assinar agora</Link>
            </div>
          </header>
        </div>

        <main>
          <section className="sales-hero" id="visao-geral" aria-labelledby="planos-hero-title">
            <div className="hero-copy">
              <h1 className="hero-title" id="planos-hero-title">
                Transforme o WhatsApp em uma <strong>operação comercial organizada</strong> com o
                <span className="hero-brand-name">ZapVender</span>
              </h1>

              <ul className="hero-benefit-list" aria-label="Benefícios principais">
                <li>Atendimento com contexto</li>
                <li>CRM + funil comercial</li>
                <li>Automações e campanhas</li>
                <li>Operação multi-sessão</li>
              </ul>

              <div className="hero-cta-row">
                <Link to="/login" className="sales-btn sales-btn-primary">Quero conhecer o ZapVender</Link>
                <button
                  type="button"
                  className="sales-btn sales-btn-outline"
                  onClick={() => scrollToSection('recursos')}
                >
                  Ver recursos
                </button>
              </div>

              <div className="hero-visual" aria-label="Visual da plataforma ZapVender">
                <div className="hero-screen">
                  <div className="hero-screen-top">
                    <div className="hero-screen-brand">
                      <img src={brandLogoUrl} alt="" aria-hidden="true" />
                      <span>ZapVender Workspace</span>
                    </div>
                  </div>

                  <div className="hero-illustration-wrap">
                    <div className="hero-illustration hero-real-mock" role="img" aria-label="Mock do painel real ZapVender com dashboard, eventos e funil">
                      <aside className="hero-real-sidebar">
                        <div className="hero-real-sidebar-main">
                          <div className="hero-real-sidebar-groups">
                            <div className="hero-real-sidebar-group">
                              <div className="hero-real-nav-item is-active">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-dashboard hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Painel de Controle</span>
                              </div>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-contacts hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Contatos</span>
                              </div>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-campaigns hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Campanhas</span>
                              </div>
                            </div>

                            <div className="hero-real-sidebar-group">
                              <span className="hero-real-sidebar-label">Conversas</span>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-inbox hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Inbox</span>
                              </div>
                            </div>

                            <div className="hero-real-sidebar-group">
                              <span className="hero-real-sidebar-label">Automação</span>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-flows hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Fluxos de Conversa</span>
                              </div>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-funnel hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Funil de Vendas</span>
                              </div>
                            </div>

                            <div className="hero-real-sidebar-group">
                              <span className="hero-real-sidebar-label">Sistema</span>
                              <div className="hero-real-nav-item">
                                <span className="hero-real-nav-icon-box">
                                  <span className="icon icon-settings hero-real-nav-icon" />
                                </span>
                                <span className="hero-real-nav-text">Configurações</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="hero-real-sidebar-footer">
                          <div className="hero-real-exit">Sair</div>
                        </div>
                      </aside>

                      <section className="hero-real-main">
                        <header className="hero-real-header">
                          <h3>Painel de Controle</h3>
                          <p>Bem-vindo, teste5@gmail.com | quinta-feira, 26 de fevereiro</p>
                        </header>

                        <div className="hero-real-top-grid">
                          <article className="hero-real-card">
                            <h4 className="hero-real-card-title">Estatísticas por período</h4>
                            <div className="hero-real-period-form">
                              <div className="hero-real-field">19/02/2026</div>
                              <div className="hero-real-field">26/02/2026</div>
                            </div>

                            <div className="hero-real-chart-meta">
                              <span className="hero-real-chip">Novos contatos</span>
                              <div className="hero-real-toggle-group">
                                <span className="hero-real-toggle is-active">L</span>
                                <span className="hero-real-toggle">B</span>
                              </div>
                            </div>

                            <div className="hero-real-chart">
                              <svg className="hero-real-chart-svg" viewBox="0 0 320 120" aria-hidden="true">
                                <defs>
                                  <linearGradient id="heroRealChartFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(67, 219, 140, 0.34)" />
                                    <stop offset="100%" stopColor="rgba(67, 219, 140, 0.04)" />
                                  </linearGradient>
                                </defs>
                                <path
                                  d="M 12 102 L 42 102 L 72 102 L 102 102 L 132 102 L 162 18 L 192 102 L 222 102 L 252 102 L 282 102 L 308 102 L 308 108 L 12 108 Z"
                                  fill="url(#heroRealChartFill)"
                                />
                                <path
                                  d="M 12 102 L 42 102 L 72 102 L 102 102 L 132 102 L 162 18 L 192 102 L 222 102 L 252 102 L 282 102 L 308 102"
                                  fill="none"
                                  stroke="rgba(67, 219, 140, 0.9)"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle cx="162" cy="18" r="4.5" fill="rgba(67, 219, 140, 1)" />
                              </svg>
                              <div className="hero-real-chart-axis">
                                <span>19/02</span>
                                <span>20/02</span>
                                <span>21/02</span>
                                <span>22/02</span>
                                <span>23/02</span>
                                <span>24/02</span>
                                <span>26/02</span>
                              </div>
                            </div>
                          </article>

                          <article className="hero-real-card">
                            <h4 className="hero-real-card-title">Estatísticas gerais</h4>
                            <ul className="hero-real-general-list">
                              <li><span>Contatos que interagiram</span><strong>9.603</strong></li>
                              <li><span>Mensagem enviada pelo contato</span><strong>19.206</strong></li>
                              <li><span>Interações/inscrito</span><strong>2.0</strong></li>
                            </ul>
                          </article>
                        </div>

                        <article className="hero-real-card hero-real-events">
                          <div className="hero-real-events-head">
                            <h4 className="hero-real-card-title">Eventos personalizados</h4>
                            <div className="hero-real-events-actions">
                              <span className="hero-real-chip">Este mês</span>
                              <span className="hero-real-chip is-current">Criar</span>
                            </div>
                          </div>
                          <div className="hero-real-event-empty">
                            <strong>Nenhum evento personalizado ainda</strong>
                            <span>Crie eventos e use o bloco Registrar Evento nos seus fluxos.</span>
                          </div>
                        </article>

                        <div className="hero-real-metrics">
                          <article className="hero-real-metric-card">
                            <div className="hero-real-metric-top">
                              <span className="hero-real-metric-icon is-green" />
                              <span className="hero-real-metric-delta is-positive">+0%</span>
                            </div>
                            <strong>9.603</strong>
                            <span>Total de Leads</span>
                          </article>
                          <article className="hero-real-metric-card">
                            <div className="hero-real-metric-top">
                              <span className="hero-real-metric-icon is-green" />
                              <span className="hero-real-metric-delta is-positive">+0%</span>
                            </div>
                            <strong>0</strong>
                            <span>Concluídos</span>
                          </article>
                          <article className="hero-real-metric-card">
                            <div className="hero-real-metric-top">
                              <span className="hero-real-metric-icon is-amber" />
                              <span className="hero-real-metric-delta is-negative">-0%</span>
                            </div>
                            <strong>9.603</strong>
                            <span>Em andamento</span>
                          </article>
                          <article className="hero-real-metric-card">
                            <div className="hero-real-metric-top">
                              <span className="hero-real-metric-icon is-cyan" />
                              <span className="hero-real-metric-delta is-positive">+0%</span>
                            </div>
                            <strong>0.0%</strong>
                            <span>Conversão</span>
                          </article>
                        </div>

                        <article className="hero-real-card hero-real-funnel">
                          <h4 className="hero-real-card-title">Funil de Conversão</h4>
                          <div className="hero-real-funnel-grid">
                            <article className="hero-real-funnel-stage">
                              <strong>9.603</strong>
                              <span>Etapa 1</span>
                              <i>100%</i>
                            </article>
                            <article className="hero-real-funnel-stage">
                              <strong>0</strong>
                              <span>Etapa 2</span>
                              <i>0.0%</i>
                            </article>
                            <article className="hero-real-funnel-stage">
                              <strong>0</strong>
                              <span>Etapa 3</span>
                              <i>0.0%</i>
                            </article>
                            <article className="hero-real-funnel-stage">
                              <strong>0</strong>
                              <span>Concluído</span>
                              <i>0.0%</i>
                            </article>
                          </div>
                        </article>
                      </section>
                    </div>

                  </div>
                </div>
              </div>

              <div className="hero-proof-row" aria-label="Públicos ideais para o ZapVender">
                <div className="hero-proof-label">Ideal para times comerciais no WhatsApp</div>
                <div className="hero-proof-chips" aria-hidden="true">
                  {heroAudienceChips.map((chip) => (
                    <span className="hero-proof-chip" key={chip}>{chip}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section
            ref={highlightSectionRef}
            className="feature-highlight-section section-variant-left"
            id="solucao"
            aria-labelledby="titulo-destaque"
          >
            <span id="recursos" className="section-anchor" aria-hidden="true" />

            <div ref={highlightShellRef} className={highlightShellClassName}>
              <aside className="highlight-model-nav" aria-label="Navegação de benefícios">
                <span className="highlight-model-nav-rail" aria-hidden="true">
                  <span className="highlight-model-nav-rail-thumb" style={{ top: highlightNavThumbTop }} />
                </span>
                <ul className="highlight-model-nav-list">
                  {highlightViews.map((view) => (
                    <li key={view.id}>
                      <button
                        type="button"
                        className={`highlight-model-nav-item ${activeHighlightView.id === view.id ? 'is-active' : ''}`}
                        onClick={() => {
                          changeHighlightToTab(view.id);
                        }}
                        aria-pressed={activeHighlightView.id === view.id}
                      >
                        <span className="highlight-model-nav-icon" aria-hidden="true" />
                        {view.navLabel}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              {activeHighlightView.id === 'integracao' ? (
                <article className="highlight-integration-tab" aria-label="Operação da plataforma">
                  <div className="highlight-integration-copy">
                    <h3 className="highlight-integration-title">Como a operação acontece dentro do ZapVender</h3>
                    <p className="highlight-integration-subtitle">
                      Inbox, CRM, campanhas, automações e funil funcionando no mesmo painel para reduzir atrito da equipe.
                    </p>

                    <div className="hero-cta-row highlight-model-cta" style={{ marginTop: '14px' }}>
                      <button
                        type="button"
                        className="sales-btn sales-btn-outline"
                        onClick={() => scrollToSection('planos-lista')}
                      >
                        Ver planos agora
                      </button>
                      <Link to="/login" className="sales-btn sales-btn-primary">Quero testar</Link>
                    </div>
                  </div>

                  <div className="highlight-integration-track highlight-operation-mock" role="img" aria-label="Ilustração da operação real com Inbox, CRM, campanhas, automações e funil comercial">
                    <div className="highlight-operation-top">
                      <span className="highlight-operation-pill">Operação em tempo real</span>
                      <div className="highlight-operation-status">
                        <span>Online</span>
                        <span>Fila ativa</span>
                        <span>Sincronizado</span>
                      </div>
                    </div>

                    <div className="highlight-operation-layout">
                      <aside className="highlight-operation-sidebar">
                        <span className="highlight-operation-sidebar-head">Módulos ativos</span>
                        <div className="highlight-operation-nav-item is-active">
                          <span className="icon icon-inbox" />
                          Inbox operacional
                        </div>
                        <div className="highlight-operation-nav-item">
                          <span className="icon icon-contacts" />
                          CRM e contatos
                        </div>
                        <div className="highlight-operation-nav-item">
                          <span className="icon icon-campaigns" />
                          Campanhas e fila
                        </div>
                        <div className="highlight-operation-nav-item">
                          <span className="icon icon-flows" />
                          Fluxos de conversa
                        </div>
                        <div className="highlight-operation-nav-item">
                          <span className="icon icon-funnel" />
                          Funil de vendas
                        </div>
                      </aside>

                      <div className="highlight-operation-main">
                        <header className="highlight-operation-main-head">
                          <div>
                            <h4>Painel de Operação</h4>
                            <p>Visão unificada do que está em andamento</p>
                          </div>
                        </header>

                        <div className="highlight-operation-kpis">
                          <div className="highlight-operation-kpi">
                            <strong>26</strong>
                            <span>Conversas na fila</span>
                          </div>
                          <div className="highlight-operation-kpi">
                            <strong>128</strong>
                            <span>Leads ativos</span>
                          </div>
                          <div className="highlight-operation-kpi">
                            <strong>21%</strong>
                            <span>Conversão atual</span>
                          </div>
                        </div>

                        <div className="highlight-operation-modules">
                          <article className="highlight-operation-module is-inbox">
                            <span className="highlight-operation-module-tag">Inbox operacional</span>
                            <h5>Atender e qualificar</h5>
                            <ul className="highlight-operation-list">
                              <li><strong>Carlos M.</strong><span>Em andamento</span></li>
                              <li><strong>Juliana R.</strong><span>Aguardando retorno</span></li>
                              <li><strong>Rafael S.</strong><span>Qualificado</span></li>
                            </ul>
                          </article>

                          <article className="highlight-operation-module">
                            <span className="highlight-operation-module-tag">Campanhas e fila</span>
                            <h5>Distribuição controlada</h5>
                            <ul className="highlight-operation-list">
                              <li><strong>Campanha demo</strong><span>64 disparos</span></li>
                              <li><strong>Fila prioritária</strong><span>Ativa</span></li>
                            </ul>
                          </article>

                          <article className="highlight-operation-module">
                            <span className="highlight-operation-module-tag">Funil comercial</span>
                            <h5>Pipeline atualizado</h5>
                            <ul className="highlight-operation-stage-list">
                              <li>
                                <span>Etapa 1</span>
                                <div className="highlight-operation-stage-bar"><span style={{ width: '84%' }} /></div>
                                <i>84%</i>
                              </li>
                              <li>
                                <span>Etapa 2</span>
                                <div className="highlight-operation-stage-bar"><span style={{ width: '52%' }} /></div>
                                <i>52%</i>
                              </li>
                              <li>
                                <span>Concluído</span>
                                <div className="highlight-operation-stage-bar"><span style={{ width: '21%' }} /></div>
                                <i>21%</i>
                              </li>
                            </ul>
                          </article>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ) : activeHighlightView.id === 'meta' ? (
                <article className="highlight-strategy-tab" aria-label="Estratégia comercial da página">
                  <div className="highlight-strategy-panel highlight-strategy-left">
                    <h3 className="highlight-strategy-title">Primeiro a solução, depois o preço</h3>

                    <div className="highlight-strategy-pillar-grid" aria-label="Pilares de valor do produto">
                      {strategyPillars.map((pillar) => (
                        <article className="highlight-strategy-pillar" key={pillar.title}>
                          <span className="highlight-strategy-pill">{pillar.tag}</span>
                          <h4>{pillar.title}</h4>
                          <p>{pillar.text}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="highlight-strategy-panel highlight-strategy-right">
                    <ul className="highlight-strategy-list">
                      {strategyProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>

                    <div className="highlight-strategy-divider">
                      <ul className="highlight-strategy-list">
                        {strategyOutcomes.map((outcome) => (
                          <li key={outcome}>{outcome}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ) : (
                <>
                  <article className="highlight-model-copy" aria-label="Resumo estratégico da plataforma">
                    {!['dashboard', 'chatinterno'].includes(activeHighlightView.id.toLowerCase()) && (
                      <>
                        <span className="highlight-model-brand" aria-hidden="true">
                          <img src={brandLogoUrl} alt="" />
                        </span>
                        <span className="highlight-model-badge">{activeHighlightView.badge}</span>
                      </>
                    )}
                    <h3 className="highlight-model-title">{activeHighlightView.title}</h3>
                    <h4 className="highlight-model-subtitle">{activeHighlightView.subtitle}</h4>
                    <p>{activeHighlightView.primaryText}</p>
                    <p>{activeHighlightView.secondaryText}</p>

                    <div className="hero-cta-row highlight-model-cta">
                      <button
                        type="button"
                        className="sales-btn sales-btn-outline"
                        onClick={() => scrollToSection('planos-lista')}
                      >
                        Ver planos agora
                      </button>
                      <Link to="/login" className="sales-btn sales-btn-primary">Quero testar</Link>
                    </div>
                  </article>

                  <article className={`highlight-model-preview ${activeHighlightView.id === 'dashboard' ? 'is-dashboard-preview' : ''}`} aria-label={`Preview de ${activeHighlightView.navLabel}`}>
                    {activeHighlightView.id === 'dashboard' ? (
                      <div className="hero-screen" aria-label="Mock do workspace no card de dashboard">
                        <div className="hero-illustration-wrap">
                          <div className="hero-illustration hero-real-mock" role="img" aria-label="Mock do painel real ZapVender com dashboard, eventos e funil">
                            <aside className="hero-real-sidebar">
                              <div className="hero-real-sidebar-main">
                                <div className="hero-real-sidebar-groups">
                                  <div className="hero-real-sidebar-group">
                                    <div className="hero-real-nav-item is-active">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-dashboard hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Painel de Controle</span>
                                    </div>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-contacts hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Contatos</span>
                                    </div>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-campaigns hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Campanhas</span>
                                    </div>
                                  </div>

                                  <div className="hero-real-sidebar-group">
                                    <span className="hero-real-sidebar-label">Conversas</span>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-inbox hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Inbox</span>
                                    </div>
                                  </div>

                                  <div className="hero-real-sidebar-group">
                                    <span className="hero-real-sidebar-label">Automação</span>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-flows hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Fluxos de Conversa</span>
                                    </div>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-funnel hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Funil de Vendas</span>
                                    </div>
                                  </div>

                                  <div className="hero-real-sidebar-group">
                                    <span className="hero-real-sidebar-label">Sistema</span>
                                    <div className="hero-real-nav-item">
                                      <span className="hero-real-nav-icon-box">
                                        <span className="icon icon-settings hero-real-nav-icon" />
                                      </span>
                                      <span className="hero-real-nav-text">Configurações</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="hero-real-sidebar-footer">
                                <div className="hero-real-exit">Sair</div>
                              </div>
                            </aside>

                            <section className="hero-real-main">
                              <header className="hero-real-header">
                                <h3>Painel de Controle</h3>
                                <p>Bem-vindo, teste5@gmail.com | quinta-feira, 26 de fevereiro</p>
                              </header>

                              <div className="hero-real-top-grid">
                                <article className="hero-real-card">
                                  <h4 className="hero-real-card-title">Estatísticas por período</h4>
                                  <div className="hero-real-period-form">
                                    <div className="hero-real-field">19/02/2026</div>
                                    <div className="hero-real-field">26/02/2026</div>
                                  </div>

                                  <div className="hero-real-chart-meta">
                                    <span className="hero-real-chip">Novos contatos</span>
                                    <div className="hero-real-toggle-group">
                                      <span className="hero-real-toggle is-active">L</span>
                                      <span className="hero-real-toggle">B</span>
                                    </div>
                                  </div>

                                  <div className="hero-real-chart">
                                    <svg className="hero-real-chart-svg" viewBox="0 0 320 120" aria-hidden="true">
                                      <defs>
                                        <linearGradient id="heroRealChartFillDashboard" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="rgba(67, 219, 140, 0.34)" />
                                          <stop offset="100%" stopColor="rgba(67, 219, 140, 0.04)" />
                                        </linearGradient>
                                      </defs>
                                      <path
                                        d="M 12 102 L 42 102 L 72 102 L 102 102 L 132 102 L 162 18 L 192 102 L 222 102 L 252 102 L 282 102 L 308 102 L 308 108 L 12 108 Z"
                                        fill="url(#heroRealChartFillDashboard)"
                                      />
                                      <path
                                        d="M 12 102 L 42 102 L 72 102 L 102 102 L 132 102 L 162 18 L 192 102 L 222 102 L 252 102 L 282 102 L 308 102"
                                        fill="none"
                                        stroke="rgba(67, 219, 140, 0.9)"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <circle cx="162" cy="18" r="4.5" fill="rgba(67, 219, 140, 1)" />
                                    </svg>
                                    <div className="hero-real-chart-axis">
                                      <span>19/02</span>
                                      <span>20/02</span>
                                      <span>21/02</span>
                                      <span>22/02</span>
                                      <span>23/02</span>
                                      <span>24/02</span>
                                      <span>26/02</span>
                                    </div>
                                  </div>
                                </article>

                                <article className="hero-real-card">
                                  <h4 className="hero-real-card-title">Estatísticas gerais</h4>
                                  <ul className="hero-real-general-list">
                                    <li><span>Contatos que interagiram</span><strong>9.603</strong></li>
                                    <li><span>Mensagem enviada pelo contato</span><strong>19.206</strong></li>
                                    <li><span>Interações/inscrito</span><strong>2.0</strong></li>
                                  </ul>
                                </article>
                              </div>

                              <article className="hero-real-card hero-real-events">
                                <div className="hero-real-events-head">
                                  <h4 className="hero-real-card-title">Eventos personalizados</h4>
                                  <div className="hero-real-events-actions">
                                    <span className="hero-real-chip">Este mês</span>
                                    <span className="hero-real-chip is-current">Criar</span>
                                  </div>
                                </div>
                                <div className="hero-real-event-empty">
                                  <strong>Nenhum evento personalizado ainda</strong>
                                  <span>Crie eventos e use o bloco Registrar Evento nos seus fluxos.</span>
                                </div>
                              </article>

                              <div className="hero-real-metrics">
                                <article className="hero-real-metric-card">
                                  <div className="hero-real-metric-top">
                                    <span className="hero-real-metric-icon is-green" />
                                    <span className="hero-real-metric-delta is-positive">+0%</span>
                                  </div>
                                  <strong>9.603</strong>
                                  <span>Total de Leads</span>
                                </article>
                                <article className="hero-real-metric-card">
                                  <div className="hero-real-metric-top">
                                    <span className="hero-real-metric-icon is-green" />
                                    <span className="hero-real-metric-delta is-positive">+0%</span>
                                  </div>
                                  <strong>0</strong>
                                  <span>Concluídos</span>
                                </article>
                                <article className="hero-real-metric-card">
                                  <div className="hero-real-metric-top">
                                    <span className="hero-real-metric-icon is-amber" />
                                    <span className="hero-real-metric-delta is-negative">-0%</span>
                                  </div>
                                  <strong>9.603</strong>
                                  <span>Em andamento</span>
                                </article>
                                <article className="hero-real-metric-card">
                                  <div className="hero-real-metric-top">
                                    <span className="hero-real-metric-icon is-cyan" />
                                    <span className="hero-real-metric-delta is-positive">+0%</span>
                                  </div>
                                  <strong>0.0%</strong>
                                  <span>Conversão</span>
                                </article>
                              </div>

                              <article className="hero-real-card hero-real-funnel">
                                <h4 className="hero-real-card-title">Funil de Conversão</h4>
                                <div className="hero-real-funnel-grid">
                                  <article className="hero-real-funnel-stage">
                                    <strong>9.603</strong>
                                    <span>Etapa 1</span>
                                    <i>100%</i>
                                  </article>
                                  <article className="hero-real-funnel-stage">
                                    <strong>0</strong>
                                    <span>Etapa 2</span>
                                    <i>0.0%</i>
                                  </article>
                                  <article className="hero-real-funnel-stage">
                                    <strong>0</strong>
                                    <span>Etapa 3</span>
                                    <i>0.0%</i>
                                  </article>
                                  <article className="hero-real-funnel-stage">
                                    <strong>0</strong>
                                    <span>Concluído</span>
                                    <i>0.0%</i>
                                  </article>
                                </div>
                              </article>
                            </section>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <PlatformMock
                        viewLabel={activeHighlightView.navLabel}
                        stats={activeHighlightView.stats}
                        primaryItems={activeHighlightView.previewLeft}
                        secondaryItems={activeHighlightView.previewRight}
                      />
                    )}
                  </article>
                </>
              )}

            </div>

          </section>

          <section className="plans-section section-variant-frame" id="planos-lista" aria-labelledby="titulo-planos">
            <div className="section-head is-left">
              <div>
                <h2 className="section-title" id="titulo-planos">Planos</h2>
                <p className="section-subtitle">
                  Escolha o plano ideal para seu momento comercial e evolua quando quiser.
                </p>
              </div>
            </div>

            <div className="plans-grid">
              {pricingPlans.map((plan) => (
                <article
                  className={`pricing-card ${plan.featured ? 'is-featured' : ''}`}
                  key={plan.name}
                  aria-label={`Plano ${plan.name}`}
                >
                  {plan.featured && <span className="pricing-popular-badge">Mais popular</span>}
                  <h3 className="pricing-name">{plan.name}</h3>
                  <p className="pricing-subtitle">{plan.subtitle}</p>
                  <div className="pricing-price-row">
                    <strong className="pricing-price">{plan.monthlyPrice}</strong>
                    <span className="pricing-period">/m</span>
                  </div>
                  <p className="pricing-billing">{plan.billing}</p>

                  <ul className="pricing-meta-list" aria-label={`Resumo do plano ${plan.name}`}>
                    <li className="pricing-meta-item">
                      WhatsApps inclusos: <strong>{plan.whatsappIncluded}</strong>
                    </li>
                    <li className={`pricing-meta-item pricing-advanced-state ${plan.name === 'Starter' ? 'is-locked' : ''}`}>
                      {plan.featuresState}
                    </li>
                  </ul>

                  <Link
                    to="/login"
                    className={`pricing-button ${plan.featured ? 'is-featured' : ''}`}
                  >
                    {plan.ctaLabel}
                  </Link>
                </article>
              ))}
            </div>

            <div className="plan-unified-compare" aria-label="Comparação de planos">
              <details className="plan-compare-details">
                <summary>
                  <span className="plan-compare-summary-main">
                    <span className="plan-compare-summary-icon" aria-hidden="true" />
                    <span>Ver comparação detalhada</span>
                  </span>
                  <span className="plan-compare-summary-meta">Starter x Premium x Business</span>
                </summary>
                <div className="comparison-table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Recurso / escopo</th>
                        <th>Starter</th>
                        <th>Premium</th>
                        <th>Business</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.feature}>
                          <td>{row.feature}</td>
                          <td>{row.pro}</td>
                          <td>{row.equipe}</td>
                          <td>{row.enterprise}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>

          </section>
        </main>

        <FooterPremium onNavigateSection={scrollToSection} />
      </div>
    </div>
  );
}


