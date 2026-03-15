import './platform-mock.css';

type MockStat = {
  value: string;
  label: string;
};

type PlatformMockProps = {
  viewLabel: string;
  stats: [MockStat, MockStat] | MockStat[];
  primaryItems: string[];
  secondaryItems: string[];
};

const sidebarItems = [
  'Dashboard',
  'Inbox operacional',
  'CRM e contatos',
  'Campanhas',
  'Automacoes'
];

const dashboardSidebarItems = [
  'Painel de Controle',
  'Contatos',
  'Campanhas',
  'Inbox',
  'Funil de Vendas'
];

const recentLeads = [
  { name: 'Carlos M.', source: 'WhatsApp', status: 'Ativo' },
  { name: 'Juliana R.', source: 'Campanha', status: 'Online' },
  { name: 'Rafael S.', source: 'Formulario', status: 'Sync' }
];

const dashboardEvents = [
  { name: 'lead_qualificado', volume: '128 disparos', status: 'Ativo' },
  { name: 'retorno_em_24h', volume: '64 disparos', status: 'Ativo' }
];

const dashboardFunnelStages = [
  { stage: 'Etapa 1', percent: 100 },
  { stage: 'Etapa 2', percent: 58 },
  { stage: 'Concluido', percent: 21 }
];

const dashboardRecentLeads = [
  { name: 'Carlos M.', channel: 'WhatsApp', status: 'Em andamento' },
  { name: 'Juliana R.', channel: 'Campanha', status: 'Concluido' }
];

