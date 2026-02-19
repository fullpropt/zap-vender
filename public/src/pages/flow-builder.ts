// Flow builder page logic migrated to module

// Estado do construtor
type NodeType = 'trigger' | 'message' | 'wait' | 'condition' | 'delay' | 'transfer' | 'tag' | 'status' | 'webhook' | 'end';
type NodeData = {
    label: string;
    keyword?: string;
    content?: string;
    timeout?: number;
    conditions?: Array<{ value: string; next?: string }>;
    seconds?: number;
    message?: string;
    tag?: string;
    status?: number;
    url?: string;
};

type FlowNode = {
    id: string;
    type: NodeType;
    subtype?: string;
    position: { x: number; y: number };
    data: NodeData;
};

type Edge = { source: string; target: string };

type FlowSummary = {
    id: number;
    name: string;
    trigger_type?: string;
    nodes?: FlowNode[];
    is_active?: boolean;
};

let nodes: FlowNode[] = [];
let edges: Edge[] = [];
let selectedNode: FlowNode | null = null;
let currentFlowId: number | null = null;
let zoom = 1;
let pan = { x: 0, y: 0 };
let isDragging = false;
let dragNode: FlowNode | null = null;
let dragOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOrigin = { x: 0, y: 0 };
let isConnecting = false;
let connectionStart: { nodeId: string; portType: string } | null = null;
let connectionStartPort: HTMLElement | null = null;
let connectionPreviewPath: SVGPathElement | null = null;
let lastPointer = { x: 0, y: 0 };
let hasInitialized = false;

function getSessionToken() {
    return sessionStorage.getItem('selfDashboardToken');
}

function buildAuthHeaders(includeJson = false): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

// Inicializacao
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function initFlowBuilder() {
    if (hasInitialized) return;
    hasInitialized = true;

    setupDragAndDrop();
    setupCanvasEvents();
    applyZoom();
    openFlowsModal();
}

onReady(initFlowBuilder);

// Configurar drag and drop dos nos
function setupDragAndDrop() {
    const nodeItems = document.querySelectorAll('.node-item');
    const canvas = document.getElementById('canvasContainer') as HTMLElement | null;
    if (!canvas) return;
    
    nodeItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('nodeType', item.dataset.type || '');
            e.dataTransfer?.setData('nodeSubtype', item.dataset.subtype || '');
        });
    });
    
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer?.getData('nodeType') || '';
        const subtype = e.dataTransfer?.getData('nodeSubtype') || '';
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        
        addNode(type as NodeType, subtype, x, y);
    });
}

// Configurar eventos do canvas
function setupCanvasEvents() {
    const canvas = document.getElementById('flowCanvas') as HTMLElement | null;
    if (!canvas) return;
    
    canvas.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target === canvas || target?.id === 'canvasContainer') {
            deselectNode();
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;
        startPan(e.clientX, e.clientY, canvas);
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(zoom + delta);
    }, { passive: false });

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
}

// Adicionar no
function addNode(type: NodeType, subtype: string, x: number, y: number) {
    const emptyCanvas = document.getElementById('emptyCanvas') as HTMLElement | null;
    if (emptyCanvas) emptyCanvas.style.display = 'none';
    
    const id = 'node_' + Date.now();
    const node: FlowNode = {
        id,
        type,
        subtype,
        position: { x, y },
        data: getDefaultNodeData(type, subtype)
    };
    
    nodes.push(node);
    renderNode(node);
    selectNode(id);
}

// Dados padrao do no
function getDefaultNodeData(type: NodeType, subtype?: string): NodeData {
    const defaults = {
        trigger: { label: subtype === 'keyword' ? 'Palavra-chave' : 'Novo Contato', keyword: '' },
        message: { label: 'Mensagem', content: 'Olá! Como posso ajudar?' },
        wait: { label: 'Aguardar Resposta', timeout: 300 },
        condition: { label: 'Condição', conditions: [] },
        delay: { label: 'Delay', seconds: 5 },
        transfer: { label: 'Transferir', message: 'Transferindo para um atendente...' },
        tag: { label: 'Adicionar Tag', tag: '' },
        status: { label: 'Alterar Status', status: 2 },
        webhook: { label: 'Webhook', url: '' },
        end: { label: 'Fim' }
    };
    return defaults[type] || { label: type };
}

