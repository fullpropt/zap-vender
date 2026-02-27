import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandFullLogoUrl, brandLogoUrl, brandName } from '../lib/brand';

const monthlyPrice = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(297);

const planFeatures = [
  'CRM com contatos, histórico de conversas e lead tracking',
  'Inbox para atendimento com mensagens e mídias',
  'Campanhas e disparos com fila e controle de envio',
  'Automações e fluxos para atendimento e follow-up',
  'Funil visual para acompanhar oportunidades',
  'Gestão de sessões WhatsApp direto no painel'
];

const testimonials = [
  {
    quote: 'Antes eu atendia tudo espalhado. Com o ZapVender consegui organizar o time, responder mais rapido e parar de perder lead no WhatsApp.',
    name: 'Carlos M.',
    role: 'Operacao comercial',
    metric: 'Mais controle no atendimento'
  },
  {
    quote: 'A melhor parte foi juntar CRM + inbox + automacao no mesmo painel. A equipe passou a acompanhar status dos contatos sem planilha paralela.',
    name: 'Juliana R.',
    role: 'Gestao de vendas',
    metric: 'Processo mais padronizado'
  },
  {
    quote: 'Para validacao comercial, o plano unico ajuda muito. O cliente entende a oferta em poucos segundos e a conversa avanca mais rapido.',
    name: 'Rafael S.',
    role: 'Parceiro comercial',
    metric: 'Menos friccao na oferta'
  }
];

const faqItems = [
  {
    question: 'Como funciona a cobranca do plano?',
    answer: 'O plano e mensal, com recorrencia de R$297. Voce pode adaptar a pagina para o gateway escolhido e incluir termos de renovacao, vencimento e inadimplencia.'
  },
  {
    question: 'Tem fidelidade ou contrato minimo?',
    answer: 'Nesta versao da pagina, a comunicacao foi preparada para plano mensal simples. Se houver fidelidade, acrescente essa regra no FAQ e no checkout.'
  },
  {
    question: 'O que esta incluso no plano de R$297?',
    answer: 'A proposta atual destaca os modulos principais: CRM, inbox, campanhas, automacoes, funil e gestao de sessoes WhatsApp. Ajuste a lista conforme sua operacao comercial.'
  },
  {
    question: 'Como fica a implantacao e onboarding?',
    answer: 'Voce pode incluir onboarding padrao (ex.: configuracao inicial e treinamento) ou vender implantacao separada. A estrutura da pagina suporta essa evolucao.'
  },
  {
    question: 'Posso trocar o CTA por checkout direto?',
    answer: 'Sim. Os botoes hoje apontam para login, mas podem ser conectados a checkout (Asaas, Stripe, Mercado Pago) ou WhatsApp comercial em poucos pontos do componente.'
  },
  {
    question: 'Posso criar planos Lite e Enterprise depois?',
    answer: 'Sim. A pagina ja inclui comparacao de planos futuros para facilitar esse upgrade sem refazer o layout completo.'
  }
];

const planRoadmap = [
  {
    name: 'ZapVender Pro',
    status: 'Atual',
    badgeClass: 'is-live',
    price: `${monthlyPrice}/mes`,
    description: 'Plano unico para vender agora com proposta clara e onboarding comercial simplificado.'
  },
  {
    name: 'ZapVender Equipe',
    status: 'Em breve',
    badgeClass: 'is-coming',
    price: 'Planejado',
    description: 'Versao para times maiores, com regras de equipe, permissoes e mais capacidade operacional.'
  },
  {
    name: 'ZapVender Enterprise',
    status: 'Em breve',
    badgeClass: 'is-coming',
    price: 'Sob consulta',
    description: 'Camada para operacoes com SLA, processos customizados e integracoes mais profundas.'
  }
];

const comparisonRows = [
  {
    feature: 'CRM + Inbox de atendimento',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Campanhas + fila de envios',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Automacoes e fluxos',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Organizacao para equipe / permissoes',
    pro: 'Essencial',
    equipe: 'Avancado (planejado)',
    enterprise: 'Avancado'
  },
  {
    feature: 'Onboarding e suporte',
    pro: 'Padrao',
    equipe: 'Prioritario (planejado)',
    enterprise: 'SLA / consultivo'
  },
  {
    feature: 'Customizacoes e integracoes',
    pro: 'Sob avaliacao',
    equipe: 'Opcional',
    enterprise: 'Prioritario'
  }
];

