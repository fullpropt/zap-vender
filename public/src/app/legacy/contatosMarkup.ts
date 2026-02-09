export const contatosMarkup = `
<!-- Mobile Menu Toggle -->
    <button class="mobile-menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active')">☰</button>
    <div class="sidebar-overlay"></div>

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <a href="dashboard.html" class="sidebar-logo">
                <img src="img/logo-self.png" alt="SELF">
                <span>SELF</span>
            </a>
        </div>
        
        <nav class="sidebar-nav">
            <div class="nav-section">
                <ul class="nav-menu">
                    <li class="nav-item"><a href="dashboard.html" class="nav-link"><span class="icon icon-dashboard"></span>Painel de Controle</a></li>
                    <li class="nav-item"><a href="contatos.html" class="nav-link active"><span class="icon icon-contacts"></span>Contatos</a></li>
                    <li class="nav-item"><a href="campanhas.html" class="nav-link"><span class="icon icon-campaigns"></span>Campanhas</a></li>
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

    <!-- Main Content -->
    <main class="main-content">
        <!-- Header -->
        <div class="page-header">
            <div class="page-title">
                <h1><span class="icon icon-contacts icon-sm"></span> Contatos</h1>
                <p>Gerencie todos os seus leads e contatos</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="loadContacts()"><span class="icon icon-refresh icon-sm"></span> Atualizar</button>
                <button class="btn btn-outline" onclick="openModal('importModal')"><span class="icon icon-import icon-sm"></span> Importar</button>
                <button class="btn btn-success" onclick="exportContacts()"><span class="icon icon-export icon-sm"></span> Exportar</button>
                <button class="btn btn-primary" onclick="openModal('addContactModal')"><span class="icon icon-add icon-sm"></span> Novo Contato</button>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon primary"><span class="icon icon-contacts"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="totalContacts">0</div>
                    <div class="stat-label">Total de Contatos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><span class="icon icon-check"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="activeContacts">0</div>
                    <div class="stat-label">Ativos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><span class="icon icon-spark"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="newContacts">0</div>
                    <div class="stat-label">Novos (7 dias)</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info"><span class="icon icon-whatsapp"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="withWhatsapp">0</div>
                    <div class="stat-label">Com WhatsApp</div>
                </div>
            </div>
        </div>

        <!-- Ações em Lote -->
        <div class="card mb-4" id="bulkActions" style="display: none;">
            <div class="card-body" style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <span><strong id="selectedCount">0</strong> contatos selecionados</span>
                <button class="btn btn-sm btn-whatsapp" onclick="bulkSendMessage()"><span class="icon icon-whatsapp icon-sm"></span> Enviar Mensagem</button>
                <button class="btn btn-sm btn-outline" onclick="bulkChangeStatus()"><span class="icon icon-refresh icon-sm"></span> Alterar Status</button>
                <button class="btn btn-sm btn-outline" onclick="bulkAddTag()"><span class="icon icon-tag icon-sm"></span> Adicionar Tag</button>
                <button class="btn btn-sm btn-outline-danger" onclick="bulkDelete()"><span class="icon icon-delete icon-sm"></span> Excluir</button>
                <button class="btn btn-sm btn-outline" onclick="clearSelection()"><span class="icon icon-close icon-sm"></span> Limpar Seleção</button>
            </div>
        </div>

        <!-- Tabela de Contatos -->
        <div class="table-container">
            <div class="table-header">
                <div class="table-title"><span class="icon icon-contacts icon-sm"></span> Lista de Contatos</div>
                <div class="table-filters">
                    <div class="search-box">
                        <span class="search-icon icon icon-search icon-sm"></span>
                        <input type="text" id="searchContacts" placeholder="Buscar..." onkeyup="filterContacts()">
                    </div>
                    <select class="form-select" id="filterStatus" onchange="filterContacts()" style="width: auto;">
                        <option value="">Todos os Status</option>
                        <option value="1">Novo</option>
                        <option value="2">Em Andamento</option>
                        <option value="3">Concluído</option>
                        <option value="4">Perdido</option>
                    </select>
                    <select class="form-select" id="filterTag" onchange="filterContacts()" style="width: auto;">
                        <option value="">Todas as Tags</option>
                    </select>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th><label class="checkbox-wrapper"><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"><span class="checkbox-custom"></span></label></th>
                            <th>Contato</th>
                            <th>WhatsApp</th>
                            <th>Veículo</th>
                            <th>Placa</th>
                            <th>Status</th>
                            <th>Tags</th>
                            <th>Última Interação</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="contactsTableBody">
                        <tr><td colspan="9" class="table-empty"><div class="table-empty-icon icon icon-empty icon-lg"></div><p>Carregando contatos...</p></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
                <span id="paginationInfo">Mostrando 0 de 0 contatos</span>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-sm btn-outline" id="prevPage" onclick="changePage(-1)" disabled>← Anterior</button>
                    <button class="btn btn-sm btn-outline" id="nextPage" onclick="changePage(1)" disabled>Próximo →</button>
                </div>
            </div>
        </div>
    </main>

    <!-- Modal: Adicionar Contato -->
    <div class="modal-overlay" id="addContactModal">
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-add icon-sm"></span> Novo Contato</h3>
                <button class="modal-close" onclick="closeModal('addContactModal')">×</button>
            </div>
            <div class="modal-body">
                <form id="addContactForm">
                    <div class="form-group">
                        <label class="form-label required">Nome Completo</label>
                        <input type="text" class="form-input" id="contactName" required placeholder="Digite o nome">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">WhatsApp</label>
                        <input type="tel" class="form-input" id="contactPhone" required placeholder="27999999999">
                        <p class="form-help">Apenas números com DDD</p>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Veículo</label>
                            <input type="text" class="form-input" id="contactVehicle" placeholder="Ex: Honda Civic 2020">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Placa</label>
                            <input type="text" class="form-input" id="contactPlate" placeholder="ABC1234" style="text-transform: uppercase;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="contactEmail" placeholder="email@exemplo.com">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select class="form-select" id="contactStatus">
                                <option value="1">Novo</option>
                                <option value="2">Em Andamento</option>
                                <option value="3">Concluído</option>
                                <option value="4">Perdido</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Origem</label>
                            <select class="form-select" id="contactSource">
                                <option value="manual">Manual</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="site">Site</option>
                                <option value="indicacao">Indicação</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Observações</label>
                        <textarea class="form-textarea" id="contactNotes" rows="3" placeholder="Anotações sobre o contato..."></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('addContactModal')">Cancelar</button>
                <button class="btn btn-primary" onclick="saveContact()">Salvar Contato</button>
            </div>
        </div>
    </div>

    <!-- Modal: Editar Contato -->
    <div class="modal-overlay" id="editContactModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-edit icon-sm"></span> Editar Contato</h3>
                <button class="modal-close" onclick="closeModal('editContactModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('info')"><span class="icon icon-info icon-sm"></span> Informações</button>
                    <button class="tab" onclick="switchTab('history')"><span class="icon icon-clock icon-sm"></span> Histórico</button>
                    <button class="tab" onclick="switchTab('messages')"><span class="icon icon-message icon-sm"></span> Mensagens</button>
                </div>
                
                <div class="tab-content active" id="tab-info">
                    <form id="editContactForm">
                        <input type="hidden" id="editContactId">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Nome</label>
                                <input type="text" class="form-input" id="editContactName" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">WhatsApp</label>
                                <input type="tel" class="form-input" id="editContactPhone" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Veículo</label>
                                <input type="text" class="form-input" id="editContactVehicle">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Placa</label>
                                <input type="text" class="form-input" id="editContactPlate">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input" id="editContactEmail">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select class="form-select" id="editContactStatus">
                                    <option value="1">Novo</option>
                                    <option value="2">Em Andamento</option>
                                    <option value="3">Concluído</option>
                                    <option value="4">Perdido</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Observações</label>
                            <textarea class="form-textarea" id="editContactNotes" rows="3"></textarea>
                        </div>
                    </form>
                </div>
                
                <div class="tab-content" id="tab-history">
                    <div id="contactHistory" class="empty-state">
                        <div class="empty-state-icon icon icon-clock icon-lg"></div>
                        <p>Nenhum histórico disponível</p>
                    </div>
                </div>
                
                <div class="tab-content" id="tab-messages">
                    <div id="contactMessages" class="empty-state">
                        <div class="empty-state-icon icon icon-message icon-lg"></div>
                        <p>Nenhuma mensagem trocada</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('editContactModal')">Cancelar</button>
                <button class="btn btn-whatsapp" onclick="openWhatsApp()"><span class="icon icon-whatsapp icon-sm"></span> WhatsApp</button>
                <button class="btn btn-primary" onclick="updateContact()">Salvar Alterações</button>
            </div>
        </div>
    </div>

    <!-- Modal: Importar -->
    <div class="modal-overlay" id="importModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-import icon-sm"></span> Importar Contatos</h3>
                <button class="modal-close" onclick="closeModal('importModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Arquivo CSV</label>
                    <input type="file" class="form-input" id="importFile" accept=".csv,.txt">
                    <p class="form-help">Colunas: nome, telefone, veiculo, placa, email</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Ou cole os dados</label>
                    <textarea class="form-textarea" id="importText" rows="8" placeholder="nome,telefone,veiculo,placa
João Silva,27999999999,Honda Civic,ABC1234"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Status inicial</label>
                    <select class="form-select" id="importStatus">
                        <option value="1">Novo</option>
                        <option value="2">Em Andamento</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('importModal')">Cancelar</button>
                <button class="btn btn-primary" onclick="importContacts()">Importar</button>
            </div>
        </div>
    </div>

    <!-- Modal: Enviar Mensagem em Lote -->
    <div class="modal-overlay" id="bulkMessageModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-whatsapp icon-sm"></span> Enviar Mensagem em Lote</h3>
                <button class="modal-close" onclick="closeModal('bulkMessageModal')">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Destinatários</label>
                    <p class="text-muted"><span id="bulkRecipients">0</span> contatos selecionados</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Template</label>
                    <select class="form-select" id="bulkTemplate" onchange="loadTemplate()">
                        <option value="">Selecione um template...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label required">Mensagem</label>
                    <textarea class="form-textarea" id="bulkMessage" rows="5" placeholder="Digite a mensagem...
Use {{nome}} para personalizar"></textarea>
                    <p class="form-help">Variáveis: {{nome}}, {{veiculo}}, {{placa}}</p>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Intervalo entre mensagens</label>
                        <select class="form-select" id="bulkDelay">
                            <option value="3000">3 segundos</option>
                            <option value="5000" selected>5 segundos</option>
                            <option value="10000">10 segundos</option>
                            <option value="30000">30 segundos</option>
                            <option value="60000">1 minuto</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Início</label>
                        <select class="form-select" id="bulkStart">
                            <option value="now">Imediatamente</option>
                            <option value="scheduled">Agendar</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('bulkMessageModal')">Cancelar</button>
                <button class="btn btn-whatsapp" onclick="sendBulkMessage()"><span class="icon icon-whatsapp icon-sm"></span> Enviar para Todos</button>
            </div>
        </div>
    </div>
`;