// Renderizar no
function renderNode(node: FlowNode) {
    const container = document.getElementById('canvasContainer') as HTMLElement | null;
    if (!container) return;
    
    const nodeEl = document.createElement('div');
    nodeEl.className = 'flow-node';
    nodeEl.id = node.id;
    nodeEl.style.left = node.position.x + 'px';
    nodeEl.style.top = node.position.y + 'px';
    
    const icons = {
        trigger: 'icon-bolt',
        message: 'icon-message',
        wait: 'icon-clock',
        condition: 'icon-bolt',
        delay: 'icon-clock',
        transfer: 'icon-user',
        tag: 'icon-tag',
        status: 'icon-chart-bar',
        webhook: 'icon-link',
        end: 'icon-check'
    };
    
    nodeEl.innerHTML = `
        <div class="flow-node-header ${node.type}">
            <span class="icon ${icons[node.type] || 'icon-empty'}"></span>
            <span class="title">${node.data.label}</span>
            <button class="delete-btn" onclick="deleteNode('${node.id}')">&times;</button>
        </div>
        <div class="flow-node-body">
            ${getNodePreview(node)}
        </div>
        <div class="flow-node-ports">
            ${node.type !== 'trigger' ? '<div class="port input" data-port="input"></div>' : '<div></div>'}
            ${node.type !== 'end' ? '<div class="port output" data-port="output"></div>' : '<div></div>'}
        </div>
    `;
    
    // Eventos de arrastar
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('port')) {
            e.preventDefault();
            e.stopPropagation();
            startConnection(node.id, target.dataset.port || '');
            return;
        }
        if (target?.classList.contains('delete-btn')) return;
        
        isDragging = true;
        dragNode = node;
        const rect = nodeEl.getBoundingClientRect();
        dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        selectNode(node.id);
    });
    
    container.appendChild(nodeEl);
}

function startPan(clientX: number, clientY: number, canvas: HTMLElement) {
    if (isConnecting) {
        cancelConnection();
    }

    isPanning = true;
    panStart = { x: clientX, y: clientY };
    panOrigin = { ...pan };
    canvas.classList.add('is-panning');
}

function stopPan() {
    isPanning = false;
    const canvas = document.getElementById('flowCanvas') as HTMLElement | null;
    canvas?.classList.remove('is-panning');
}

function handleDocumentMouseMove(e: MouseEvent) {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;

    if (isPanning) {
        pan.x = panOrigin.x + (e.clientX - panStart.x);
        pan.y = panOrigin.y + (e.clientY - panStart.y);
        applyZoom();
        return;
    }

    if (isDragging && dragNode) {
        const canvas = document.getElementById('canvasContainer') as HTMLElement | null;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        dragNode.position.x = (e.clientX - rect.left - dragOffset.x) / zoom;
        dragNode.position.y = (e.clientY - rect.top - dragOffset.y) / zoom;

        const nodeEl = document.getElementById(dragNode.id) as HTMLElement | null;
        if (nodeEl) {
            nodeEl.style.left = dragNode.position.x + 'px';
            nodeEl.style.top = dragNode.position.y + 'px';
        }

        renderConnections();
    }

    if (isConnecting) {
        updateConnectionPreview(e.clientX, e.clientY);
        highlightConnectionTarget(e.clientX, e.clientY);
    }
}

function handleDocumentMouseUp(e: MouseEvent) {
    isDragging = false;
    dragNode = null;

    if (isPanning) {
        stopPan();
    }

    if (!isConnecting || !connectionStart) return;

    const target = e.target instanceof Element ? e.target : null;
    const targetPort = target?.closest('.port.input') as HTMLElement | null;
    const targetNode = targetPort?.closest('.flow-node') as HTMLElement | null;

    if (targetPort && targetNode?.id) {
        endConnection(targetNode.id, targetPort.dataset.port || '');
        return;
    }

    cancelConnection();
}