const solutionPillars = [
  {
    title: 'Atendimento centralizado',
    description: 'Concentre conversas, contatos e historico em um unico painel para tirar o time do improviso.',
    stat: 'WhatsApp + CRM'
  },
  {
    title: 'Processo comercial visivel',
    description: 'Organize leads por etapa e acompanhe o funil com contexto real de atendimento.',
    stat: 'Funil + inbox'
  },
  {
    title: 'Escala com controle',
    description: 'Use campanhas, filas e automacoes para crescer sem perder previsibilidade operacional.',
    stat: 'Fila + automacao'
  }
];

const resourceHighlights = [
  {
    title: 'Inbox operacional',
    subtitle: 'Atenda com contexto',
    description: 'Visualize mensagens, midias e historico do lead em um fluxo unico de atendimento.'
  },
  {
    title: 'CRM e contatos',
    subtitle: 'Relacao comercial organizada',
    description: 'Cadastre, segmente e acompanhe leads com informacoes centralizadas e filtros por sessao.'
  },
  {
    title: 'Campanhas e fila',
    subtitle: 'Envio com controle',
    description: 'Dispare mensagens com fila, reenvio e controle de throughput para reduzir risco operacional.'
  },
  {
    title: 'Automacoes e fluxos',
    subtitle: 'Menos trabalho manual',
    description: 'Crie jornadas e respostas para acelerar atendimento, follow-up e qualificacao.'
  },
  {
    title: 'Gestao de contas WhatsApp',
    subtitle: 'Operacao multi-sessao',
    description: 'Gerencie sessoes, status de conexao e distribuicao de envios a partir do painel.'
  },
  {
    title: 'Funil comercial',
    subtitle: 'Visao de pipeline',
    description: 'Acompanhe andamento das oportunidades e tome decisoes com base no progresso real.'
  }
];

const journeySteps = [
  {
    step: '01',
    title: 'Captar e organizar',
    text: 'Entradas de contato e atendimento chegam ao painel, com visao de conversa e cadastro do lead.'
  },
  {
    step: '02',
    title: 'Atender e qualificar',
    text: 'Equipe responde no inbox, registra contexto e move oportunidades no funil.'
  },
  {
    step: '03',
    title: 'Automatizar e escalar',
    text: 'Fluxos, campanhas e fila de envio ajudam a manter constancia sem sobrecarregar o time.'
  }
];

