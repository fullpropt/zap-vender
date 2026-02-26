import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type FlowBuilderGlobals = {
  initFlowBuilder?: () => void;
  openFlowsModal?: () => void;
  createNewFlow?: () => Promise<void>;
  clearCanvas?: () => void;
  saveFlow?: () => void;
  generateFlowWithAi?: () => Promise<void>;
  toggleFlowAiAssistant?: (forceOpen?: boolean) => void;
  closeFlowAiAssistant?: () => void;
  sendFlowAiAssistantPrompt?: () => Promise<void>;
  handleFlowAiAssistantInputKeydown?: (event: KeyboardEvent) => void;
  toggleFlowActive?: () => void;
  updateFlowStatusFromSelect?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  resetZoom?: () => void;
  insertVariable?: (value: string) => void;
  closeFlowsModal?: () => void;
};

export default function FlowBuilder() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/flow-builder');

      if (cancelled) return;

      const win = window as Window & FlowBuilderGlobals;
      if (typeof win.initFlowBuilder === 'function') {
        win.initFlowBuilder();
      } else if (typeof (mod as { initFlowBuilder?: () => void }).initFlowBuilder === 'function') {
        (mod as { initFlowBuilder?: () => void }).initFlowBuilder?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & FlowBuilderGlobals;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="flow-builder-react">
      <style>{`
        .flow-builder-react {
            --primary: #178C49;
            --primary-light: #1FAE5E;
            --primary-rgb: 23, 140, 73;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --dark: #1e293b;
            --gray: #64748b;
            --light: #f1f5f9;
            --lighter: #f8fafc;
            --white: #ffffff;
            --border: #e2e8f0;
            min-height: 100vh;
            height: 100vh;
            overflow: hidden;
        }

        .flow-builder-react .main-content {
            color: #e7edf7;
            height: 100vh;
            overflow: hidden;
            padding: 18px 24px 14px;
        }

        .flow-builder-react .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        .flow-builder-react .header-title {
            min-width: 0;
            flex: 1 1 520px;
        }

        .flow-builder-react .header-title h1 {
            color: #e7edf7;
            font-size: 40px;
            line-height: 1.1;
        }

        .flow-builder-react .header-title p {
            color: #9fb0c8;
            margin-top: 6px;
        }

        .flow-builder-react .flow-name-highlight {
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(var(--primary-rgb), 0.28);
            border-left: 3px solid rgba(var(--primary-rgb), 0.85);
            background: linear-gradient(
                90deg,
                rgba(var(--primary-rgb), 0.08) 0%,
                rgba(15, 23, 42, 0.22) 38%,
                rgba(15, 23, 42, 0.2) 100%
            );
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            max-width: min(620px, 100%);
        }

        .flow-builder-react .flow-name-highlight-meta {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }

        .flow-builder-react .flow-name-highlight-content {
            min-width: 0;
            flex: 1;
        }

        .flow-builder-react .flow-name-highlight-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: rgba(var(--primary-rgb), 0.9);
            font-weight: 700;
            margin-bottom: 2px;
        }

        .flow-builder-react .flow-name-highlight-name {
            font-size: 14px;
            color: #e7edf7;
            font-weight: 700;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .flow-builder-react .flow-name-highlight-status {
            border-radius: 999px;
            border: 1px solid rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.1);
            color: #d8f4e6;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .flow-builder-react .flow-name-highlight-status.active {
            border-color: rgba(var(--primary-rgb), 0.5);
            background: rgba(var(--primary-rgb), 0.18);
            color: #eafff3;
        }

        .flow-builder-react .flow-name-highlight-status.inactive {
            border-color: rgba(148, 163, 184, 0.42);
            background: rgba(15, 23, 42, 0.24);
            color: #cbd5e1;
        }

        .flow-builder-react .flow-name-highlight-status.draft {
            border-color: rgba(var(--primary-rgb), 0.32);
            background: rgba(15, 23, 42, 0.24);
            color: #cbd5e1;
        }

        .flow-builder-react .flow-name-highlight-link {
            border: none;
            background: transparent;
            color: #bfd0e6;
            font-size: 12px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 0;
            line-height: 1.2;
            white-space: nowrap;
            opacity: 0.92;
            transition: color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
        }
        .flow-builder-react .flow-name-highlight-link:hover {
            color: #e7edf7;
            opacity: 1;
            transform: translateY(-1px);
        }
        .flow-builder-react .flow-name-highlight-link:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.28);
            outline-offset: 2px;
            border-radius: 6px;
        }

        .flow-builder-react .header-flow-row {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            box-sizing: border-box;
            padding-right: 28px;
        }

        .flow-builder-react .header-flow-row .flow-name-highlight {
            margin-top: 0;
            flex: 0 1 620px;
            width: min(620px, 100%);
            min-width: min(360px, 100%);
        }

        .flow-builder-react .header-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            box-sizing: border-box;
            padding-right: 28px;
        }

        .flow-builder-react .flow-canvas-toolbar {
            position: absolute;
            top: 16px;
            right: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
            z-index: 40;
            pointer-events: none;
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn {
            pointer-events: auto;
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary,
        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.ai-highlight {
            min-width: 150px;
            justify-content: center;
            min-height: 38px;
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.secondary {
            min-height: 38px;
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.is-hidden {
            display: none;
        }

        .flow-builder-react .flow-ai-assistant-dock {
            position: absolute;
            left: 50%;
            bottom: 16px;
            transform: translateX(-50%);
            z-index: 42;
            width: min(640px, calc(100% - 36px));
            display: grid;
            justify-items: center;
            pointer-events: none;
        }

        .flow-builder-react .flow-ai-assistant-launch {
            pointer-events: auto;
            min-width: 210px;
            min-height: 40px;
            justify-content: center;
            font-weight: 700;
        }

        .flow-builder-react .flow-ai-assistant-panel[hidden] {
            display: none !important;
        }

        .flow-builder-react .flow-ai-assistant-panel {
            width: 100%;
            pointer-events: auto;
            border-radius: 14px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            background:
                radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.08), transparent 46%),
                rgba(15, 23, 42, 0.92);
            box-shadow: 0 18px 42px rgba(2, 6, 23, 0.28);
            overflow: hidden;
            backdrop-filter: blur(4px);
        }

        .flow-builder-react .flow-ai-assistant-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 12px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.14);
            background: rgba(2, 6, 23, 0.18);
        }

        .flow-builder-react .flow-ai-assistant-title {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #e7edf7;
            font-size: 13px;
            font-weight: 700;
        }

        .flow-builder-react .flow-ai-assistant-status {
            font-size: 11px;
            color: #9fb0c8;
            margin-left: 6px;
            font-weight: 500;
        }

        .flow-builder-react .flow-ai-assistant-close {
            width: 28px;
            height: 28px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.45);
            color: #cbd5e1;
            cursor: pointer;
            display: grid;
            place-items: center;
            font-size: 16px;
            line-height: 1;
            transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
        }

        .flow-builder-react .flow-ai-assistant-close:hover {
            border-color: rgba(var(--primary-rgb), 0.28);
            color: #ffffff;
            background: rgba(15, 23, 42, 0.65);
        }

        .flow-builder-react .flow-ai-assistant-messages {
            max-height: 210px;
            overflow-y: auto;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: rgba(2, 6, 23, 0.06);
        }

        .flow-builder-react .flow-ai-assistant-message {
            display: inline-flex;
            max-width: min(92%, 520px);
            border-radius: 12px;
            padding: 8px 10px;
            font-size: 12px;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid transparent;
        }

        .flow-builder-react .flow-ai-assistant-message.assistant {
            align-self: flex-start;
            background: rgba(30, 41, 59, 0.7);
            border-color: rgba(148, 163, 184, 0.14);
            color: #dbe7f6;
        }

        .flow-builder-react .flow-ai-assistant-message.user {
            align-self: flex-end;
            background: rgba(var(--primary-rgb), 0.17);
            border-color: rgba(var(--primary-rgb), 0.26);
            color: #effef5;
        }

        .flow-builder-react .flow-ai-assistant-message.system {
            align-self: center;
            background: rgba(59, 130, 246, 0.12);
            border-color: rgba(59, 130, 246, 0.22);
            color: #dbeafe;
            font-size: 11px;
            padding: 6px 9px;
        }

        .flow-builder-react .flow-ai-assistant-composer {
            padding: 10px 12px 12px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: end;
            background: rgba(15, 23, 42, 0.18);
        }

        .flow-builder-react .flow-ai-assistant-input {
            width: 100%;
            min-height: 42px;
            max-height: 110px;
            resize: vertical;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            background: rgba(2, 6, 23, 0.26);
            color: #e7edf7;
            padding: 10px 12px;
            font-size: 13px;
            line-height: 1.35;
        }

        .flow-builder-react .flow-ai-assistant-input::placeholder {
            color: #93a7c2;
        }

        .flow-builder-react .flow-ai-assistant-input:focus {
            outline: none;
            border-color: rgba(var(--primary-rgb), 0.42);
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.12);
        }

        .flow-builder-react .flow-ai-assistant-send {
            min-height: 42px;
            min-width: 94px;
            justify-content: center;
            font-weight: 700;
        }

        .flow-builder-react .flow-ai-assistant-send[disabled] {
            opacity: 0.65;
            cursor: not-allowed;
            filter: grayscale(0.08);
        }

        .flow-builder-react .sidebar-menu {
            list-style: none;
            margin: 0;
            padding: 14px 10px;
            flex: 1;
        }

        .flow-builder-react .sidebar-menu li {
            margin-bottom: 4px;
        }

        .flow-builder-react .sidebar-menu a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            color: rgba(226, 232, 240, 0.82);
            text-decoration: none;
            border-radius: 10px;
            transition: all var(--transition);
            font-size: 14px;
            font-weight: 500;
        }

        .flow-builder-react .sidebar-menu a:hover {
            background: rgba(var(--primary-rgb), 0.2);
            color: #f0fdf4;
            transform: translateX(3px);
        }

        .flow-builder-react .sidebar-menu a.active {
            background: linear-gradient(90deg, rgba(var(--primary-rgb), 0.26) 0%, rgba(var(--primary-rgb), 0.12) 100%);
            color: #f0fdf4;
            border: 1px solid rgba(var(--primary-rgb), 0.3);
        }

        .flow-builder-react .sidebar-footer {
            margin-top: auto;
            padding: 15px;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
        }

        .flow-builder-react .btn-logout {
            text-decoration: none;
        }
        
        .flow-container {
            display: grid;
            grid-template-columns: 280px 1fr 320px;
            height: calc(100vh - 156px);
            gap: 0;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
        }
        
        /* Painel de Nos */
        .nodes-panel {
            background: var(--lighter);
            border-right: 1px solid var(--border);
            padding: 20px;
            overflow-y: auto;
        }
        
        .nodes-panel h3 {
            font-size: 14px;
            color: var(--gray);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 15px;
        }
        
        .node-category {
            margin-bottom: 25px;
        }
        
        .node-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            background: white;
            border: 2px solid var(--border);
            border-radius: 10px;
            margin-bottom: 10px;
            cursor: grab;
            transition: all 0.2s;
        }
        
        .node-item:hover {
            border-color: var(--primary);
            box-shadow: 0 4px 12px rgba(90, 42, 107, 0.15);
        }
        
        .node-item:active {
            cursor: grabbing;
        }
        
        .node-item .icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: #334155;
        }
        
        .node-item .icon.trigger { background: rgba(16, 185, 129, 0.15); color: #047857; }
        .node-item .icon.message { background: rgba(59, 130, 246, 0.16); color: #1d4ed8; }
        .node-item .icon.condition { background: rgba(245, 158, 11, 0.17); color: #b45309; }
        .node-item .icon.action { background: rgba(139, 92, 246, 0.15); color: #6d28d9; }
        .node-item .icon.delay { background: rgba(245, 158, 11, 0.17); color: #b45309; }
        
        .node-item .info {
            flex: 1;
        }
        
        .node-item .info .name {
            font-weight: 600;
            font-size: 14px;
            color: var(--dark);
        }
        
        .node-item .info .desc {
            font-size: 12px;
            color: var(--gray);
        }
        
        /* Canvas do Fluxo */
        .flow-canvas {
            position: relative;
            background: #f8f9fa;
            background-image: 
                radial-gradient(circle, #ddd 1px, transparent 1px);
            background-size: 20px 20px;
            overflow: hidden;
            cursor: grab;
        }

        .flow-canvas.is-panning,
        .flow-canvas.is-panning * {
            cursor: grabbing !important;
        }
        
        .canvas-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            transform-origin: 0 0;
            z-index: 2;
            pointer-events: none;
        }
        
        .flow-node {
            position: absolute;
            min-width: 200px;
            background: white;
            border: 2px solid var(--border);
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            cursor: move;
            user-select: none;
            pointer-events: auto;
        }

        .flow-node * {
            pointer-events: auto;
        }
        
        .flow-node.selected {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(90, 42, 107, 0.2);
        }
        
        .flow-node-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            border-radius: 10px 10px 0 0;
        }
        
        .flow-node-header.trigger { background: rgba(16, 185, 129, 0.1); }
        .flow-node-header.intent { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.message { background: rgba(59, 130, 246, 0.1); }
        .flow-node-header.condition { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.wait { background: rgba(59, 130, 246, 0.1); }
        .flow-node-header.action { background: rgba(139, 92, 246, 0.1); }
        .flow-node-header.delay { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.transfer { background: rgba(239, 68, 68, 0.1); }
        .flow-node-header.event { background: rgba(139, 92, 246, 0.1); }
        
        .flow-node-header .icon {
            font-size: 18px;
            color: #334155;
            opacity: 0.95;
        }
        .flow-node-header.trigger .icon { color: #047857; }
        .flow-node-header.message .icon,
        .flow-node-header.wait .icon { color: #1d4ed8; }
        .flow-node-header.intent .icon,
        .flow-node-header.condition .icon,
        .flow-node-header.delay .icon { color: #b45309; }
        .flow-node-header.action .icon,
        .flow-node-header.event .icon { color: #6d28d9; }
        .flow-node-header.transfer .icon { color: #b91c1c; }

        .flow-node-header .title-group {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .flow-node-header .node-kind {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--gray);
            line-height: 1.1;
        }

        .flow-node-header .title {
            font-weight: 600;
            font-size: 13px;
            color: var(--dark);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
        }

        .flow-node-header .duplicate-btn,
        .flow-node-header .collapse-btn,
        .flow-node-header .delete-btn {
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(51, 65, 85, 0.34);
            color: #334155;
            cursor: pointer;
            padding: 4px 6px;
            border-radius: 5px;
            transition: all 0.2s;
            font-weight: 700;
            line-height: 1;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
        }

        .flow-node-header .collapse-btn {
            min-width: 24px;
            font-size: 13px;
        }

        .flow-node-header .duplicate-btn {
            min-width: 52px;
            font-size: 10px;
            font-weight: 700;
        }
        
        .flow-node-header .delete-btn {
            opacity: 0.72;
            min-width: 24px;
            border-color: rgba(239, 68, 68, 0.38);
            background: rgba(254, 242, 242, 0.96);
            color: #b91c1c;
        }

        .flow-node-header .duplicate-btn:hover {
            background: rgba(16, 185, 129, 0.14);
            border-color: rgba(16, 185, 129, 0.4);
            color: var(--success);
        }

        .flow-node:hover .delete-btn {
            opacity: 1;
        }

        .flow-node-header .collapse-btn:hover {
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.38);
            color: var(--info);
        }
        
        .flow-node-header .delete-btn:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.36);
            color: var(--danger);
        }
        
        .flow-node-body {
            padding: 12px 14px;
            font-size: 13px;
            color: var(--gray);
            max-height: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .flow-node-ports {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 8px;
            padding: 8px 14px;
            border-top: 1px solid var(--border);
        }

        .flow-node.is-collapsed .flow-node-body {
            display: none;
        }

        .flow-node.is-collapsed .flow-node-ports {
            padding-top: 6px;
            padding-bottom: 6px;
            gap: 4px;
        }

        .flow-node.is-collapsed .node-output-label {
            display: none;
        }

        .node-output-ports {
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: flex-end;
        }

        .node-output-port {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .node-output-label {
            font-size: 10px;
            color: var(--gray);
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .port {
            width: 14px;
            height: 14px;
            background: var(--border);
            border: 2px solid white;
            border-radius: 50%;
            cursor: crosshair;
            transition: all 0.2s;
        }
        
        .port:hover {
            background: var(--primary);
            transform: scale(1.3);
        }

        .port.is-connecting {
            background: var(--primary);
            transform: scale(1.3);
            box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.2);
        }

        .port.connection-target {
            background: var(--info);
            transform: scale(1.3);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
        }
        
        .port.input { margin-left: -7px; }
        .port.output { margin-right: -7px; }
        
        /* Conexoes SVG */
        .connections-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }
        
        .connection-line {
            fill: none;
            stroke: var(--gray);
            stroke-width: 2;
            pointer-events: none;
        }
        
        .connection-line.is-hover {
            stroke: var(--danger);
            stroke-width: 3;
        }

        .connection-hit {
            fill: none;
            stroke: transparent;
            stroke-width: 14;
            pointer-events: stroke;
            cursor: pointer;
        }

        .connection-line.connection-line-preview {
            stroke: var(--primary);
            stroke-width: 2.5;
            stroke-dasharray: 6 6;
            opacity: 0.9;
            pointer-events: none;
        }
        
        /* Painel de Propriedades */
        .properties-panel {
            background: white;
            border-left: 1px solid var(--border);
            padding: 20px;
            overflow-y: auto;
        }
        
        .properties-panel h3 {
            font-size: 16px;
            color: var(--dark);
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--border);
        }

        .property-type-summary {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border);
        }

        .property-type-summary-value {
            margin: 0;
            font-size: 18px;
            line-height: 1.2;
            font-weight: 700;
            color: var(--dark);
        }
        
        .property-group {
            margin-bottom: 20px;
        }
        
        .property-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--dark);
            margin-bottom: 8px;
        }
        
        .property-group input,
        .property-group select,
        .property-group textarea {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.2s;
        }
        
        .property-group input:focus,
        .property-group select:focus,
        .property-group textarea:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .property-group textarea {
            min-height: 100px;
            resize: vertical;
        }
        
        .property-group .hint {
            font-size: 12px;
            color: var(--gray);
            margin-top: 5px;
        }
        
        .variables-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
        }
        
        .variable-tag {
            background: rgba(90, 42, 107, 0.1);
            color: var(--primary);
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 12px;
            cursor: pointer;
        }
        
        .variable-tag:hover {
            background: rgba(90, 42, 107, 0.2);
        }
        
        /* Toolbar */
        
        .toolbar-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .toolbar-btn.primary {
            background: var(--primary);
            color: white;
        }
        
        .toolbar-btn.primary:hover {
            background: var(--primary-light);
        }
        
        .toolbar-btn.secondary {
            background: var(--light);
            color: var(--dark);
        }
        
        .toolbar-btn.secondary:hover {
            background: var(--border);
        }

        .toolbar-btn.ai-highlight {
            position: relative;
            background: linear-gradient(135deg, #16a34a 0%, #10b981 48%, #0ea5e9 100%);
            color: white;
            box-shadow: 0 10px 24px rgba(14, 165, 233, 0.2), 0 8px 20px rgba(22, 163, 74, 0.22);
            border: 1px solid rgba(255, 255, 255, 0.18);
            font-weight: 700;
        }

        .toolbar-btn.ai-highlight:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(14, 165, 233, 0.28), 0 10px 24px rgba(22, 163, 74, 0.28);
            filter: saturate(1.04);
        }

        .toolbar-btn.ai-highlight .icon {
            opacity: 0.95;
        }
        
        /* Zoom Controls */
        .zoom-controls {
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            background: white;
            padding: 8px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 30;
        }
        
        .zoom-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: var(--light);
            border-radius: 8px;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .zoom-btn:hover {
            background: var(--border);
        }
        
        .zoom-level {
            text-align: center;
            font-size: 12px;
            color: var(--gray);
            padding: 5px 0;
        }
        
        /* Empty State */
        .empty-canvas {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: var(--gray);
        }
        
        .empty-canvas .icon {
            font-size: 60px;
            margin-bottom: 15px;
            opacity: 0.5;
        }
        
        .empty-canvas h3 {
            font-size: 18px;
            color: var(--dark);
            margin-bottom: 8px;
        }
        
        .empty-canvas p {
            font-size: 14px;
        }
        
        /* Conditions Editor */
        .conditions-editor {
            margin-top: 15px;
        }

        .intent-routes-editor {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 12px;
        }

        .intent-routes-intro {
            font-size: 12px;
            color: var(--gray);
            margin-bottom: 4px;
        }

        .intent-route-card {
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #f8fafc;
            padding: 10px;
        }

        .intent-route-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .intent-route-badge {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            background: rgba(148, 163, 184, 0.2);
            border-radius: 999px;
            padding: 4px 8px;
            letter-spacing: 0.02em;
        }

        .intent-route-field {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-bottom: 8px;
        }

        .intent-route-field:last-child {
            margin-bottom: 0;
        }

        .intent-route-field label {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: var(--gray);
        }

        .intent-route-name-input,
        .intent-route-phrases-input {
            min-width: 0;
        }

        .intent-route-field-hint {
            margin-top: 2px;
            font-size: 11px;
            color: var(--gray);
        }
        
        .condition-row {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
            align-items: center;
        }
        
        .condition-row input {
            flex: 1;
        }
        
        .condition-row .remove-btn {
            width: 32px;
            height: 36px;
            border: none;
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
            border-radius: 6px;
            cursor: pointer;
        }

        .intent-route-card .remove-btn {
            width: 28px;
            height: 28px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: white;
            color: var(--gray);
            border-radius: 6px;
            cursor: pointer;
            line-height: 1;
            font-size: 16px;
            padding: 0;
            transition: all 0.2s;
        }

        .intent-route-card .remove-btn:hover {
            border-color: rgba(239, 68, 68, 0.4);
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
        }
        
        .add-condition-btn {
            width: 100%;
            padding: 10px;
            border: 2px dashed var(--border);
            background: transparent;
            border-radius: 8px;
            color: var(--gray);
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .add-condition-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        
        /* Flow List Modal */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: 16px;
            background: rgba(2, 6, 23, 0.74);
            backdrop-filter: blur(2px);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal-overlay.active {
            display: flex;
        }
        
        .modal {
            background: linear-gradient(
                180deg,
                rgba(18, 33, 54, 0.98) 0%,
                rgba(12, 24, 40, 0.98) 100%
            );
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 16px;
            width: min(680px, 100%);
            max-height: 82vh;
            overflow: hidden;
            box-shadow: 0 22px 48px rgba(2, 6, 23, 0.45);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }
        
        .modal-header h2 {
            font-size: 18px;
            color: #e7edf7;
            letter-spacing: 0.01em;
        }
        
        .modal-close {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            border: 1px solid rgba(100, 116, 139, 0.32);
            background: rgba(15, 23, 42, 0.72);
            font-size: 24px;
            line-height: 1;
            color: #cbd5e1;
            cursor: pointer;
            transition: all 0.2s;
        }

        .modal-close:hover {
            border-color: rgba(var(--primary-rgb), 0.48);
            background: rgba(var(--primary-rgb), 0.14);
            color: #eafff3;
        }
        
        .modal-body {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .modal-footer {
            display: flex;
            justify-content: center;
            padding: 16px 20px;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            background: rgba(2, 6, 23, 0.28);
        }

        .flow-dialog-modal {
            width: min(560px, 100%);
        }

        .flow-dialog-body {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .flow-dialog-message {
            margin: 0;
            color: #d7e2f0;
            line-height: 1.45;
            white-space: pre-wrap;
        }

        .flow-dialog-input-wrap {
            display: none;
            flex-direction: column;
            gap: 8px;
        }

        .flow-dialog-input-wrap.active {
            display: flex;
        }

        .flow-dialog-input {
            width: 100%;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(15, 23, 42, 0.82);
            color: #e7edf7;
            padding: 12px 14px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .flow-dialog-input::placeholder {
            color: rgba(203, 213, 225, 0.65);
        }

        .flow-dialog-input:focus {
            border-color: rgba(var(--primary-rgb), 0.65);
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.16);
        }

        .flow-dialog-footer {
            justify-content: flex-end;
        }

        .flow-dialog-actions {
            width: 100%;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .flow-list-item {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr) auto;
            align-items: center;
            column-gap: 15px;
            row-gap: 10px;
            padding: 15px;
            border: 1px solid rgba(148, 163, 184, 0.26);
            border-radius: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
            background: rgba(15, 23, 42, 0.4);
            min-width: 0;
            width: 100%;
            box-sizing: border-box;
        }
        
        .flow-list-item:hover {
            border-color: rgba(var(--primary-rgb), 0.4);
            box-shadow: 0 8px 18px rgba(2, 6, 23, 0.26);
            background: rgba(var(--primary-rgb), 0.08);
        }

        .flow-list-item.is-current {
            border-color: rgba(var(--primary-rgb), 0.58);
            background: linear-gradient(
                90deg,
                rgba(var(--primary-rgb), 0.14) 0%,
                rgba(15, 23, 42, 0.34) 100%
            );
        }

        .flow-list-item.is-renaming {
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: start;
        }

        .flow-list-item.is-renaming .flow-list-actions {
            grid-column: 2;
            justify-self: end;
        }
        
        .flow-list-item .icon {
            width: 42px;
            height: 42px;
            background: rgba(148, 163, 184, 0.14);
            border: 1px solid rgba(100, 116, 139, 0.34);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #cbd5e1;
        }
        
        .flow-list-item .info {
            flex: 1;
            min-width: 0;
            overflow: hidden;
        }

        .flow-list-item .name-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            width: 100%;
            overflow: hidden;
        }

        .flow-list-item .name-row.name-row-editing {
            width: 100%;
            gap: 8px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
        }
        
        .flow-list-item .name {
            font-weight: 600;
            color: #e7edf7;
            margin-bottom: 4px;
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .flow-inline-name-input {
            flex: 1;
            min-width: 0;
            width: 100%;
            max-width: 100%;
            height: 30px;
            border: 1px solid rgba(100, 116, 139, 0.38);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.72);
            color: #e7edf7;
            padding: 0 10px;
            font-size: 14px;
            font-weight: 600;
        }

        .flow-inline-name-input:focus {
            outline: none;
            border-color: rgba(var(--primary-rgb), 0.62);
            box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.18);
        }

        .flow-inline-actions {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }

        .flow-inline-icon {
            width: 24px;
            height: 24px;
            border: 1px solid rgba(100, 116, 139, 0.32);
            background: rgba(15, 23, 42, 0.62);
            color: #cbd5e1;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .flow-inline-icon.flow-inline-icon-save {
            border-color: rgba(var(--primary-rgb), 0.52);
            background: rgba(var(--primary-rgb), 0.18);
            color: #eafff3;
            font-size: 14px;
            line-height: 1;
            font-weight: 700;
        }

        .flow-inline-icon.flow-inline-icon-cancel {
            font-size: 14px;
            line-height: 1;
            font-weight: 700;
        }

        .flow-inline-icon .icon {
            width: 14px;
            height: 14px;
        }

        .flow-inline-icon:hover {
            border-color: rgba(var(--primary-rgb), 0.48);
            background: rgba(var(--primary-rgb), 0.14);
            color: #eafff3;
        }
        
        .flow-list-item .meta {
            font-size: 12px;
            color: #9fb0c8;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .flow-list-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 0;
            justify-self: end;
            flex-shrink: 0;
            min-width: 0;
            max-width: 100%;
        }

        .flow-list-btn {
            border: 1px solid rgba(100, 116, 139, 0.35);
            background: rgba(15, 23, 42, 0.62);
            color: #dbe6f7;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 10px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .flow-list-icon-btn {
            width: 30px;
            height: 30px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .flow-list-icon-btn .icon {
            width: 16px;
            height: 16px;
        }

        .flow-list-btn:hover {
            border-color: rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.16);
            color: #ecfff4;
        }

        .flow-list-delete {
            color: #fecaca;
            border-color: rgba(239, 68, 68, 0.5);
            background: rgba(127, 29, 29, 0.22);
        }

        .flow-list-delete:hover {
            border-color: rgba(248, 113, 113, 0.7);
            background: rgba(185, 28, 28, 0.34);
            color: #fee2e2;
        }

        .flow-list-duplicate {
            color: #bfdbfe;
            border-color: rgba(59, 130, 246, 0.46);
            background: rgba(30, 58, 138, 0.22);
        }

        .flow-list-duplicate:hover {
            border-color: rgba(96, 165, 250, 0.75);
            background: rgba(37, 99, 235, 0.3);
            color: #dbeafe;
        }

        .flow-list-toggle {
            color: #dbe6f7;
        }

        .flow-list-toggle.is-active {
            border-color: rgba(var(--primary-rgb), 0.5);
            background: rgba(var(--primary-rgb), 0.2);
            color: #eafff3;
        }

        .flow-list-toggle.is-active:hover {
            border-color: rgba(var(--primary-rgb), 0.62);
            background: rgba(var(--primary-rgb), 0.26);
        }

        .flow-list-toggle.is-inactive {
            border-color: rgba(148, 163, 184, 0.5);
            background: rgba(148, 163, 184, 0.14);
            color: #cbd5e1;
        }

        .flow-list-toggle.is-inactive:hover {
            border-color: rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.16);
            color: #ecfff4;
        }

        .flow-list-empty {
            text-align: center;
            color: #9fb0c8;
            border: 1px dashed rgba(148, 163, 184, 0.4);
            background: rgba(15, 23, 42, 0.35);
            border-radius: 12px;
            padding: 18px 14px;
        }
        
        @media (max-width: 1200px) {
            .flow-container {
                grid-template-columns: 240px 1fr;
            }
            .properties-panel {
                display: none;
            }
        }
        
        @media (max-width: 768px) {
            .flow-builder-react .main-content {
                height: auto;
                min-height: 100vh;
                overflow: auto;
                padding: 16px 12px;
            }
            .flow-builder-react .flow-name-highlight {
                padding: 8px 10px;
                gap: 8px;
            }
            .flow-builder-react .flow-name-highlight-name {
                font-size: 13px;
            }
            .flow-builder-react .flow-name-highlight-status {
                font-size: 10px;
                padding: 3px 8px;
            }
            .flow-list-item {
                grid-template-columns: 42px minmax(0, 1fr);
                gap: 10px;
            }
            .flow-list-actions {
                grid-column: 1 / -1;
                width: 100%;
                justify-content: flex-end;
                justify-self: stretch;
            }
            .flow-list-item.is-renaming .flow-list-actions {
                grid-column: 1 / -1;
            }
            .flow-container {
                grid-template-columns: 1fr;
                grid-template-rows: auto 1fr;
                height: calc(100vh - 150px);
            }
            .nodes-panel {
                border-right: none;
                border-bottom: 1px solid var(--border);
                padding: 12px;
                max-height: 220px;
            }
            .flow-builder-react .header-actions {
                width: 100%;
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                padding-right: 0;
            }
            .flow-builder-react .header-flow-row {
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                padding-right: 0;
            }
            .flow-builder-react .header-flow-row .flow-name-highlight {
                min-width: 0;
                width: 100%;
            }
            .flow-builder-react .flow-name-highlight-meta {
                width: 100%;
                justify-content: space-between;
                gap: 8px;
            }
            .flow-list-item .name-row {
                width: 100%;
            }
            .flow-inline-name-input {
                min-width: 0;
            }
            .flow-builder-react .flow-canvas-toolbar {
                top: 10px;
                right: 10px;
                gap: 8px;
            }
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary,
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn.ai-highlight {
                min-width: 0;
            }
            .flow-builder-react .flow-ai-assistant-dock {
                width: calc(100% - 20px);
                bottom: 10px;
            }
            .flow-builder-react .flow-ai-assistant-launch {
                width: min(100%, 240px);
                min-width: 0;
            }
            .flow-builder-react .flow-ai-assistant-panel {
                border-radius: 12px;
            }
            .flow-builder-react .flow-ai-assistant-messages {
                max-height: 160px;
            }
            .flow-builder-react .flow-ai-assistant-composer {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            .flow-builder-react .flow-ai-assistant-send {
                width: 100%;
                min-width: 0;
            }
        }
      `}</style>
          <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
              {'\u2630'}
          </button>
          <div className="sidebar-overlay" onClick={toggleSidebar}></div>
                    <aside className="sidebar">
              <div className="sidebar-header">
                  <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
              </div>
              <nav className="sidebar-nav">
                  <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/inbox" className="nav-link"><span className="icon icon-inbox"></span>Inbox</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Automação</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/automacao" className="nav-link"><span className="icon icon-automation"></span>Automação</Link></li>
                          <li className="nav-item"><Link to="/flow-builder" className="nav-link active"><span className="icon icon-flows"></span>Fluxos de Conversa</Link></li>
                          <li className="nav-item"><Link to="/funil" className="nav-link"><span className="icon icon-funnel"></span>Funil de Vendas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Sistema</div>
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/whatsapp" className="nav-link"><span className="icon icon-whatsapp"></span>WhatsApp</Link></li>
                          <li className="nav-item"><Link to="/configuracoes" className="nav-link"><span className="icon icon-settings"></span>Configurações</Link></li>
                      </ul>
                  </div>
              </nav>
              <div className="sidebar-footer">
                  <Link to="/login" className="btn-logout">Sair</Link>
              </div>
          </aside>
          
          <main className="main-content">
              <div className="header">
                  <div className="header-title">
                      <h1><span className="icon icon-flows icon-sm"></span> Construtor de Fluxos</h1>
                      <p>Crie automações visuais para suas conversas</p>
                  </div>
                  <div className="header-flow-row">
                      <div className="flow-name-highlight">
                          <div className="flow-name-highlight-content">
                              <div className="flow-name-highlight-label">Fluxo atual</div>
                              <div className="flow-name-highlight-name" id="currentFlowNameDisplay">Novo fluxo (não salvo)</div>
                          </div>
                          <div className="flow-name-highlight-meta">
                              <span className="flow-name-highlight-status draft" id="currentFlowStatusDisplay">Não salvo</span>
                              <button className="flow-name-highlight-link" type="button" onClick={() => globals.openFlowsModal?.()}>
                                  <span className="icon icon-list icon-sm"></span> Meus Fluxos
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
              
              <div className="flow-container">
                  <div className="nodes-panel">
                      <div className="node-category">
                          <h3>Gatilhos</h3>
                          <div className="node-item" draggable="true" data-type="trigger" data-subtype="new_contact">
                              <div className="icon trigger icon-user"></div>
                              <div className="info">
                                  <div className="name">Novo Contato</div>
                                  <div className="desc">Inicia quando um novo lead entra</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="trigger" data-subtype="keyword">
                              <div className="icon trigger icon-lock"></div>
                              <div className="info">
                                  <div className="name">Intenção</div>
                                  <div className="desc">Inicia pela intenção detectada</div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="node-category">
                          <h3>Mensagens</h3>
                          <div className="node-item" draggable="true" data-type="message">
                              <div className="icon message icon-message"></div>
                              <div className="info">
                                  <div className="name">Enviar Mensagem</div>
                                  <div className="desc">Envia texto ou mídia</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="wait">
                              <div className="icon message icon-clock"></div>
                              <div className="info">
                                  <div className="name">Aguardar Resposta</div>
                                  <div className="desc">Espera input do usuário</div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="node-category">
                          <h3>Lógica</h3>
                          <div className="node-item" draggable="true" data-type="intent">
                              <div className="icon condition icon-bolt"></div>
                              <div className="info">
                                  <div className="name">Intenção</div>
                                  <div className="desc">Aguarda resposta e ramifica por intenção</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="delay">
                              <div className="icon delay icon-clock"></div>
                              <div className="info">
                                  <div className="name">Delay</div>
                                  <div className="desc">Aguarda tempo específico</div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="node-category">
                          <h3>Ações</h3>
                          <div className="node-item" draggable="true" data-type="transfer">
                              <div className="icon action icon-user"></div>
                              <div className="info">
                                  <div className="name">Transferir</div>
                                  <div className="desc">Passa para atendente</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="tag">
                              <div className="icon action icon-tag"></div>
                              <div className="info">
                                  <div className="name">Adicionar Tag</div>
                                  <div className="desc">Marca o lead com tag</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="status">
                              <div className="icon action icon-chart-bar"></div>
                              <div className="info">
                                  <div className="name">Alterar Status</div>
                                  <div className="desc">Muda status do lead</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="webhook">
                              <div className="icon action icon-link"></div>
                              <div className="info">
                                  <div className="name">Webhook</div>
                                  <div className="desc">Envia dados para URL</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="event">
                              <div className="icon action icon-target"></div>
                              <div className="info">
                                  <div className="name">Registrar Evento</div>
                                  <div className="desc">Conta métricas de conversão no dashboard</div>
                              </div>
                          </div>
                          <div className="node-item" draggable="true" data-type="end">
                              <div className="icon action icon-check"></div>
                              <div className="info">
                                  <div className="name">Finalizar</div>
                                  <div className="desc">Encerra o fluxo</div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                      <div className="flow-canvas" id="flowCanvas">
                      <svg className="connections-svg" id="connectionsSvg"></svg>
                      
                      <div className="canvas-container" id="canvasContainer">
                          <div className="empty-canvas" id="emptyCanvas">
                              <div className="icon icon-flows"></div>
                              <h3>Arraste os blocos para começar</h3>
                              <p>Crie seu fluxo de automação visual</p>
                          </div>
                      </div>
                      
                      <div className="flow-canvas-toolbar" id="flowCanvasToolbar">
                          <button className="toolbar-btn secondary is-hidden" id="flowCanvasSaveBtn" onClick={() => globals.saveFlow?.()}>
                              <span className="icon icon-save icon-sm"></span> Salvar
                          </button>
                          <button className="toolbar-btn primary" onClick={() => globals.createNewFlow?.()}>
                              <span className="icon icon-add icon-sm"></span> Novo Fluxo
                          </button>
                      </div>

                      <div className="flow-ai-assistant-dock" id="flowAiAssistantDock">
                          <button
                              className="toolbar-btn ai-highlight flow-ai-assistant-launch"
                              id="flowAiAssistantLaunchBtn"
                              type="button"
                              onClick={() => globals.toggleFlowAiAssistant?.(true)}
                          >
                              <span className="icon icon-spark icon-sm"></span> Gerar com IA
                          </button>

                          <div className="flow-ai-assistant-panel" id="flowAiAssistantPanel" hidden>
                              <div className="flow-ai-assistant-header">
                                  <div className="flow-ai-assistant-title">
                                      <span className="icon icon-spark icon-sm"></span>
                                      IA de Fluxos
                                      <span className="flow-ai-assistant-status" id="flowAiAssistantStatus">Pronta</span>
                                  </div>
                                  <button
                                      className="flow-ai-assistant-close"
                                      id="flowAiAssistantCloseBtn"
                                      type="button"
                                      aria-label="Fechar IA de Fluxos"
                                      onClick={() => globals.closeFlowAiAssistant?.()}
                                  >
                                      ×
                                  </button>
                              </div>

                              <div className="flow-ai-assistant-messages" id="flowAiAssistantMessages"></div>

                              <div className="flow-ai-assistant-composer">
                                  <textarea
                                      className="flow-ai-assistant-input"
                                      id="flowAiAssistantInput"
                                      rows={2}
                                      placeholder="Ex.: gere um fluxo de conversa que receba novos leads e feche vendas"
                                      onKeyDown={(event) => globals.handleFlowAiAssistantInputKeydown?.(event.nativeEvent as KeyboardEvent)}
                                  ></textarea>
                                  <button
                                      className="toolbar-btn ai-highlight flow-ai-assistant-send"
                                      id="flowAiAssistantSendBtn"
                                      type="button"
                                      onClick={() => globals.sendFlowAiAssistantPrompt?.()}
                                  >
                                      <span className="icon icon-spark icon-sm"></span> Gerar
                                  </button>
                              </div>
                          </div>
                      </div>

                      <div className="zoom-controls">
                          <button className="zoom-btn" onClick={() => globals.zoomIn?.()}>+</button>
                          <div className="zoom-level" id="zoomLevel">100%</div>
                          <button className="zoom-btn" onClick={() => globals.zoomOut?.()}>-</button>
                          <button className="zoom-btn" onClick={() => globals.resetZoom?.()}>↺</button>
                      </div>
                  </div>
                  
                  <div className="properties-panel" id="propertiesPanel">
                      <h3>Propriedades</h3>
                      <div id="propertiesContent">
                          <p style={{ color: 'var(--gray)', fontSize: '14px' }}>Selecione um bloco para editar suas propriedades</p>
                      </div>
                      
                      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                          <h4 style={{ fontSize: '13px', color: 'var(--gray)', marginBottom: '10px' }}>Variáveis Disponíveis</h4>
                          <div className="variables-list" id="flowVariablesList">
                              <span className="variable-tag" onClick={() => globals.insertVariable?.('nome')}>{'{{nome}}'}</span>
                              <span className="variable-tag" onClick={() => globals.insertVariable?.('telefone')}>{'{{telefone}}'}</span>
                              <span className="variable-tag" onClick={() => globals.insertVariable?.('email')}>{'{{email}}'}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </main>
          
          <div className="modal-overlay" id="flowsModal">
              <div className="modal">
                  <div className="modal-header">
                      <h2>Selecione um Fluxo</h2>
                      <button className="modal-close" onClick={() => globals.closeFlowsModal?.()}>&times;</button>
                  </div>
                  <div className="modal-body">
                      <div id="flowsList"></div>
                  </div>
                  <div className="modal-footer">
                      <button className="toolbar-btn primary" onClick={() => globals.createNewFlow?.()}>
                          <span className="icon icon-add icon-sm"></span> Criar Novo Fluxo
                      </button>
                  </div>
              </div>
          </div>

          <div className="modal-overlay" id="flowDialogModal">
              <div className="modal flow-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="flowDialogTitle">
                  <div className="modal-header">
                      <h2 id="flowDialogTitle">Aviso</h2>
                      <button className="modal-close" id="flowDialogCloseBtn" type="button">&times;</button>
                  </div>
                  <div className="modal-body flow-dialog-body">
                      <p className="flow-dialog-message" id="flowDialogMessage"></p>
                      <div className="flow-dialog-input-wrap" id="flowDialogInputWrap">
                          <input className="flow-dialog-input" id="flowDialogInput" type="text" />
                      </div>
                  </div>
                  <div className="modal-footer flow-dialog-footer">
                      <div className="flow-dialog-actions">
                          <button className="toolbar-btn secondary" id="flowDialogCancelBtn" type="button">Cancelar</button>
                          <button className="toolbar-btn primary" id="flowDialogConfirmBtn" type="button">OK</button>
                      </div>
                  </div>
              </div>
          </div>
          
    </div>
  );
}