function safeStat(stats: [MockStat, MockStat] | MockStat[], index: number, fallback: MockStat): MockStat {
  if (index < stats.length) return stats[index];
  return fallback;
}

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function PlatformMock({ viewLabel, stats, primaryItems, secondaryItems }: PlatformMockProps) {
  const isDashboardView = normalizeLabel(viewLabel) === 'dashboard';
  const statA = safeStat(stats, 0, { value: '674', label: 'Total de leads' });
  const statB = safeStat(stats, 1, { value: '25', label: 'Novos contatos hoje' });
  const featuredModule = primaryItems[0] ?? 'Inbox operacional';
  const sidebarNavItems = isDashboardView ? dashboardSidebarItems : sidebarItems;
  const activeSidebarIndex = isDashboardView ? 0 : 1;
  const topbarLabel = isDashboardView ? 'Painel de Controle' : viewLabel;

  return (
    <div className="platform-mock" role="presentation" aria-hidden="true">
      <div className="platform-mock__aura" />

      <div className="platform-mock__frame">
        <aside className="platform-mock__sidebar">
          <div className="platform-mock__brand">
            <span className="platform-mock__brand-dot" />
            <strong>ZapVender</strong>
          </div>

          <div className={`platform-mock__sidebar-list ${isDashboardView ? 'is-dashboard' : ''}`}>
            {sidebarNavItems.map((item, index) => (
              <div
                key={item}
                className={`platform-mock__sidebar-item ${index === activeSidebarIndex ? 'is-current' : ''}`}
              >
                <span className={`platform-mock__icon platform-mock__icon--${(index % 5) + 1}`} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="platform-mock__sidebar-footer">
            <span className="platform-mock__pill">{isDashboardView ? 'Total de leads: 674' : '128 leads'}</span>
            <span className="platform-mock__pill">{isDashboardView ? 'Conversao: 21%' : '6 modulos ativos'}</span>
          </div>
        </aside>

        <section className="platform-mock__panel">
          <header className="platform-mock__topbar">
            <div className="platform-mock__search">
              <span>{topbarLabel}</span>
            </div>
            <div className="platform-mock__status-list">
              {isDashboardView ? (
                <>
                  <span className="platform-mock__status is-active">Conectado</span>
                  <span className="platform-mock__status is-online">Online</span>
                </>
              ) : (
                <>
                  <span className="platform-mock__status is-active">Ativo</span>
                  <span className="platform-mock__status is-online">Online</span>
                  <span className="platform-mock__status is-sync">Sincronizado</span>
                </>
              )}
            </div>
          </header>

          {isDashboardView ? (
            <>
              <div className="platform-mock__metrics platform-mock__metrics--dashboard">
                <article className="platform-mock__metric">
                  <strong>{statA.value}</strong>
                  <span>Total de Leads</span>
                </article>
                <article className="platform-mock__metric">
                  <strong>{statB.value}</strong>
                  <span>Novos contatos</span>
                </article>
                <article className="platform-mock__metric">
                  <strong>21%</strong>
                  <span>Conversao</span>
                </article>
              </div>

              <div className="platform-mock__workspace platform-mock__workspace--dashboard">
                <article className="platform-mock__module platform-mock__module--featured">
                  <div className="platform-mock__module-head">
                    <span className="platform-mock__module-badge">Estatisticas por periodo</span>
                    <span className="platform-mock__module-count">Ultimos 30 dias</span>
                  </div>
                  <h4>Painel de crescimento comercial</h4>

                  <div className="platform-mock__chart-meta">Novos contatos por periodo</div>

                  <div className="platform-mock__chart-grid">
                    <span className="w1" />
                    <span className="w2" />
                    <span className="w3" />
                    <span className="w4" />
                    <span className="w5" />
                    <span className="w6" />
                    <span className="w7" />
                  </div>

                  <div className="platform-mock__chart-axis">
                    <small>01</small>
                    <small>10</small>
                    <small>20</small>
                    <small>30</small>
                  </div>
                </article>

                <div className="platform-mock__stack">
                  <article className="platform-mock__module">
                    <div className="platform-mock__module-head">
                      <span className="platform-mock__module-badge">Eventos personalizados</span>
                      <span className="platform-mock__module-count">2 ativos</span>
                    </div>

                    <div className="platform-mock__event-list">
                      {dashboardEvents.map((event) => (
                        <div className="platform-mock__event-row" key={event.name}>
                          <div>
                            <strong>{event.name}</strong>
                            <span>{event.volume}</span>
                          </div>
                          <span
                            className={`platform-mock__event-status ${
                              event.status === 'Ativo' ? 'is-active' : 'is-inactive'
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="platform-mock__module">
                    <div className="platform-mock__module-head">
                      <span className="platform-mock__module-badge">Funil de Conversao</span>
                      <span className="platform-mock__module-count">Visao atual</span>
                    </div>

                    <div className="platform-mock__funnel-list">
                      {dashboardFunnelStages.map((stage) => (
                        <div className="platform-mock__funnel-row" key={stage.stage}>
                          <div className="platform-mock__funnel-head">
                            <strong>{stage.stage}</strong>
                            <span>{stage.percent}%</span>
                          </div>
                          <div className="platform-mock__progress">
                            <span style={{ width: `${stage.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>

              <div className="platform-mock__footer platform-mock__footer--table">
                <article className="platform-mock__footer-card platform-mock__footer-card--table">
                  <div className="platform-mock__table-head">
                    <strong>Leads Recentes</strong>
                    <span>Todos os status</span>
                  </div>

                  <div className="platform-mock__table-list">
                    {dashboardRecentLeads.map((lead) => (
                      <div className="platform-mock__table-row" key={lead.name}>
                        <div className="platform-mock__table-id">
                          <span className="platform-mock__avatar" />
                          <div>
                            <strong>{lead.name}</strong>
                            <span>{lead.channel}</span>
                          </div>
                        </div>
                        <span className="platform-mock__lead-status">{lead.status}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </>
          ) : (
            <>
              <div className="platform-mock__metrics">
                <article className="platform-mock__metric">
                  <strong>{statA.value}</strong>
                  <span>{statA.label}</span>
                </article>
                <article className="platform-mock__metric">
                  <strong>{statB.value}</strong>
                  <span>{statB.label}</span>
                </article>
                <article className="platform-mock__metric">
                  <strong>6</strong>
                  <span>Modulos ativos</span>
                </article>
              </div>

              <div className="platform-mock__workspace">
                <article className="platform-mock__module platform-mock__module--featured">
                  <div className="platform-mock__module-head">
                    <span className="platform-mock__module-badge">Inbox operacional</span>
                    <span className="platform-mock__module-count">Atualizado agora</span>
                  </div>
                  <h4>{featuredModule}</h4>
                  <div className="platform-mock__lead-list">
                    {recentLeads.map((lead) => (
                      <div className="platform-mock__lead-row" key={lead.name}>
                        <div className="platform-mock__lead-id">
                          <span className="platform-mock__avatar" />
                          <div>
                            <strong>{lead.name}</strong>
                            <span>{lead.source}</span>
                          </div>
                        </div>
                        <span className="platform-mock__lead-status">{lead.status}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="platform-mock__stack">
                  {primaryItems.slice(1, 3).map((item) => (
                    <article className="platform-mock__module" key={`left-${item}`}>
                      <div className="platform-mock__module-head">
                        <span className="platform-mock__module-badge">Modulo</span>
                        <span className="platform-mock__module-count">OK</span>
                      </div>
                      <h4>{item}</h4>
                      <div className="platform-mock__progress">
                        <span />
                      </div>
                    </article>
                  ))}
                  {secondaryItems.slice(0, 1).map((item) => (
                    <article className="platform-mock__module" key={`right-${item}`}>
                      <div className="platform-mock__module-head">
                        <span className="platform-mock__module-badge">Monitoramento</span>
                        <span className="platform-mock__module-count">Online</span>
                      </div>
                      <h4>{item}</h4>
                      <div className="platform-mock__progress">
                        <span />
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="platform-mock__footer">
                {secondaryItems.slice(1, 3).map((item) => (
                  <article className="platform-mock__footer-card" key={item}>
                    <span>{item}</span>
                    <div className="platform-mock__spark">
                      <i />
                      <i />
                      <i className="is-highlight" />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