// Preview do no
function getNodePreview(node: FlowNode) {
    switch (node.type) {
        case 'message':
            return node.data.content?.substring(0, 50) + (node.data.content?.length > 50 ? '...' : '') || 'Clique para editar';
        case 'condition':
            return `${node.data.conditions?.length || 0} condições`;
        case 'delay':
            return `Aguardar ${node.data.seconds}s`;
        case 'trigger':
            return node.subtype === 'keyword' ? `Palavra: ${node.data.keyword || '...'}` : 'Novo contato';
        default:
            return '';
    }
}

// Selecionar no
function selectNode(id: string) {
    deselectNode();
    selectedNode = nodes.find(n => n.id === id);
    
    const nodeEl = document.getElementById(id);
    if (nodeEl) nodeEl.classList.add('selected');
    
    renderProperties();
}

// Deselecionar no
function deselectNode() {
    if (selectedNode) {
        const nodeEl = document.getElementById(selectedNode.id);
        if (nodeEl) nodeEl.classList.remove('selected');
    }
    selectedNode = null;
    const propertiesContent = document.getElementById('propertiesContent') as HTMLElement | null;
    if (propertiesContent) {
        propertiesContent.innerHTML = '<p style="color: var(--gray); font-size: 14px;">Selecione um bloco para editar suas propriedades</p>';
    }
}

// Deletar no
function deleteNode(id: string) {
    if (connectionStart?.nodeId === id) {
        cancelConnection();
    }

    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.source !== id && e.target !== id);
    
    const nodeEl = document.getElementById(id);
    if (nodeEl) nodeEl.remove();
    
    if (selectedNode?.id === id) {
        deselectNode();
    }
    
    renderConnections();
    
    if (nodes.length === 0) {
        const emptyCanvas = document.getElementById('emptyCanvas') as HTMLElement | null;
        if (emptyCanvas) emptyCanvas.style.display = 'block';
    }
}

