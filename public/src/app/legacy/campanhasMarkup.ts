export const campanhasMarkup = `
<style>

        .campaign-card {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .campaign-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
        }
        .campaign-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .campaign-title {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 5px;
        }
        .campaign-date {
            font-size: 12px;
            color: var(--gray-500);
        }
        .campaign-body {
            padding: 20px;
        }
        .campaign-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .campaign-stat {
            text-align: center;
            padding: 10px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
        }
        .campaign-stat-value {
            font-size: 20px;
            font-weight: 700;
        }
        .campaign-stat-label {
            font-size: 11px;
            color: var(--gray-500);
            text-transform: uppercase;
        }
        .campaign-progress {
            margin-top: 15px;
        }
        .campaign-footer {
            padding: 15px 20px;
            background: var(--gray-50);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .campaigns-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
    
</style>
<button class="mobile-menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active')">☰</button>
    <div class="sidebar-overlay"></div>

    <aside class="sidebar">
        <div class="sidebar-header">
            <a href="dashboard.html" class="sidebar-logo">
                <img src="img/logo-self.png" alt="SELF"><span>SELF</span>
            </a>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-section">
                <ul class="nav-menu">
                    <li class="nav-item"><a href="dashboard.html" class="nav-link"><span class="icon icon-dashboard"></span>Painel de Controle</a></li>
                    <li class="nav-item"><a href="contatos.html" class="nav-link"><span class="icon icon-contacts"></span>Contatos</a></li>
                    <li class="nav-item"><a href="campanhas.html" class="nav-link active"><span class="icon icon-campaigns"></span>Campanhas</a></li>
                    <li class="nav-item"><a href="transmissao.html" class="nav-link"><span class="icon icon-broadcast"></span>Transmissão</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Conversas</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="inbox.html" class="nav-link"><span class="icon icon-inbox"></span>Inbox<span class="badge" style="display:none;">0</span></a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Automação</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="automacao.html" class="nav-link"><span class="icon icon-automation"></span>Automação</a></li>
                    <li class="nav-item"><a href="fluxos.html" class="nav-link"><span class="icon icon-flows"></span>Fluxos de Conversa</a></li>
                    <li class="nav-item"><a href="funil.html" class="nav-link"><span class="icon icon-funnel"></span>Funil de Vendas</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Sistema</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="whatsapp.html" class="nav-link"><span class="icon icon-whatsapp"></span>WhatsApp</a></li>
                    <li class="nav-item"><a href="configuracoes.html" class="nav-link"><span class="icon icon-settings"></span>Configurações</a></li>
                </ul>
            </div>
        </nav>
        <div class="sidebar-footer">
            <div class="whatsapp-status">
                <span class="status-indicator disconnected"></span>
                <span class="whatsapp-status-text">Desconectado</span>
            </div>
            <button class="btn-logout" onclick="logout()">Sair</button>
        </div>
    </aside>

    <main class="main-content">
        <div class="page-header">
            <div class="page-title">
                <h1><span class="icon icon-campaigns icon-sm"></span> Campanhas</h1>
                <p>Gerencie suas campanhas de marketing</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="loadCampaigns()"><span class="icon icon-refresh icon-sm"></span> Atualizar</button>
                <button class="btn btn-primary" onclick="openModal('newCampaignModal')"><span class="icon icon-add icon-sm"></span> Nova Campanha</button>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon primary"><span class="icon icon-campaigns"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="totalCampaigns">0</div>
                    <div class="stat-label">Total de Campanhas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><span class="icon icon-check"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="activeCampaigns">0</div>
                    <div class="stat-label">Ativas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info"><span class="icon icon-export"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="totalSent">0</div>
                    <div class="stat-label">Mensagens Enviadas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><span class="icon icon-chart-bar"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="avgResponse">0%</div>
                    <div class="stat-label">Taxa de Resposta</div>
                </div>
            </div>
        </div>

        <!-- Lista de Campanhas -->
        <div class="campaigns-grid" id="campaignsList">
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Carregando campanhas...</p>
            </div>
        </div>
    </main>

    <!-- Modal: Nova Campanha -->
    <div class="modal-overlay" id="newCampaignModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-add icon-sm"></span> Nova Campanha</h3>
                <button class="modal-close" onclick="closeModal('newCampaignModal')">×</button>
            </div>
            <div class="modal-body">
                <form id="campaignForm">
                    <div class="form-group">
                        <label class="form-label required">Nome da Campanha</label>
                        <input type="text" class="form-input" id="campaignName" required placeholder="Ex: Promoção Janeiro">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Descrição</label>
                        <textarea class="form-textarea" id="campaignDescription" rows="2" placeholder="Descreva o objetivo da campanha"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Tipo</label>
                            <select class="form-select" id="campaignType">
                                <option value="broadcast">Transmissão Única</option>
                                <option value="drip">Sequência (Drip)</option>
                                <option value="trigger">Gatilho</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select class="form-select" id="campaignStatus">
                                <option value="draft">Rascunho</option>
                                <option value="active">Ativa</option>
                                <option value="paused">Pausada</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Segmentação</label>
                        <select class="form-select" id="campaignSegment">
                            <option value="all">Todos os Contatos</option>
                            <option value="new">Novos (Etapa 1)</option>
                            <option value="progress">Em Andamento (Etapa 2)</option>
                            <option value="concluded">Concluídos (Etapa 3)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Mensagem</label>
                        <textarea class="form-textarea" id="campaignMessage" rows="5" placeholder="Digite a mensagem da campanha...

Variáveis disponíveis:
{{nome}} - Nome do contato
{{veiculo}} - Veículo
{{placa}} - Placa"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Intervalo entre envios</label>
                            <select class="form-select" id="campaignDelay">
                                <option value="3000">3 segundos</option>
                                <option value="5000" selected>5 segundos</option>
                                <option value="10000">10 segundos</option>
                                <option value="30000">30 segundos</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Início</label>
                            <input type="datetime-local" class="form-input" id="campaignStart">
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('newCampaignModal')">Cancelar</button>
                <button class="btn btn-outline" onclick="saveCampaign('draft')"><span class="icon icon-save icon-sm"></span> Salvar Rascunho</button>
                <button class="btn btn-primary" onclick="saveCampaign('active')"><span class="icon icon-rocket icon-sm"></span> Criar e Ativar</button>
            </div>
        </div>
    </div>

    <!-- Modal: Detalhes da Campanha -->
    <div class="modal-overlay" id="campaignDetailsModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title" id="detailsTitle"><span class="icon icon-campaigns icon-sm"></span> Detalhes da Campanha</h3>
                <button class="modal-close" onclick="closeModal('campaignDetailsModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="tabs">
                    <button class="tab active" onclick="switchCampaignTab('overview')"><span class="icon icon-chart-bar icon-sm"></span> Visão Geral</button>
                    <button class="tab" onclick="switchCampaignTab('messages')"><span class="icon icon-message icon-sm"></span> Mensagens</button>
                    <button class="tab" onclick="switchCampaignTab('recipients')"><span class="icon icon-contacts icon-sm"></span> Destinatários</button>
                </div>
                
                <div class="tab-content active" id="tab-overview">
                    <div id="campaignOverview"></div>
                </div>
                
                <div class="tab-content" id="tab-messages">
                    <div id="campaignMessages"></div>
                </div>
                
                <div class="tab-content" id="tab-recipients">
                    <div id="campaignRecipients"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('campaignDetailsModal')">Fechar</button>
                <button class="btn btn-primary" id="campaignActionBtn"><span class="icon icon-play icon-sm"></span> Iniciar</button>
            </div>
        </div>
    </div>
`;