const heroAudienceChips = [
  'Agencias',
  'Times comerciais',
  'Infoprodutos',
  'Prestadores',
  'Inside sales'
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

  const currentYear = new Date().getFullYear();

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

        .hero-subtitle {
          margin: 14px auto 0;
          color: #b8d0d0;
          font-size: 16px;
          line-height: 1.6;
          max-width: 58ch;
          text-wrap: balance;
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
          max-width: 920px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.012));
          padding: 10px 12px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: center;
          text-align: left;
        }

        .hero-proof-label {
          color: #b8d4d4;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .hero-proof-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .hero-proof-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
          padding: 6px 8px;
          color: #d6ebeb;
          font-size: 11px;
          line-height: 1;
        }

        .hero-proof-chip::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(107, 246, 171, 0.95);
          box-shadow: 0 0 0 4px rgba(53, 224, 132, 0.08);
        }

        .hero-note {
          margin-top: 12px;
          color: #99b6b6;
          font-size: 12px;
        }

        .hero-visual {
          margin: 18px auto 0;
          max-width: 980px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(620px 280px at 78% 6%, rgba(35, 198, 111, 0.16), rgba(35, 198, 111, 0)),
            radial-gradient(300px 200px at 14% 90%, rgba(246, 184, 78, 0.08), rgba(246, 184, 78, 0)),
            linear-gradient(165deg, rgba(7, 22, 25, 0.94), rgba(5, 15, 18, 0.98));
          padding: 14px;
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .hero-visual::before {
          content: '';
          position: absolute;
          inset: auto auto -120px -80px;
          width: 320px;
          height: 320px;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 35%, rgba(246, 184, 78, 0.12), rgba(246, 184, 78, 0));
        }

        .hero-visual::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
          background-size: 100% 28px, 28px 100%;
          opacity: 0.14;
        }

        .hero-screen {
          position: relative;
          z-index: 1;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(440px 200px at 60% 0%, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0)),
            linear-gradient(180deg, rgba(4, 15, 17, 0.9), rgba(6, 18, 21, 0.98));
          padding: 12px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .hero-screen-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
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
          gap: 10px;
        }

        .hero-illustration {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(0, 0, 0, 0.12);
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.12);
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
          content: '✓';
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
          margin-top: 0;
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
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .plan-card {
          border-radius: 18px;
          border: 1px solid rgba(35, 198, 111, 0.07);
          background:
            radial-gradient(420px 200px at 82% 4%, rgba(35, 198, 111, 0.1), rgba(35, 198, 111, 0) 72%),
            linear-gradient(155deg, rgba(12, 30, 33, 0.96), rgba(7, 19, 22, 0.98));
          padding: 18px;
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          gap: 16px;
          align-items: start;
        }

        .plan-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .plan-chip {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d4eaea;
          background: rgba(255, 255, 255, 0.03);
        }

        .plan-chip.is-highlight {
          border-color: rgba(35, 198, 111, 0.28);
          background: rgba(35, 198, 111, 0.08);
          color: #c4ffd9;
        }

        .plan-title {
          margin: 0 0 8px;
          font-size: 22px;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .plan-description {
          margin: 0 0 14px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
        }

        .plan-feature-grid {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .plan-feature-grid li {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          color: #dcecec;
          font-size: 13px;
          line-height: 1.45;
        }

        .plan-sidebar {
          border-radius: 16px;
          border: 1px solid rgba(35, 198, 111, 0.07);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01)),
            rgba(4, 14, 16, 0.92);
          padding: 14px;
          display: grid;
          gap: 10px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .plan-sidebar-price {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }

        .plan-sidebar-price strong {
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .plan-sidebar-price span {
          color: #b5cbcb;
          font-size: 13px;
        }

        .plan-sidebar-meta {
          margin: 0;
          color: #a7bdbd;
          font-size: 12px;
          line-height: 1.5;
        }

        .testimonials-section,
        .comparison-section {
          margin-top: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.008));
          padding: 14px;
        }

        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .testimonial-card {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            radial-gradient(180px 80px at 80% 0%, rgba(35, 198, 111, 0.05), rgba(35, 198, 111, 0)),
            linear-gradient(165deg, rgba(13, 30, 34, 0.9), rgba(8, 20, 23, 0.96));
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .testimonial-quote {
          margin: 0;
          color: #dceeee;
          font-size: 13px;
          line-height: 1.6;
        }

        .testimonial-quote::before {
          content: '“';
          color: rgba(53, 224, 132, 0.9);
          font-size: 18px;
          line-height: 0;
          margin-right: 3px;
        }

        .testimonial-footer {
          display: grid;
          gap: 3px;
        }

        .testimonial-name {
          font-size: 13px;
          font-weight: 700;
          color: #f0fbfb;
        }

        .testimonial-role {
          color: #9fb9b9;
          font-size: 12px;
        }

        .testimonial-metric {
          margin-top: 2px;
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.2);
          background: rgba(35, 198, 111, 0.08);
          color: #bff6d5;
          font-size: 11px;
          padding: 5px 9px;
          font-weight: 700;
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .roadmap-card {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.01));
          padding: 12px;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .roadmap-card.is-live {
          border-color: rgba(35, 198, 111, 0.22);
          background:
            linear-gradient(170deg, rgba(35, 198, 111, 0.07), rgba(255, 255, 255, 0.02));
        }

        .roadmap-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .roadmap-name {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
        }

        .roadmap-price {
          color: #d7ecec;
          font-weight: 700;
          font-size: 13px;
        }

        .roadmap-desc {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d5eaea;
          background: rgba(255, 255, 255, 0.03);
        }

        .status-badge.is-live {
          color: #bff6d5;
          border-color: rgba(35, 198, 111, 0.26);
          background: rgba(35, 198, 111, 0.08);
        }

        .status-badge.is-coming {
          color: #ffe6bb;
          border-color: rgba(246, 184, 78, 0.2);
          background: rgba(246, 184, 78, 0.07);
        }

        .comparison-note {
          margin: 0 0 10px;
          color: #a8c1c1;
          font-size: 12px;
          line-height: 1.55;
        }

        .comparison-table-wrap {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(3, 11, 13, 0.55);
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

        .bottom-cta {
          margin-top: 18px;
          border-radius: 18px;
          border: 1px solid rgba(35, 198, 111, 0.22);
          background:
            radial-gradient(340px 160px at 72% 10%, rgba(35, 198, 111, 0.13), rgba(35, 198, 111, 0)),
            linear-gradient(145deg, rgba(10, 29, 24, 0.92), rgba(6, 18, 16, 0.95));
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .bottom-cta-title {
          margin: 0;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .bottom-cta-text {
          margin: 3px 0 0;
          color: #a9c2bc;
          font-size: 13px;
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

          .plan-card {
            grid-template-columns: 1fr;
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

          .testimonial-grid,
          .roadmap-grid {
            grid-template-columns: 1fr;
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
            margin-top: 14px;
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

          .hero-proof-row {
            padding: 9px;
            border-radius: 12px;
          }

          .pillar-grid,
          .resource-grid,
          .journey-grid,
          .plan-feature-grid {
            grid-template-columns: 1fr;
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

          .plan-card {
            padding: 14px;
            border-radius: 14px;
          }

          .section-panel {
            padding: 12px;
          }

          .testimonials-section,
          .comparison-section {
            margin-top: 12px;
            border-radius: 14px;
            padding: 12px;
          }

          .bottom-cta {
            padding: 14px;
            border-radius: 14px;
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
          <header className="sales-nav" aria-label="Navegacao da pagina de planos">
            <Link to="/planos" className="sales-brand" aria-label={`${brandName} planos`}>
              <img src={brandFullLogoUrl} alt={brandName} />
            </Link>

            <div className="sales-nav-links" aria-label="Atalhos de secao">
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('solucao')}>
                Solucao
              </button>
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('recursos')}>
                Recursos
              </button>
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('planos-lista')}>
                Planos
              </button>
              <button type="button" className="sales-nav-link" onClick={() => scrollToSection('faq-comercial')}>
                FAQ
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
                Transforme o WhatsApp em uma <strong>operacao comercial organizada</strong> com o ZapVender
              </h1>
              <p className="hero-subtitle">
                Atendimento, CRM, campanhas, automacoes e funil em um unico painel para sua equipe vender melhor com mais controle.
                Primeiro voce entende a solucao. Depois escolhe o plano.
              </p>

              <ul className="hero-benefit-list" aria-label="Beneficios principais">
                <li>Atendimento com contexto</li>
                <li>CRM + funil comercial</li>
                <li>Automacoes e campanhas</li>
                <li>Operacao multi-sessao</li>
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

              <div className="hero-proof-row" aria-label="Publicos ideais para o ZapVender">
                <div className="hero-proof-label">Ideal para operacoes que vendem pelo WhatsApp</div>
                <div className="hero-proof-chips" aria-hidden="true">
                  {heroAudienceChips.map((chip) => (
                    <span className="hero-proof-chip" key={chip}>{chip}</span>
                  ))}
                </div>
              </div>

              <div className="hero-visual" aria-label="Visual da plataforma ZapVender">
                <span className="hero-floating-tag is-top">Atendimento + CRM no mesmo painel</span>
                <span className="hero-floating-tag is-bottom">Campanhas, automacoes e funil</span>

                <div className="hero-screen">
                  <div className="hero-screen-top">
                    <div className="hero-screen-brand">
                      <img src={brandLogoUrl} alt="" aria-hidden="true" />
                      <span>ZapVender Workspace</span>
                    </div>
                    <div className="hero-screen-tabs" aria-hidden="true">
                      <span>Inbox</span>
                      <span>CRM</span>
                      <span>Campanhas</span>
                      <span>Automacao</span>
                      <span>Funil</span>
                    </div>
                  </div>

                  <div className="hero-illustration-wrap">
                    <svg
                      className="hero-illustration"
                      viewBox="0 0 960 420"
                      role="img"
                      aria-label="Ilustracao vetorial do painel ZapVender com inbox, CRM e funil"
                    >
                      <defs>
                        <linearGradient id="zvHeroBg" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#07161a" />
                          <stop offset="100%" stopColor="#0b2127" />
                        </linearGradient>
                        <linearGradient id="zvHeroCard" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                        </linearGradient>
                        <linearGradient id="zvHeroAccent" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#25d77d" />
                          <stop offset="100%" stopColor="#17b861" />
                        </linearGradient>
                        <linearGradient id="zvHeroAmber" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f8c463" />
                          <stop offset="100%" stopColor="#eea932" />
                        </linearGradient>
                        <linearGradient id="zvHeroCyan" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7ee8ff" />
                          <stop offset="100%" stopColor="#46c7f3" />
                        </linearGradient>
                      </defs>

                      <rect x="8" y="8" width="944" height="404" rx="22" fill="url(#zvHeroBg)" stroke="rgba(255,255,255,0.06)" />

                      <rect x="24" y="22" width="164" height="376" rx="14" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.06)" />
                      <rect x="40" y="38" width="132" height="34" rx="10" fill="rgba(37,215,125,0.08)" stroke="rgba(37,215,125,0.22)" />
                      <circle cx="54" cy="55" r="6" fill="#2fe085" />
                      <rect x="66" y="50" width="78" height="10" rx="5" fill="rgba(222,247,236,0.8)" />
                      <rect x="40" y="92" width="132" height="28" rx="9" fill="rgba(255,255,255,0.018)" />
                      <rect x="40" y="130" width="132" height="28" rx="9" fill="rgba(255,255,255,0.018)" />
                      <rect x="40" y="168" width="132" height="28" rx="9" fill="rgba(255,255,255,0.018)" />
                      <rect x="40" y="206" width="132" height="28" rx="9" fill="rgba(255,255,255,0.018)" />
                      <rect x="40" y="262" width="132" height="120" rx="10" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.04)" />
                      <rect x="52" y="280" width="108" height="8" rx="4" fill="rgba(255,255,255,0.12)" />
                      <rect x="52" y="298" width="84" height="7" rx="4" fill="rgba(255,255,255,0.08)" />
                      <rect x="52" y="323" width="108" height="46" rx="8" fill="rgba(37,215,125,0.06)" stroke="rgba(37,215,125,0.14)" />

                      <rect x="204" y="22" width="732" height="60" rx="14" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.06)" />
                      <rect x="220" y="39" width="180" height="12" rx="6" fill="rgba(235,250,246,0.72)" />
                      <rect x="220" y="58" width="120" height="8" rx="4" fill="rgba(255,255,255,0.18)" />
                      <rect x="635" y="34" width="92" height="18" rx="9" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
                      <rect x="735" y="34" width="92" height="18" rx="9" fill="rgba(37,215,125,0.1)" stroke="rgba(37,215,125,0.22)" />
                      <rect x="835" y="34" width="85" height="18" rx="9" fill="rgba(246,184,78,0.08)" stroke="rgba(246,184,78,0.18)" />

                      <rect x="204" y="98" width="732" height="88" rx="14" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="220" y="114" width="225" height="56" rx="12" fill="url(#zvHeroCard)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="461" y="114" width="225" height="56" rx="12" fill="url(#zvHeroCard)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="702" y="114" width="218" height="56" rx="12" fill="url(#zvHeroCard)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="236" y="126" width="76" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
                      <rect x="236" y="142" width="104" height="16" rx="8" fill="url(#zvHeroAccent)" />
                      <rect x="477" y="126" width="82" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
                      <rect x="477" y="142" width="118" height="16" rx="8" fill="url(#zvHeroCyan)" />
                      <rect x="718" y="126" width="94" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
                      <rect x="718" y="142" width="126" height="16" rx="8" fill="url(#zvHeroAmber)" />

                      <rect x="204" y="202" width="432" height="196" rx="14" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="652" y="202" width="284" height="196" rx="14" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.05)" />

                      <rect x="220" y="218" width="400" height="28" rx="10" fill="rgba(255,255,255,0.02)" />
                      <circle cx="238" cy="232" r="6" fill="#2fe085" />
                      <rect x="252" y="227" width="112" height="9" rx="4" fill="rgba(239,252,247,0.82)" />
                      <rect x="575" y="226" width="29" height="11" rx="5" fill="rgba(37,215,125,0.12)" />

                      <rect x="220" y="256" width="260" height="40" rx="12" fill="rgba(255,255,255,0.016)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="234" y="268" width="138" height="8" rx="4" fill="rgba(255,255,255,0.14)" />
                      <rect x="234" y="282" width="112" height="6" rx="3" fill="rgba(255,255,255,0.08)" />

                      <rect x="360" y="306" width="260" height="40" rx="12" fill="rgba(37,215,125,0.07)" stroke="rgba(37,215,125,0.16)" />
                      <rect x="374" y="318" width="148" height="8" rx="4" fill="rgba(232,255,243,0.86)" />
                      <rect x="374" y="332" width="126" height="6" rx="3" fill="rgba(255,255,255,0.12)" />

                      <rect x="220" y="356" width="260" height="26" rx="10" fill="rgba(255,255,255,0.016)" />
                      <rect x="234" y="365" width="196" height="8" rx="4" fill="rgba(255,255,255,0.08)" />

                      <rect x="668" y="218" width="252" height="166" rx="12" fill="rgba(255,255,255,0.016)" stroke="rgba(255,255,255,0.04)" />
                      <rect x="684" y="234" width="94" height="8" rx="4" fill="rgba(255,255,255,0.14)" />
                      <rect x="684" y="248" width="132" height="6" rx="3" fill="rgba(255,255,255,0.08)" />

                      <path d="M704 339 C745 316 758 332 787 300 C814 270 843 286 873 247" fill="none" stroke="url(#zvHeroAccent)" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="704" cy="339" r="5" fill="#25d77d" />
                      <circle cx="787" cy="300" r="5" fill="#25d77d" />
                      <circle cx="873" cy="247" r="6" fill="#25d77d" />
                      <circle cx="873" cy="247" r="12" fill="none" stroke="rgba(37,215,125,0.18)" />

                      <path d="M692 304 L724 304" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                      <path d="M692 320 L744 320" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                      <path d="M692 336 L764 336" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />

                      <rect x="790" y="322" width="114" height="44" rx="10" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.05)" />
                      <rect x="802" y="334" width="88" height="8" rx="4" fill="rgba(255,255,255,0.12)" />
                      <rect x="802" y="348" width="64" height="6" rx="3" fill="rgba(255,255,255,0.08)" />

                      <path d="M484 326 C565 326 604 320 668 282" fill="none" stroke="rgba(94,217,255,0.28)" strokeWidth="2" strokeDasharray="6 6" />
                      <circle cx="668" cy="282" r="4" fill="#5ed9ff" />
                    </svg>

                    <div className="hero-illustration-caption">
                      <div className="hero-legend" aria-hidden="true">
                        <span className="hero-legend-item"><i className="hero-legend-dot is-green" /> Atendimento</span>
                        <span className="hero-legend-item"><i className="hero-legend-dot is-cyan" /> CRM / Funil</span>
                        <span className="hero-legend-item"><i className="hero-legend-dot is-amber" /> Campanhas</span>
                      </div>
                      <p className="hero-illustration-copy">
                        Ilustracao vetorial da operacao no ZapVender: atendimento, controle comercial e escala em um fluxo visual unico.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="hero-note">
                Role para ver a solucao, os recursos e depois os planos. O preco fica abaixo desta primeira dobra.
              </p>
            </div>
          </section>
          <section className="solution-section section-variant-left" id="solucao" aria-labelledby="titulo-solucao">
            <div className="section-head is-left">
              <div>
                <div className="section-tag">O que o ZapVender resolve</div>
                <h2 className="section-title" id="titulo-solucao">Primeiro a solucao, depois o preco</h2>
                <p className="section-subtitle">
                  Estrutura inspirada em paginas de produto que explicam valor antes do plano: problema, proposta e recursos.
                </p>
              </div>
            </div>

            <div className="section-grid">
              <div className="section-panel">
                <p>
                  O ZapVender foi posicionado para resolver um problema operacional comum: atendimento, acompanhamento comercial e automacoes
                  espalhados em processos diferentes. A ideia da pagina e mostrar que a plataforma organiza a operacao antes de falar de plano.
                </p>

                <div className="pillar-grid" aria-label="Pilares da solucao">
                  {solutionPillars.map((pillar) => (
                    <article className="pillar-card" key={pillar.title}>
                      <span className="pillar-stat">{pillar.stat}</span>
                      <h3 className="pillar-title">{pillar.title}</h3>
                      <p className="pillar-text">{pillar.description}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="section-panel">
                <div className="section-tag">Problemas que a pagina comunica</div>
                <ul className="problem-list">
                  <li>Leads se perdem quando atendimento e CRM nao conversam.</li>
                  <li>Equipe atende sem contexto quando historico fica espalhado.</li>
                  <li>Escala de envio sem fila e automacao gera risco operacional.</li>
                  <li>Decisao comercial piora quando nao existe visao clara de funil.</li>
                </ul>

                <div className="section-tag" style={{ marginTop: '12px' }}>Resultado esperado</div>
                <ul className="resource-list">
                  <li>Atendimento com contexto + operacao organizada em um painel.</li>
                  <li>Mais clareza para a equipe comercial sobre status e proximos passos.</li>
                  <li>Base pronta para crescer com campanhas, fluxos e novos planos.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="resources-section section-variant-plain" id="recursos" aria-labelledby="titulo-recursos">
            <div className="section-head is-center">
              <div>
                <div className="section-tag">Recursos principais</div>
                <h2 className="section-title" id="titulo-recursos">O que existe dentro da plataforma</h2>
                <p className="section-subtitle">
                  Bloco de recursos para o visitante entender rapidamente o que ele ganha antes de olhar planos.
                </p>
              </div>
            </div>

            <div className="resource-grid" aria-label="Lista de recursos do ZapVender">
              {resourceHighlights.map((resource) => (
                <article className="resource-card" key={resource.title}>
                  <div className="resource-kicker">{resource.subtitle}</div>
                  <h3 className="resource-title">{resource.title}</h3>
                  <p className="resource-desc">{resource.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="journey-section section-variant-right" aria-labelledby="titulo-jornada">
            <div className="journey-layout">
              <div className="journey-copy-pane">
                <div className="section-head">
                  <div>
                    <div className="section-tag">Fluxo de uso</div>
                    <h2 className="section-title" id="titulo-jornada">Como o ZapVender entra na rotina comercial</h2>
                    <p className="section-subtitle">
                      Uma narrativa curta para conectar solucao, recursos e operacao antes de mostrar os planos.
                    </p>
                  </div>
                </div>

                <div className="hero-cta-row" style={{ marginTop: '6px', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="sales-btn sales-btn-outline"
                    onClick={() => scrollToSection('planos-lista')}
                  >
                    Agora ver planos
                  </button>
                  <Link to="/login" className="sales-btn sales-btn-primary">Quero testar</Link>
                </div>
              </div>

              <div className="journey-track">
                <div className="journey-grid journey-grid-timeline" aria-label="Jornada de uso">
                  {journeySteps.map((step) => (
                    <article className="journey-card" key={step.step}>
                      <span className="journey-step">{step.step}</span>
                      <h3 className="journey-title">{step.title}</h3>
                      <p className="journey-text">{step.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="plans-section section-variant-frame" id="planos-lista" aria-labelledby="titulo-planos">
            <div className="section-head is-left">
              <div>
                <h2 className="section-title" id="titulo-planos">Planos</h2>
                <p className="section-subtitle">
                  Estrutura inicial com 1 plano público. Você pode adicionar versões Lite/Equipe/Enterprise depois.
                </p>
              </div>
            </div>

            <div className="plans-grid">
              <article className="plan-card" aria-label="Plano ZapVender Pro">
                <div>
                  <div className="plan-labels">
                    <span className="plan-chip is-highlight">Plano atual</span>
                    <span className="plan-chip">R$297/mês</span>
                  </div>

                  <h3 className="plan-title">ZapVender Pro</h3>
                  <p className="plan-description">
                    Plano principal para vender agora, com posicionamento simples e direto. Reúne os módulos centrais para captar, atender e acompanhar clientes pelo WhatsApp.
                  </p>

                  <ul className="plan-feature-grid">
                    {planFeatures.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="plan-sidebar">
                  <div className="plan-sidebar-price">
                    <strong>{monthlyPrice}</strong>
                    <span>/mês</span>
                  </div>

                  <p className="plan-sidebar-meta">
                    Oferta única para simplificar a decisão de compra no início da operação comercial.
                  </p>

                  <Link to="/login" className="sales-btn sales-btn-primary">Começar com este plano</Link>
                  <Link to="/login" className="sales-btn sales-btn-outline">Entrar no painel</Link>
                </div>
              </article>
            </div>

            <section className="testimonials-section" aria-labelledby="titulo-depoimentos">
              <div className="section-head">
                <div>
                  <h2 className="section-title" id="titulo-depoimentos">Depoimentos (modelo comercial)</h2>
                  <p className="section-subtitle">
                    Bloco pronto para prova social. Substitua pelos relatos reais dos seus clientes quando quiser publicar.
                  </p>
                </div>
              </div>

              <div className="testimonial-grid">
                {testimonials.map((item) => (
                  <article className="testimonial-card" key={`${item.name}-${item.metric}`}>
                    <p className="testimonial-quote">{item.quote}</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-name">{item.name}</div>
                      <div className="testimonial-role">{item.role}</div>
                      <span className="testimonial-metric">{item.metric}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="comparison-section" aria-labelledby="titulo-comparacao">
              <div className="section-head">
                <div>
                  <h2 className="section-title" id="titulo-comparacao">Comparacao de planos (roadmap)</h2>
                  <p className="section-subtitle">
                    Hoje voce vende 1 plano. A comparacao abaixo ja prepara o terreno para tiers futuros.
                  </p>
                </div>
              </div>

              <div className="roadmap-grid" aria-label="Roadmap de planos">
                {planRoadmap.map((plan) => (
                  <article className={`roadmap-card ${plan.badgeClass}`} key={plan.name}>
                    <div className="roadmap-top">
                      <h3 className="roadmap-name">{plan.name}</h3>
                      <span className={`status-badge ${plan.badgeClass}`}>{plan.status}</span>
                    </div>
                    <div className="roadmap-price">{plan.price}</div>
                    <p className="roadmap-desc">{plan.description}</p>
                  </article>
                ))}
              </div>

              <p className="comparison-note">
                Os itens abaixo sao um quadro comercial inicial para comunicacao de posicionamento. Ajuste conforme escopo real, SLA e limites que voce decidir.
              </p>

              <div className="comparison-table-wrap">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Recurso / escopo</th>
                      <th>Pro (atual)</th>
                      <th>Equipe (futuro)</th>
                      <th>Enterprise (futuro)</th>
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
            </section>

            <div className="faq-grid" id="faq-comercial" aria-label="Duvidas frequentes">
              {faqItems.map((item) => (
                <article className="faq-item" key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
            <div className="bottom-cta">
              <div>
                <h3 className="bottom-cta-title">Pronto para publicar e começar a vender</h3>
                <p className="bottom-cta-text">
                  Use esta rota como landing de venda agora e evolua depois com checkout, depoimentos e comparação de planos.
                </p>
              </div>
              <div className="sales-nav-actions">
                <Link to="/login" className="sales-btn sales-btn-outline">Entrar</Link>
                <Link to="/login" className="sales-btn sales-btn-primary">Quero assinar</Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="sales-footer" aria-label="Rodape da pagina de vendas">
          <div className="sales-footer-grid">
            <div className="sales-footer-card">
              <Link to="/planos" className="sales-footer-brand" aria-label={`${brandName} pagina de planos`}>
                <img src={brandLogoUrl} alt="" aria-hidden="true" />
                <span>{brandName}</span>
              </Link>
              <p className="sales-footer-copy">
                Plataforma para organizar atendimento e operacao comercial no WhatsApp com CRM, funil, campanhas e automacoes em um unico painel.
              </p>
              <div className="sales-footer-tags" aria-hidden="true">
                <span className="sales-footer-tag">Inbox</span>
                <span className="sales-footer-tag">CRM</span>
                <span className="sales-footer-tag">Campanhas</span>
                <span className="sales-footer-tag">Automacao</span>
                <span className="sales-footer-tag">Funil</span>
              </div>
            </div>

            <div className="sales-footer-card">
              <h3 className="sales-footer-title">Navegacao rapida</h3>
              <ul className="sales-footer-links">
                <li><button type="button" onClick={() => scrollToSection('visao-geral')}>Visao geral</button></li>
                <li><button type="button" onClick={() => scrollToSection('solucao')}>Solucao</button></li>
                <li><button type="button" onClick={() => scrollToSection('recursos')}>Recursos</button></li>
                <li><button type="button" onClick={() => scrollToSection('planos-lista')}>Planos</button></li>
                <li><button type="button" onClick={() => scrollToSection('faq-comercial')}>FAQ</button></li>
              </ul>
            </div>

            <div className="sales-footer-card">
              <h3 className="sales-footer-title">Comercial</h3>
              <ul className="sales-footer-links">
                <li><Link to="/login">Entrar no painel</Link></li>
                <li><Link to="/login">Assinar / solicitar acesso</Link></li>
                <li><button type="button" onClick={() => scrollToSection('planos-lista')}>Ver plano atual</button></li>
              </ul>
              <p className="sales-footer-copy" style={{ marginTop: '8px' }}>
                Rodape pronto para evoluir com links reais de contato, termos, politica de privacidade e checkout.
              </p>
            </div>
          </div>

          <div className="sales-footer-bottom">
            <span>{`© ${currentYear} ${brandName}. Todos os direitos reservados.`}</span>
            <div className="sales-footer-cta">
              <span>Pronto para continuar?</span>
              <Link to="/login" className="sales-btn sales-btn-outline">Entrar</Link>
              <Link to="/login" className="sales-btn sales-btn-primary">Assinar agora</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
