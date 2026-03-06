import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type FlowBuilderGlobals = {
  initFlowBuilder?: () => void;
  openFlowsModal?: () => void;
  createNewFlow?: () => Promise<void>;
  addIntentBlock?: () => void;
  clearCanvas?: () => void;
  saveFlow?: () => void;
  generateFlowWithAi?: () => Promise<void>;
  toggleFlowAiAssistant?: (forceOpen?: boolean) => void;
  closeFlowAiAssistant?: () => void;
  sendFlowAiAssistantPrompt?: () => Promise<void>;
  handleFlowAiAssistantInputKeydown?: (event: KeyboardEvent) => void;
  toggleFlowActive?: () => void;
  updateFlowStatusFromSelect?: () => void;
  reloadFlowSessionOptions?: () => void;
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
  const showFlowAiAssistantLaunch = false;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="flow-builder-react is-selector-screen">
      <style>{`
        .flow-builder-react {
            --primary: #178C49;
            --primary-light: #1FAE5E;
            --primary-rgb: 23, 140, 73;
            --flow-ai-scroll-track: rgba(7, 13, 23, 0.94);
            --flow-ai-scroll-track-border: rgba(255, 255, 255, 0.03);
            --flow-ai-scroll-thumb: rgba(var(--primary-rgb), 0.46);
            --flow-ai-scroll-thumb-hover: rgba(var(--primary-rgb), 0.64);
            --flow-ai-scroll-thumb-active: rgba(var(--primary-rgb), 0.76);
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
            min-height: 100dvh;
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
        }

        .flow-builder-react .main-content {
            color: #e7edf7;
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
            padding: 18px 24px 14px;
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 12px;
        }

        .flow-builder-react.is-selector-screen .main-content {
            overflow-y: auto;
        }

        .flow-builder-react .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        .flow-builder-react .flow-page-header {
            margin-bottom: 0;
        }

        .flow-builder-react .header-title {
            min-width: 0;
            flex: 1 1 520px;
        }

        .flow-builder-react .header-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }

        .flow-builder-react .flow-builder-back-btn {
            width: 34px;
            min-width: 34px;
            height: 34px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.34);
            background: rgba(15, 23, 42, 0.45);
            color: #d7e2f0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .flow-builder-react .flow-builder-back-btn:hover {
            border-color: rgba(var(--primary-rgb), 0.6);
            background: rgba(var(--primary-rgb), 0.18);
            color: #ecfff4;
        }

        .flow-builder-react #flowBuilderBackBtn[hidden] {
            display: none !important;
        }

        .flow-builder-react .header-title h1 {
            color: #e7edf7;
            font-size: clamp(28px, 4vw, 40px);
            line-height: 1.1;
        }

        .flow-builder-react .header-title p {
            color: #9fb0c8;
            margin-top: 6px;
        }

        .flow-builder-react .flow-selector-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
        }

        .flow-builder-react .flow-selector-actions[hidden] {
            display: none !important;
        }

        .flow-builder-react .flow-selector-actions .btn,
        .flow-builder-react .flow-selector-footer .btn {
            min-height: 38px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
        }

        .flow-builder-react .flow-selector-actions .btn-outline {
            color: #eefbf4;
            border-color: rgba(25, 195, 125, 0.58);
            background: rgba(15, 23, 42, 0.44);
            box-shadow: inset 0 0 0 1px rgba(25, 195, 125, 0.08);
        }

        .flow-builder-react .flow-selector-actions .btn-outline:hover:not(:disabled) {
            border-color: rgba(52, 211, 153, 0.78);
            background: rgba(18, 44, 38, 0.62);
            color: #f8fff9;
            box-shadow: 0 10px 24px rgba(25, 195, 125, 0.14);
        }

        .flow-builder-react .flow-selector-actions .btn-primary,
        .flow-builder-react .flow-selector-footer .btn-primary {
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: linear-gradient(135deg, #19c37d 0%, #22c55e 100%);
            box-shadow: 0 10px 24px rgba(25, 195, 125, 0.22);
        }

        .flow-builder-react .flow-selector-actions .btn-primary:hover:not(:disabled),
        .flow-builder-react .flow-selector-footer .btn-primary:hover:not(:disabled) {
            background: linear-gradient(135deg, #20cf85 0%, #29d26b 100%);
            box-shadow: 0 14px 28px rgba(25, 195, 125, 0.28);
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

        .flow-builder-react .flow-name-highlight-scope {
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-width: 220px;
        }

        .flow-builder-react .flow-scope-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #9fb0c8;
            font-weight: 700;
            line-height: 1.1;
        }

        .flow-builder-react .flow-scope-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .flow-builder-react .flow-scope-select {
            min-width: 220px;
            max-width: 280px;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.46);
            background: rgba(15, 23, 42, 0.46);
            color: #e7edf7;
            padding: 7px 10px;
            font-size: 12px;
            line-height: 1.2;
        }

        .flow-builder-react .flow-scope-select:focus {
            outline: none;
            border-color: rgba(var(--primary-rgb), 0.75);
            box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .flow-builder-react .flow-scope-refresh {
            width: 30px;
            min-width: 30px;
            height: 30px;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.4);
            background: rgba(15, 23, 42, 0.38);
            color: #cbd5e1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .flow-builder-react .flow-scope-refresh:hover {
            border-color: rgba(var(--primary-rgb), 0.58);
            color: #e7edf7;
            background: rgba(var(--primary-rgb), 0.24);
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
            max-width: calc(100% - 32px);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn {
            pointer-events: auto;
            min-width: 0;
            min-height: 38px;
            padding: 10px 18px;
            border-radius: 12px;
            border: 1px solid transparent;
            font-size: 14px;
            font-weight: 700;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary,
        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.ai-highlight {
            min-width: 150px;
            justify-content: center;
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.secondary {
            color: #eefbf4;
            border-color: rgba(25, 195, 125, 0.58);
            background: rgba(15, 23, 42, 0.92);
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.secondary:hover:not(:disabled) {
            color: #f8fff9;
            border-color: rgba(52, 211, 153, 0.78);
            background: rgba(18, 44, 38, 0.94);
            box-shadow: 0 12px 28px rgba(25, 195, 125, 0.18);
            transform: translateY(-1px);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary {
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.08);
            background: linear-gradient(135deg, #19c37d 0%, #22c55e 100%);
            box-shadow: 0 10px 24px rgba(25, 195, 125, 0.24);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary:hover:not(:disabled) {
            background: linear-gradient(135deg, #20cf85 0%, #29d26b 100%);
            box-shadow: 0 14px 28px rgba(25, 195, 125, 0.3);
            transform: translateY(-1px);
        }

        .flow-builder-react .flow-canvas-toolbar .toolbar-btn.is-hidden {
            display: none;
        }

        .flow-builder-react .flow-ai-assistant-dock {
            position: absolute;
            left: 50%;
            bottom: 24px;
            transform: translateX(-50%);
            z-index: 42;
            width: min(640px, calc(100% - 36px));
            display: grid;
            justify-items: center;
            pointer-events: none;
        }

        .flow-builder-react .flow-ai-assistant-launch[hidden] {
            display: none !important;
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

        .flow-builder-react .flow-ai-assistant-messages,
        .flow-builder-react .flow-ai-assistant-input {
            scrollbar-width: thin;
            scrollbar-color: var(--flow-ai-scroll-thumb) var(--flow-ai-scroll-track);
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-track,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-track {
            background: linear-gradient(180deg, rgba(9, 15, 25, 0.96), rgba(11, 19, 31, 0.96));
            border-left: 1px solid var(--flow-ai-scroll-track-border);
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-thumb,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-thumb {
            background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.62) 0%,
                rgba(var(--primary-rgb), 0.38) 100%
            );
            border-radius: 999px;
            border: 2px solid rgba(10, 17, 28, 0.92);
            background-clip: padding-box;
            min-height: 36px;
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-thumb:hover,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.78) 0%,
                rgba(var(--primary-rgb), 0.5) 100%
            );
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-thumb:active,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-thumb:active {
            background: var(--flow-ai-scroll-thumb-active);
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-button,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-button {
            background: rgba(8, 14, 24, 0.96);
            border-left: 1px solid var(--flow-ai-scroll-track-border);
            border-top: 1px solid var(--flow-ai-scroll-track-border);
            height: 12px;
            width: 12px;
        }

        .flow-builder-react .flow-ai-assistant-messages::-webkit-scrollbar-corner,
        .flow-builder-react .flow-ai-assistant-input::-webkit-scrollbar-corner {
            background: rgba(8, 14, 24, 0.96);
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
            resize: none;
            overflow-y: auto;
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
            min-width: 104px;
            justify-content: center;
            font-weight: 700;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            background: linear-gradient(135deg, #25d366 0%, #1ca85a 54%, #178c49 100%);
            color: #f8fff9;
            box-shadow: 0 10px 24px rgba(23, 140, 73, 0.26), 0 6px 14px rgba(37, 211, 102, 0.22);
            transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }

        .flow-builder-react .flow-ai-assistant-send:hover:not([disabled]) {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(23, 140, 73, 0.34), 0 8px 18px rgba(37, 211, 102, 0.28);
            filter: saturate(1.03);
        }

        .flow-builder-react .flow-ai-assistant-send:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.42);
            outline-offset: 2px;
            border-color: rgba(var(--primary-rgb), 0.52);
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
            grid-template-columns: minmax(0, 1fr) 380px;
            height: 100%;
            min-height: 0;
            gap: 0;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 25px rgba(0,0,0,0.08);
            min-width: 0;
            grid-column: 1;
            grid-row: 2;
        }
        
        /* Painel de Nos */
        .nodes-panel {
            background: var(--lighter);
            border-right: 1px solid var(--border);
            padding: 20px;
            overflow-y: auto;
            min-width: 0;
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
            min-width: 0;
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

        .flow-node.event-circle {
            width: 128px;
            min-width: 128px;
            height: 128px;
            border-radius: 999px;
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

        .flow-node.event-circle .flow-node-header {
            position: relative;
            height: 100%;
            border: 0;
            border-radius: 999px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 6px;
            padding: 16px 12px 12px;
        }

        .flow-node-header.trigger { background: #ffffff; }
        .flow-node-header.intent { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.message { background: rgba(59, 130, 246, 0.1); }
        .flow-node-header.message_once { background: rgba(20, 184, 166, 0.12); }
        .flow-node-header.condition { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.wait { background: rgba(59, 130, 246, 0.1); }
        .flow-node-header.action { background: rgba(139, 92, 246, 0.1); }
        .flow-node-header.delay { background: rgba(245, 158, 11, 0.1); }
        .flow-node-header.transfer { background: rgba(239, 68, 68, 0.1); }
        .flow-node-header.event { background: rgba(139, 92, 246, 0.1); }
        .flow-node-header.end { background: #ffffff; }
        
        .flow-node-header .icon {
            font-size: 18px;
            color: #334155;
            opacity: 0.95;
        }
        .flow-node-header.trigger .icon { color: #047857; }
        .flow-node-header.message .icon,
        .flow-node-header.message_once .icon,
        .flow-node-header.wait .icon { color: #1d4ed8; }
        .flow-node-header.intent .icon,
        .flow-node-header.condition .icon,
        .flow-node-header.delay .icon { color: #b45309; }
        .flow-node-header.action .icon,
        .flow-node-header.event .icon { color: #6d28d9; }
        .flow-node-header.transfer .icon { color: #b91c1c; }

        .flow-node.event-circle .flow-node-header .icon {
            font-size: 20px;
        }

        .flow-node-header .title-group {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .flow-node.event-circle .flow-node-header .title-group {
            align-items: center;
            text-align: center;
            gap: 4px;
            margin-top: 10px;
        }

        .flow-node-header .node-kind {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--gray);
            line-height: 1.1;
        }

        .flow-node.event-circle .flow-node-header .node-kind {
            display: none;
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

        .flow-node.event-circle .flow-node-header .title {
            font-size: 11px;
            line-height: 1.2;
            white-space: normal;
            text-align: center;
        }

        .flow-node.event-circle .flow-node-header .node-subtitle {
            font-size: 9px;
            line-height: 1.2;
            color: #64748b;
            font-weight: 600;
            max-width: 88px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
        }

        .flow-node-header .node-header-actions {
            margin-left: auto;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .flow-node-header .node-header-btn {
            width: 24px;
            min-width: 24px;
            height: 24px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.45);
            background: rgba(255, 255, 255, 0.8);
            color: #475569;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            padding: 0;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }

        .flow-node-header .node-header-btn .icon {
            width: 12px;
            height: 12px;
            font-size: 12px;
            color: currentColor;
            opacity: 0.92;
        }

        .flow-node-header .duplicate-btn:hover {
            border-color: rgba(var(--primary-rgb), 0.52);
            background: rgba(var(--primary-rgb), 0.14);
            color: var(--primary);
        }
        
        .flow-node-header .delete-btn {
            border-color: rgba(239, 68, 68, 0.34);
            background: rgba(254, 242, 242, 0.85);
            color: #b91c1c;
        }
        
        .flow-node-header .delete-btn:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.44);
            color: var(--danger);
        }

        .flow-node.event-circle .flow-node-header .node-header-actions {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            gap: 7px;
        }

        .flow-node.event-circle .flow-node-header .node-header-btn {
            width: 22px;
            min-width: 22px;
            height: 22px;
        }

        .flow-node.event-circle .flow-node-header .node-header-btn .icon {
            width: 11px;
            height: 11px;
            font-size: 11px;
        }
        
        .flow-node-body {
            padding: 12px 14px;
            font-size: 13px;
            color: var(--gray);
            max-height: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .flow-node.event-circle .flow-node-body {
            display: none;
        }

        .flow-node-ports {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 8px;
            padding: 8px 14px;
            border-top: 1px solid var(--border);
        }

        .node-input-ports {
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: flex-start;
        }

        .node-input-port {
            display: flex;
            align-items: flex-end;
            gap: 6px;
            min-height: 14px;
        }

        .node-input-label-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
        }

        .node-input-label {
            font-size: 10px;
            color: var(--gray);
            max-width: 124px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.15;
        }

        .flow-node.event-circle .flow-node-ports {
            position: absolute;
            inset: 0;
            border-top: none;
            padding: 0;
            pointer-events: none;
        }

        .flow-node.event-circle .node-input-ports {
            position: absolute;
            top: 50%;
            left: -6px;
            transform: translate(-50%, -50%);
            pointer-events: auto;
        }

        .flow-node.event-circle .node-output-ports {
            position: absolute;
            top: 50%;
            right: -6px;
            transform: translate(50%, -50%);
            pointer-events: auto;
        }

        .flow-node.event-circle .node-output-port {
            padding: 0;
            margin: 0;
        }

        .flow-node.event-circle .node-output-label {
            display: none;
        }

        .flow-node.event-circle .node-input-label-list {
            display: none;
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

        .flow-node.is-collapsed .node-input-label-list {
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

        .output-action-trigger {
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 1px dashed rgba(var(--primary-rgb), 0.55);
            background: rgba(var(--primary-rgb), 0.08);
            color: var(--primary);
            font-size: 13px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            padding: 0;
        }

        .output-action-trigger:hover {
            background: rgba(var(--primary-rgb), 0.2);
            border-color: rgba(var(--primary-rgb), 0.85);
        }

        .output-action-trigger.active {
            background: rgba(var(--primary-rgb), 0.28);
            border-color: rgba(var(--primary-rgb), 0.95);
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.18);
        }

        .output-action-trigger.has-actions {
            color: #1d4ed8;
            border-color: rgba(29, 78, 216, 0.75);
            background: rgba(59, 130, 246, 0.14);
        }

        .flow-node.event-circle .output-action-trigger {
            width: 16px;
            height: 16px;
            font-size: 11px;
            margin-right: 2px;
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

        .port.input.is-extra-input {
            background: rgba(148, 163, 184, 0.76);
            border-style: dashed;
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

        .connection-line.connection-line-intent-default-once {
            stroke: #0ea5e9;
            stroke-width: 2.5;
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
            padding: 18px;
            overflow-y: auto;
            min-width: 0;
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

        .property-group.property-group-compact {
            margin-bottom: 0;
        }

        .property-inline-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 130px;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
        }

        .property-input-with-unit {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .property-input-with-unit input {
            flex: 1 1 auto;
            min-width: 0;
            text-align: right;
        }

        .property-unit {
            font-size: 12px;
            font-weight: 700;
            color: var(--gray);
            min-width: 10px;
            text-align: center;
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

        @media (max-width: 480px) {
            .property-inline-row {
                grid-template-columns: 1fr;
                gap: 8px;
            }
        }
        
        .output-action-toolbar {
            position: relative;
        }

        .output-action-add-btn {
            width: 100%;
        }

        .output-action-type-menu {
            display: none;
            flex-direction: column;
            gap: 6px;
            margin-top: 10px;
            background: #f8fafc;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 8px;
        }

        .output-action-type-menu.is-open {
            display: flex;
        }

        .output-action-type-menu button {
            border: 1px solid var(--border);
            background: #fff;
            border-radius: 8px;
            padding: 8px 10px;
            text-align: left;
            font-size: 13px;
            color: var(--dark);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .output-action-type-menu button:hover {
            border-color: rgba(var(--primary-rgb), 0.5);
            background: rgba(var(--primary-rgb), 0.08);
        }

        .output-actions-empty {
            border: 1px dashed var(--border);
            border-radius: 10px;
            padding: 12px;
            font-size: 13px;
            color: var(--gray);
            margin-bottom: 18px;
            background: #f8fafc;
        }

        .output-actions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 16px;
        }

        .output-action-card {
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #fff;
            overflow: hidden;
        }

        .output-action-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 10px 12px;
            background: #f8fafc;
            border-bottom: 1px solid var(--border);
        }

        .output-action-card-type {
            font-size: 12px;
            font-weight: 700;
            color: var(--dark);
        }

        .output-action-card-content {
            padding: 12px;
        }

        .flow-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .flow-toggle-label {
            font-size: 13px;
            color: var(--dark);
            font-weight: 600;
        }

        .flow-toggle-switch {
            position: relative;
            display: inline-flex;
            width: 46px;
            height: 26px;
            cursor: pointer;
            user-select: none;
        }

        .flow-toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }

        .flow-toggle-slider {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: #cbd5e1;
            transition: background 0.2s ease;
        }

        .flow-toggle-slider::before {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            left: 3px;
            top: 3px;
            border-radius: 50%;
            background: #ffffff;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
            transition: transform 0.2s ease;
        }

        .flow-toggle-switch input:checked + .flow-toggle-slider {
            background: #14b8a6;
        }

        .flow-toggle-switch input:checked + .flow-toggle-slider::before {
            transform: translateX(20px);
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

        .toolbar-btn-label {
            line-height: 1.2;
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

        .toolbar-btn[disabled] {
            opacity: 0.55;
            cursor: not-allowed;
            pointer-events: none;
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
            bottom: calc(20px + env(safe-area-inset-bottom));
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
            gap: 8px;
            margin-top: 10px;
        }

        .intent-config-card {
            border: 1px solid var(--border);
            border-radius: 10px;
            background: #f8fafc;
            overflow: hidden;
        }

        .intent-config-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 12px;
            cursor: pointer;
            user-select: none;
        }

        .intent-config-header:hover {
            background: rgba(148, 163, 184, 0.12);
        }

        .intent-config-header:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.45);
            outline-offset: -2px;
        }

        .intent-config-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .intent-config-kind {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            border: 1px solid transparent;
            white-space: nowrap;
        }

        .intent-config-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--dark);
            line-height: 1.2;
            min-width: 0;
            flex: 1 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .intent-config-header-actions {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .intent-config-state {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--gray);
        }

        .intent-config-chevron {
            font-size: 13px;
            line-height: 1;
            color: var(--gray);
        }

        .intent-config-body {
            border-top: 1px solid var(--border);
            padding: 10px 12px 12px;
            background: white;
        }

        .intent-config-card-intent {
            border-color: rgba(var(--primary-rgb), 0.32);
            background: rgba(var(--primary-rgb), 0.08);
        }

        .intent-config-card-intent .intent-config-header {
            background: rgba(var(--primary-rgb), 0.14);
        }

        .intent-config-card-intent .intent-config-header:hover {
            background: rgba(var(--primary-rgb), 0.2);
        }

        .intent-config-kind-intent {
            color: var(--primary);
            border-color: rgba(var(--primary-rgb), 0.36);
            background: rgba(var(--primary-rgb), 0.16);
        }

        .intent-config-card-default {
            border-color: rgba(148, 163, 184, 0.45);
            background: rgba(248, 250, 252, 0.95);
        }

        .intent-config-card-default .intent-config-header {
            background: rgba(226, 232, 240, 0.58);
        }

        .intent-config-card-default .intent-config-header:hover {
            background: rgba(203, 213, 225, 0.62);
        }

        .intent-config-kind-default {
            color: #475569;
            border-color: rgba(148, 163, 184, 0.5);
            background: rgba(241, 245, 249, 0.95);
        }

        .intent-config-card-welcome {
            border-color: rgba(var(--primary-rgb), 0.28);
            background: rgba(var(--primary-rgb), 0.06);
        }

        .intent-config-card-welcome .intent-config-header {
            background: rgba(var(--primary-rgb), 0.12);
        }

        .intent-config-card-welcome .intent-config-header:hover {
            background: rgba(var(--primary-rgb), 0.18);
        }

        .intent-config-kind-welcome {
            color: var(--primary);
            border-color: rgba(var(--primary-rgb), 0.32);
            background: rgba(var(--primary-rgb), 0.14);
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

        .intent-route-response-input {
            min-width: 0;
            min-height: 72px;
            resize: vertical;
        }

        .intent-followup-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 2px;
        }

        .intent-followup-item {
            position: relative;
        }

        .intent-followup-item .intent-route-response-input {
            padding-right: 36px;
        }

        .intent-followup-remove-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px !important;
            height: 24px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            line-height: 1 !important;
            padding: 0 !important;
        }

        .intent-followup-add-btn {
            margin-top: 8px;
        }

        .intent-config-body .property-group {
            margin-bottom: 10px;
        }

        .intent-config-body .property-group:last-child {
            margin-bottom: 0;
        }

        .intent-welcome-toggle-row {
            margin-bottom: 8px;
        }

        .intent-welcome-inline-group {
            margin-bottom: 0;
        }

        .intent-welcome-inline-grid {
            display: grid;
            grid-template-columns: minmax(90px, 120px) minmax(0, 1fr);
            gap: 10px;
            align-items: end;
        }

        .intent-welcome-inline-item label {
            margin-bottom: 6px;
        }

        .intent-welcome-repeat-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .intent-welcome-repeat-value {
            width: 84px;
            flex: 0 0 84px;
            text-align: center;
        }

        .intent-welcome-repeat-controls select {
            flex: 1 1 auto;
            min-width: 0;
        }

        @media (max-width: 440px) {
            .intent-welcome-inline-grid {
                grid-template-columns: 1fr;
            }
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

        .intent-config-card .remove-btn {
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

        .intent-config-card .remove-btn:hover {
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

        .intent-add-route-btn {
            margin: 2px 0 6px;
        }

        .btn-confirm-flow-block {
            width: 100%;
            padding: 11px 14px;
            border: 1px solid var(--primary);
            background: var(--primary);
            border-radius: 10px;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.01em;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 10px rgba(var(--primary-rgb), 0.25);
        }

        .btn-confirm-flow-block:hover {
            background: var(--primary-light);
            border-color: var(--primary-light);
            transform: translateY(-1px);
            box-shadow: 0 6px 14px rgba(var(--primary-rgb), 0.3);
        }

        .btn-confirm-flow-block:active {
            transform: translateY(0);
            box-shadow: 0 3px 8px rgba(var(--primary-rgb), 0.2);
        }

        .flow-selector-screen {
            grid-column: 1;
            grid-row: 2;
            min-height: 0;
            display: block;
            padding: 0 0 12px;
        }

        .flow-builder-react #flowSelectorScreen[hidden],
        .flow-builder-react #flowBuilderFlowInfoRow[hidden],
        .flow-builder-react #flowBuilderContainer[hidden] {
            display: none !important;
        }

        .flow-selector-card {
            background: linear-gradient(
                180deg,
                rgba(18, 33, 54, 0.98) 0%,
                rgba(12, 24, 40, 0.98) 100%
            );
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 16px;
            width: 100%;
            max-height: none;
            overflow: hidden;
            box-shadow: 0 22px 48px rgba(2, 6, 23, 0.45);
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .flow-selector-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 20px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }

        .flow-selector-header .table-title {
            font-size: 16px;
            color: #e7edf7;
            letter-spacing: 0.01em;
        }

        .flow-selector-header-copy {
            max-width: 520px;
            font-size: 13px;
            line-height: 1.5;
            color: #9fb0c8;
            text-align: right;
        }

        .flow-selector-body {
            padding: 20px;
            overflow: visible;
            min-height: 0;
            flex: 1 1 auto;
        }

        .flow-selector-footer {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px 20px;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            background: rgba(2, 6, 23, 0.28);
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

        .flow-list-item.is-readonly {
            cursor: pointer;
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
                grid-template-columns: 1fr;
            }
            .properties-panel {
                display: none;
            }
        }

        @media (max-width: 1024px) {
            .flow-builder-react .main-content {
                padding: calc(env(safe-area-inset-top, 0px) + 72px) 14px 12px;
            }
            .flow-builder-react .header-title {
                flex: 1 1 100%;
            }
            .flow-builder-react .flow-selector-actions {
                width: 100%;
                justify-content: flex-start;
            }
            .flow-builder-react .header-flow-row,
            .flow-builder-react .header-actions {
                padding-right: 0;
            }
            .flow-builder-react .header-flow-row .flow-name-highlight {
                width: 100%;
                min-width: 0;
                flex: 1 1 100%;
            }
            .flow-builder-react .flow-name-highlight {
                align-items: flex-start;
            }
            .flow-builder-react .flow-name-highlight-meta {
                width: 100%;
                justify-content: flex-start;
                gap: 8px;
            }
            .flow-builder-react .flow-name-highlight-scope {
                min-width: 0;
                flex: 1 1 240px;
            }
            .flow-builder-react .flow-scope-select {
                min-width: 0;
                max-width: none;
                width: 100%;
            }
            .flow-container {
                grid-template-columns: 1fr;
            }
        }
        
        @media (max-width: 768px) {
            .flow-builder-react .main-content {
                height: 100vh;
                height: 100dvh;
                min-height: 0;
                overflow: hidden;
                padding: calc(env(safe-area-inset-top, 0px) + 72px) 10px calc(10px + env(safe-area-inset-bottom));
                gap: 8px;
            }
            .flow-builder-react .header {
                margin-bottom: 0;
                gap: 8px;
            }
            .flow-builder-react .header-title h1 {
                font-size: clamp(24px, 5vw, 30px);
            }
            .flow-builder-react .header-title {
                padding-left: 0;
                min-height: 0;
            }
            .flow-builder-react .header-title p {
                display: none;
            }
            .flow-builder-react .header-flow-row {
                display: none;
            }
            .flow-builder-react .flow-name-highlight {
                padding: 8px 10px;
                gap: 8px;
                flex-direction: column;
                align-items: flex-start;
            }
            .flow-builder-react .flow-name-highlight-name {
                font-size: 13px;
            }
            .flow-builder-react .flow-name-highlight-status {
                font-size: 10px;
                padding: 3px 8px;
            }
            .flow-builder-react .flow-name-highlight-meta {
                flex-direction: column;
                align-items: flex-start;
                width: 100%;
            }
            .flow-builder-react .flow-name-highlight-scope,
            .flow-builder-react .flow-name-highlight-link {
                width: 100%;
            }
            .flow-builder-react .flow-name-highlight-link {
                font-size: 11px;
            }
            .flow-selector-screen {
                padding: 0 0 10px;
            }
            .flow-selector-card {
                width: 100%;
                max-height: none;
                border-radius: 12px;
            }
            .flow-selector-header {
                padding: 16px 14px;
            }
            .flow-selector-header-copy {
                max-width: none;
                width: 100%;
                text-align: left;
                font-size: 12px;
            }
            .flow-selector-body {
                padding: 12px;
            }
            .flow-selector-footer {
                padding: 12px 14px;
                align-items: stretch;
                flex-direction: column;
            }
            .flow-selector-footer .btn {
                width: 100%;
                justify-content: center;
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
                grid-template-rows: auto;
                height: auto;
                min-height: 0;
                align-content: start;
            }
            .flow-builder-react .flow-container {
                display: grid;
            }
            .flow-builder-react #flowsModal.modal-overlay.active {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                min-height: 0;
                padding: calc(84px + env(safe-area-inset-top)) 10px calc(8px + env(safe-area-inset-bottom));
                background: transparent;
                backdrop-filter: none;
                z-index: 3;
                align-items: flex-start;
                justify-content: center;
            }
            .flow-builder-react #flowsModal .modal {
                width: 100%;
                max-height: min(32vh, 240px);
                height: auto;
                max-width: 760px;
                border-radius: 12px;
                box-shadow: 0 3px 14px rgba(2, 6, 23, 0.25);
                display: flex;
                flex-direction: column;
                min-height: 0;
                max-height: min(32vh, 240px);
            }
            .flow-builder-react #flowsModal .modal-close {
                display: none;
            }
            .flow-builder-react #flowsModal .modal-header {
                padding: 10px 12px;
            }
            .flow-builder-react #flowsModal .modal-header h2 {
                font-size: 14px;
            }
            .flow-builder-react #flowsModal .modal-body {
                max-height: min(22vh, 170px);
                flex: 0 1 auto;
                min-height: 0;
                padding: 8px;
                overflow-y: auto;
            }
            .flow-builder-react #flowsModal .modal-footer {
                display: none;
            }
            .flow-builder-react #flowsModal .flow-list-empty {
                border-radius: 10px;
                padding: 12px 8px;
                font-size: 13px;
            }
            .flow-builder-react.flow-mobile-modal-open .flow-container {
                margin-top: min(34vh, 250px);
            }
            .flow-canvas {
                order: 1;
                min-height: clamp(220px, 46vh, 360px);
                height: clamp(220px, 46vh, 360px);
                max-height: clamp(220px, 46vh, 360px);
            }
            .nodes-panel {
                display: none;
            }
            .node-item {
                padding: 10px 12px;
                gap: 10px;
            }
            .node-item .icon {
                width: 32px;
                height: 32px;
            }
            .flow-builder-react .header-actions {
                width: 100%;
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                padding-right: 0;
            }
            .flow-builder-react .header-flow-row {
                display: none;
            }
            .flow-builder-react .header-flow-row .flow-name-highlight {
                min-width: 0;
                width: 100%;
            }
            .flow-builder-react .flow-name-highlight-meta {
                width: 100%;
                justify-content: flex-start;
                align-items: flex-start;
                flex-direction: column;
                gap: 8px;
            }
            .flow-builder-react .flow-name-highlight-scope {
                min-width: 0;
                width: 100%;
            }
            .flow-builder-react .flow-scope-controls {
                width: 100%;
            }
            .flow-builder-react .flow-scope-select {
                min-width: 0;
                max-width: none;
                width: 100%;
            }
            .flow-list-item .name-row {
                width: 100%;
            }
            .flow-inline-name-input {
                min-width: 0;
            }
            .flow-builder-react .flow-canvas-toolbar {
                display: none;
            }
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn {
                flex: 1 1 0;
                justify-content: center;
                min-height: 36px;
                padding: 8px 10px;
            }
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn.primary,
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn.ai-highlight {
                min-width: 0;
            }
            .flow-builder-react .flow-ai-assistant-dock {
                display: none;
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
            .zoom-controls {
                right: 8px;
                bottom: calc(8px + env(safe-area-inset-bottom));
                flex-direction: row;
                align-items: center;
                gap: 4px;
                padding: 6px;
            }
            .zoom-btn {
                width: 32px;
                height: 32px;
                font-size: 16px;
            }
            .zoom-level {
                min-width: 42px;
                padding: 0 4px;
            }
            .modal-overlay {
                padding: 10px;
            }
            .modal {
                max-height: calc(100vh - 20px);
                max-height: calc(100dvh - 20px);
            }
            .modal-body {
                max-height: calc(100vh - 170px);
                max-height: calc(100dvh - 170px);
            }
            .flow-builder-react .flow-node .delete-btn,
            .flow-builder-react .flow-node .duplicate-btn {
                display: none;
            }
            .flow-builder-react .flow-node .port {
                pointer-events: none;
            }
        }

        @media (max-width: 480px) {
            .flow-builder-react .flow-scope-controls {
                flex-wrap: wrap;
            }
            .flow-builder-react .flow-scope-refresh {
                width: 34px;
                min-width: 34px;
                height: 34px;
            }
            .flow-builder-react .flow-canvas-toolbar .toolbar-btn {
                gap: 4px;
                font-size: 12px;
                padding: 8px;
            }
            .flow-builder-react .toolbar-btn-label {
                display: none;
            }
            .flow-builder-react .flow-name-highlight-link-label {
                display: none;
            }
            .nodes-panel {
                max-height: none;
            }
            .node-item .info .desc {
                display: none;
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
              <div className="header page-header flow-page-header" id="flowBuilderHeader">
                  <div className="header-title page-title">
                      <div className="header-title-row">
                          <button
                              type="button"
                              id="flowBuilderBackBtn"
                              className="flow-builder-back-btn"
                              title="Voltar para lista de fluxos"
                              aria-label="Voltar para lista de fluxos"
                              hidden
                              onClick={() => globals.openFlowsModal?.()}
                          >
                              ←
                          </button>
                          <h1><span className="icon icon-flows icon-sm"></span> Construtor de Fluxos</h1>
                      </div>
                      <p>Crie automações visuais para suas conversas</p>
                  </div>
                  <div className="page-actions flow-selector-actions" id="flowSelectorActions">
                      <button className="btn btn-outline" type="button" onClick={() => globals.openFlowsModal?.()}>
                          <span className="icon icon-refresh icon-sm"></span> Atualizar
                      </button>
                  </div>
                  <div className="header-flow-row" id="flowBuilderFlowInfoRow" hidden>
                      <div className="flow-name-highlight">
                          <div className="flow-name-highlight-content">
                              <div className="flow-name-highlight-label">Fluxo atual</div>
                              <div className="flow-name-highlight-name" id="currentFlowNameDisplay">Novo fluxo (não salvo)</div>
                          </div>
                          <div className="flow-name-highlight-meta">
                              <span className="flow-name-highlight-status draft" id="currentFlowStatusDisplay">Não salvo</span>
                              <div className="flow-name-highlight-scope">
                                  <label className="flow-scope-label" htmlFor="flowSessionScope">Conta do fluxo</label>
                                  <div className="flow-scope-controls">
                                      <select id="flowSessionScope" className="flow-scope-select" defaultValue="">
                                          <option value="">Todas as contas WhatsApp</option>
                                      </select>
                                      <button
                                          type="button"
                                          className="flow-scope-refresh"
                                          title="Atualizar contas WhatsApp"
                                          onClick={() => globals.reloadFlowSessionOptions?.()}
                                      >
                                          <span className="icon icon-refresh icon-sm"></span>
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <section className="flow-selector-screen" id="flowSelectorScreen">
                  <div className="flow-selector-card table-container">
                      <div className="flow-selector-header table-header">
                          <div className="table-title">
                              <span className="icon icon-flows icon-sm"></span>
                              Lista de Fluxos
                          </div>
                          <div className="flow-selector-header-copy" id="flowsScreenTitle">Selecione um fluxo para começar</div>
                      </div>
                      <div className="flow-selector-body">
                          <div id="flowsList"></div>
                      </div>
                      <div className="flow-selector-footer card-footer">
                          <button className="btn btn-primary" onClick={() => globals.createNewFlow?.()}>
                              <span className="icon icon-add icon-sm"></span> Criar Novo Fluxo
                          </button>
                      </div>
                  </div>
              </section>
              
              <div className="flow-container" id="flowBuilderContainer" hidden>
                  <div className="flow-canvas" id="flowCanvas">
                      <svg className="connections-svg" id="connectionsSvg"></svg>
                      
                      <div className="canvas-container" id="canvasContainer">
                          <div className="empty-canvas" id="emptyCanvas">
                              <div className="icon icon-flows"></div>
                              <h3>Comece criando seu fluxo</h3>
                              <p>Use + Novo Bloco para adicionar uma intenção</p>
                          </div>
                      </div>
                      
                      <div className="flow-canvas-toolbar" id="flowCanvasToolbar">
                          <button className="toolbar-btn secondary" id="flowCanvasSaveBtn" onClick={() => globals.saveFlow?.()}>
                              <span className="icon icon-save icon-sm"></span>
                              <span className="toolbar-btn-label">Salvar</span>
                          </button>
                          <button className="toolbar-btn primary" onClick={() => globals.addIntentBlock?.()}>
                              <span className="icon icon-add icon-sm"></span>
                              <span className="toolbar-btn-label">Novo Bloco</span>
                          </button>
                      </div>

                      <div className="flow-ai-assistant-dock" id="flowAiAssistantDock">
                          {showFlowAiAssistantLaunch ? (
                              <button
                                  className="toolbar-btn ai-highlight flow-ai-assistant-launch"
                                  id="flowAiAssistantLaunchBtn"
                                  type="button"
                                  onClick={() => globals.toggleFlowAiAssistant?.(true)}
                              >
                                  <span className="icon icon-spark icon-sm"></span>
                                  <span id="flowAiAssistantLaunchLabel" className="toolbar-btn-label">Gerar com IA</span>
                              </button>
                          ) : null}

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
                                      <span className="icon icon-spark icon-sm"></span>
                                      <span className="toolbar-btn-label">Gerar</span>
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
                      <h3 id="propertiesPanelTitle">Propriedade</h3>
                      <div id="propertiesContent">
                          <p style={{ color: 'var(--gray)', fontSize: '14px' }}>Selecione um bloco para editar suas propriedades.</p>
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