// Renderizar propriedades
function renderProperties() {
    if (!selectedNode) return;
    
    const container = document.getElementById('propertiesContent') as HTMLElement | null;
    if (!container) return;
    let html = '';
    
    html += `
        <div class="property-group">
            <label>Nome do Bloco</label>
            <input type="text" value="${selectedNode.data.label}" onchange="updateNodeProperty('label', this.value)">
        </div>
    `;
    
    switch (selectedNode.type) {
        case 'trigger':
            if (selectedNode.subtype === 'keyword') {
                html += `
                    <div class="property-group">
                        <label>Palavra-chave</label>
                        <input type="text" value="${selectedNode.data.keyword || ''}" onchange="updateNodeProperty('keyword', this.value)" placeholder="Ex: oi, olá, cotação">
                        <div class="hint">Separe múltiplas palavras por vírgula</div>
                    </div>
                `;
            }
            break;
            
        case 'message':
            html += `
                <div class="property-group">
                    <label>Conteúdo da Mensagem</label>
                    <textarea id="messageContent" onchange="updateNodeProperty('content', this.value)">${selectedNode.data.content || ''}</textarea>
                    <div class="hint">Use {{nome}}, {{telefone}}, etc. para personalizar</div>
                </div>
            `;
            break;
            
        case 'wait':
            html += `
                <div class="property-group">
                    <label>Timeout (segundos)</label>
                    <input type="number" value="${selectedNode.data.timeout || 300}" onchange="updateNodeProperty('timeout', parseInt(this.value))">
                    <div class="hint">Tempo máximo de espera pela resposta</div>
                </div>
            `;
            break;
            
        case 'condition':
            html += `
                <div class="property-group">
                    <label>Condições</label>
                    <div class="conditions-editor" id="conditionsEditor">
                        ${(selectedNode.data.conditions || []).map((c, i) => `
                            <div class="condition-row">
                                <input type="text" value="${c.value}" placeholder="Valor" onchange="updateCondition(${i}, 'value', this.value)">
                                <button class="remove-btn" onclick="removeCondition(${i})">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-condition-btn" onclick="addCondition()">+ Adicionar Condição</button>
                </div>
            `;
            break;
            
        case 'delay':
            html += `
                <div class="property-group">
                    <label>Tempo de Espera (segundos)</label>
                    <input type="number" value="${selectedNode.data.seconds || 5}" onchange="updateNodeProperty('seconds', parseInt(this.value))">
                </div>
            `;
            break;
            
        case 'transfer':
            html += `
                <div class="property-group">
                    <label>Mensagem de Transferência</label>
                    <textarea onchange="updateNodeProperty('message', this.value)">${selectedNode.data.message || ''}</textarea>
                </div>
            `;
            break;
            
        case 'tag':
            html += `
                <div class="property-group">
                    <label>Nome da Tag</label>
                    <input type="text" value="${selectedNode.data.tag || ''}" onchange="updateNodeProperty('tag', this.value)">
                </div>
            `;
            break;
            
        case 'status':
            html += `
                <div class="property-group">
                    <label>Novo Status</label>
                    <select onchange="updateNodeProperty('status', parseInt(this.value))">
                        <option value="1" ${selectedNode.data.status === 1 ? 'selected' : ''}>Etapa 1 - Novo</option>
                        <option value="2" ${selectedNode.data.status === 2 ? 'selected' : ''}>Etapa 2 - Em Negociação</option>
                        <option value="3" ${selectedNode.data.status === 3 ? 'selected' : ''}>Etapa 3 - Fechado</option>
                        <option value="4" ${selectedNode.data.status === 4 ? 'selected' : ''}>Etapa 4 - Perdido</option>
                    </select>
                </div>
            `;
            break;
            
        case 'webhook':
            html += `
                <div class="property-group">
                    <label>URL do Webhook</label>
                    <input type="url" value="${selectedNode.data.url || ''}" onchange="updateNodeProperty('url', this.value)" placeholder="https://...">
                </div>
            `;
            break;
    }
    
    container.innerHTML = html;
}

// Atualizar propriedade do no
function updateNodeProperty(key: keyof NodeData, value: any) {
    if (!selectedNode) return;
    
    selectedNode.data[key] = value;
    
    // Atualizar visual
    const nodeEl = document.getElementById(selectedNode.id);
    if (nodeEl) {
        const title = nodeEl.querySelector('.title') as HTMLElement | null;
        const body = nodeEl.querySelector('.flow-node-body') as HTMLElement | null;
        if (title) title.textContent = selectedNode.data.label;
        if (body) body.innerHTML = getNodePreview(selectedNode);
    }
}

// Condicoes
function addCondition() {
    if (!selectedNode || selectedNode.type !== 'condition') return;
    
    if (!selectedNode.data.conditions) {
        selectedNode.data.conditions = [];
    }
    
    selectedNode.data.conditions.push({ value: '', next: '' });
    renderProperties();
}

function updateCondition(index: number, key: 'value' | 'next', value: string) {
    if (!selectedNode) return;
    selectedNode.data.conditions[index][key] = value;
}

function removeCondition(index: number) {
    if (!selectedNode) return;
    selectedNode.data.conditions.splice(index, 1);
    renderProperties();
}

// Inserir variavel
function insertVariable(variable: string) {
    const textarea = document.getElementById('messageContent') as HTMLTextAreaElement | null;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + `{{${variable}}}` + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
        updateNodeProperty('content', textarea.value);
    }
}

// Conexoes
function startConnection(nodeId: string, portType: string) {
    if (portType !== 'output') return;

    const sourceNode = document.getElementById(nodeId);
    const sourcePort = sourceNode?.querySelector('.port.output') as HTMLElement | null;
    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!sourcePort || !svg) return;

    cancelConnection();

    isConnecting = true;
    connectionStart = { nodeId, portType };
    connectionStartPort = sourcePort;
    connectionStartPort.classList.add('is-connecting');

    connectionPreviewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connectionPreviewPath.setAttribute('class', 'connection-line connection-line-preview');

    const sourcePoint = getPortCenter(sourcePort, svg);
    const sourceRect = sourcePort.getBoundingClientRect();
    lastPointer = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2
    };
    connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, sourcePoint.x, sourcePoint.y));
    svg.appendChild(connectionPreviewPath);
}

function endConnection(nodeId: string, portType: string) {
    if (!isConnecting || !connectionStart) return;

    if (portType !== 'input' || connectionStart.nodeId === nodeId) {
        cancelConnection();
        return;
    }

    const exists = edges.some(e => e.source === connectionStart.nodeId && e.target === nodeId);
    if (!exists) {
        edges.push({
            source: connectionStart.nodeId,
            target: nodeId
        });
        renderConnections();
    }

    cancelConnection();
}

function cancelConnection() {
    isConnecting = false;
    connectionStart = null;
    connectionStartPort?.classList.remove('is-connecting');
    connectionStartPort = null;
    connectionPreviewPath?.remove();
    connectionPreviewPath = null;
    clearConnectionTargetHighlights();
}

function updateConnectionPreview(clientX: number, clientY: number) {
    if (!isConnecting || !connectionStartPort || !connectionPreviewPath) return;

    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!svg) return;

    const sourcePoint = getPortCenter(connectionStartPort, svg);
    const targetPoint = getCanvasPointFromClient(clientX, clientY, svg);
    connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y));
}

function highlightConnectionTarget(clientX: number, clientY: number) {
    clearConnectionTargetHighlights();

    const hovered = document.elementFromPoint(clientX, clientY);
    if (!(hovered instanceof Element)) return;

    const hoveredPort = hovered.closest('.port.input') as HTMLElement | null;
    const hoveredNode = hoveredPort?.closest('.flow-node') as HTMLElement | null;
    if (!hoveredPort || !hoveredNode?.id) return;
    if (hoveredNode.id === connectionStart?.nodeId) return;

    hoveredPort.classList.add('connection-target');
}

function clearConnectionTargetHighlights() {
    document.querySelectorAll('.port.connection-target').forEach((port) => {
        port.classList.remove('connection-target');
    });
}

function getCanvasPointFromClient(clientX: number, clientY: number, svg: SVGSVGElement) {
    const canvasRect = svg.getBoundingClientRect();
    return {
        x: clientX - canvasRect.left,
        y: clientY - canvasRect.top
    };
}

function getPortCenter(port: HTMLElement, svg: SVGSVGElement) {
    const rect = port.getBoundingClientRect();
    return getCanvasPointFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2, svg);
}

function buildConnectionPath(x1: number, y1: number, x2: number, y2: number) {
    const curve = Math.max(Math.abs(x2 - x1) * 0.5, 40);
    return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

function renderConnections() {
    const svg = document.getElementById('connectionsSvg') as SVGSVGElement | null;
    if (!svg) return;
    svg.innerHTML = '';

    edges.forEach(edge => {
        const sourceNode = document.getElementById(edge.source);
        const targetNode = document.getElementById(edge.target);

        if (!sourceNode || !targetNode) return;

        const sourcePort = sourceNode.querySelector('.port.output') as HTMLElement | null;
        const targetPort = targetNode.querySelector('.port.input') as HTMLElement | null;

        if (!sourcePort || !targetPort) return;

        const sourcePoint = getPortCenter(sourcePort, svg);
        const targetPoint = getPortCenter(targetPort, svg);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y));
        path.setAttribute('class', 'connection-line');
        path.setAttribute('data-source', edge.source);
        path.setAttribute('data-target', edge.target);

        const removeConnection = () => {
            if (!confirm('Remover esta conexão?')) return;
            edges = edges.filter(e => !(e.source === edge.source && e.target === edge.target));
            renderConnections();
        };

        path.addEventListener('click', (event) => {
            event.stopPropagation();
            removeConnection();
        });

        svg.appendChild(path);
    });

    if (isConnecting && connectionPreviewPath && connectionStartPort) {
        svg.appendChild(connectionPreviewPath);
        const sourcePoint = getPortCenter(connectionStartPort, svg);
        const targetPoint = getCanvasPointFromClient(lastPointer.x, lastPointer.y, svg);
        connectionPreviewPath.setAttribute('d', buildConnectionPath(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y));
    }
}

function setZoom(value: number) {
    zoom = Math.max(0.3, Math.min(value, 2));
    applyZoom();
}

function zoomIn() {
    zoom = Math.min(zoom + 0.1, 2);
    applyZoom();
}

function zoomOut() {
    zoom = Math.max(zoom - 0.1, 0.3);
    applyZoom();
}

function resetZoom() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    applyZoom();
}

function applyZoom() {
    const container = document.getElementById('canvasContainer') as HTMLElement | null;
    const zoomLevel = document.getElementById('zoomLevel') as HTMLElement | null;
    if (container) container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    if (zoomLevel) zoomLevel.textContent = Math.round(zoom * 100) + '%';
    renderConnections();
}

// Limpar canvas
function clearCanvas() {
    if (!confirm('Limpar todo o fluxo?')) return;
    resetEditorState();
}

function resetEditorState() {
    cancelConnection();
    stopPan();
    deselectNode();

    nodes = [];
    edges = [];
    currentFlowId = null;
    zoom = 1;
    pan = { x: 0, y: 0 };

    const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
    if (canvasContainer) {
        canvasContainer.innerHTML = `
        <div class="empty-canvas" id="emptyCanvas">
            <div class="icon icon-flows"></div>
            <h3>Arraste os blocos para começar</h3>
            <p>Crie seu fluxo de automação visual</p>
        </div>
    `;
    }

    const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
    if (connectionsSvg) connectionsSvg.innerHTML = '';

    const flowName = document.getElementById('flowName') as HTMLInputElement | null;
    if (flowName) flowName.value = '';

    applyZoom();
}

// Salvar fluxo
async function saveFlow() {
    const name = (document.getElementById('flowName') as HTMLInputElement | null)?.value.trim() || '';
    if (!name) {
        alert('Digite um nome para o fluxo');
        return;
    }

    if (nodes.length === 0) {
        alert('Adicione pelo menos um bloco ao fluxo');
        return;
    }

    const token = getSessionToken();
    if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
    }

    const trigger = nodes.find(n => n.type === 'trigger');

    const flowData = {
        name,
        description: '',
        trigger_type: trigger?.subtype || 'manual',
        trigger_value: trigger?.data?.keyword || null,
        nodes,
        edges,
        is_active: 1
    };

    try {
        const url = currentFlowId ? `/api/flows/${currentFlowId}` : '/api/flows';
        const method = currentFlowId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: buildAuthHeaders(true),
            body: JSON.stringify(flowData)
        });

        const result = await response.json();

        if (result.success) {
            currentFlowId = result.flow.id;
            alert('Fluxo salvo com sucesso!');
        } else {
            alert('Erro ao salvar: ' + result.error);
        }
    } catch (error) {
        alert('Erro ao salvar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'));
    }
}

// Carregar fluxos
async function loadFlows() {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (container) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray);">Carregando fluxos...</p>';
    }

    try {
        const response = await fetch('/api/flows', {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();

        if (result.success) {
            renderFlowsList(result.flows as FlowSummary[]);
        } else {
            renderFlowsError(result.error || 'Não foi possível carregar os fluxos.');
        }
    } catch (error) {
        renderFlowsError(error instanceof Error ? error.message : 'Falha ao carregar fluxos.');
    }
}

function renderFlowsError(message: string) {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = `<p style="text-align: center; color: var(--danger);">${message}</p>`;
}

// Renderizar lista de fluxos
function renderFlowsList(flows: FlowSummary[]) {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (!container) return;

    if (flows.length === 0) {
        container.innerHTML = '<p class="flow-list-empty">Nenhum fluxo criado ainda. Crie um novo para começar.</p>';
        return;
    }

    container.innerHTML = flows.map(flow => `
        <div class="flow-list-item" onclick="loadFlow(${flow.id})">
            <div class="icon icon-flows"></div>
            <div class="info">
                <div class="name">${flow.name}</div>
                <div class="meta">Gatilho: ${flow.trigger_type || 'manual'} | ${flow.nodes?.length || 0} blocos</div>
            </div>
            <span class="status ${flow.is_active ? 'active' : 'inactive'}">${flow.is_active ? 'Ativo' : 'Inativo'}</span>
        </div>
    `).join('');
}

// Carregar fluxo
async function loadFlow(id: number) {
    try {
        const response = await fetch(`/api/flows/${id}`, {
            headers: buildAuthHeaders(false)
        });
        const result = await response.json();
        
        if (result.success) {
            resetEditorState();
            closeFlowsModal();

            // Limpar canvas
            const canvasContainer = document.getElementById('canvasContainer') as HTMLElement | null;
            const connectionsSvg = document.getElementById('connectionsSvg') as HTMLElement | null;
            if (canvasContainer) canvasContainer.innerHTML = '';
            if (connectionsSvg) connectionsSvg.innerHTML = '';
            document.getElementById('emptyCanvas')?.remove();
            
            // Carregar dados
            currentFlowId = result.flow.id;
            nodes = result.flow.nodes || [];
            edges = result.flow.edges || [];
            
            const flowName = document.getElementById('flowName') as HTMLInputElement | null;
            if (flowName) flowName.value = result.flow.name;
            
            // Renderizar nós
            nodes.forEach(node => renderNode(node));
            
            // Renderizar conexões
            setTimeout(() => renderConnections(), 100);
        } else {
            alert('Erro ao carregar fluxo: ' + result.error);
        }
    } catch (error) {
        alert('Erro ao carregar fluxo: ' + (error instanceof Error ? error.message : 'Falha inesperada'));
    }
}

// Criar novo fluxo
function createNewFlow() {
    if (nodes.length > 0 || currentFlowId) {
        if (!confirm('Descartar o fluxo atual e criar um novo?')) return;
    }
    resetEditorState();
    closeFlowsModal();
}

// Modal
function openFlowsModal() {
    loadFlows();
    document.getElementById('flowsModal')?.classList.add('active');
}

function closeFlowsModal() {
    document.getElementById('flowsModal')?.classList.remove('active');
}

const windowAny = window as Window & {
    initFlowBuilder?: () => void;
    openFlowsModal?: () => void;
    createNewFlow?: () => void;
    clearCanvas?: () => void;
    saveFlow?: () => Promise<void>;
    zoomIn?: () => void;
    zoomOut?: () => void;
    resetZoom?: () => void;
    insertVariable?: (variable: string) => void;
    updateNodeProperty?: (key: keyof NodeData, value: any) => void;
    addCondition?: () => void;
    removeCondition?: (index: number) => void;
    updateCondition?: (index: number, key: 'value' | 'next', value: string) => void;
    deleteNode?: (id: string) => void;
    loadFlow?: (id: number) => Promise<void>;
    closeFlowsModal?: () => void;
};
windowAny.initFlowBuilder = initFlowBuilder;
windowAny.openFlowsModal = openFlowsModal;
windowAny.createNewFlow = createNewFlow;
windowAny.clearCanvas = clearCanvas;
windowAny.saveFlow = saveFlow;
windowAny.zoomIn = zoomIn;
windowAny.zoomOut = zoomOut;
windowAny.resetZoom = resetZoom;
windowAny.insertVariable = insertVariable;
windowAny.updateNodeProperty = updateNodeProperty;
windowAny.addCondition = addCondition;
windowAny.removeCondition = removeCondition;
windowAny.updateCondition = updateCondition;
windowAny.deleteNode = deleteNode;
windowAny.loadFlow = loadFlow;
windowAny.closeFlowsModal = closeFlowsModal;

export { initFlowBuilder };




