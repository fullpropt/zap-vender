import { useEffect } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type InboxGlobals = {
  initInbox?: () => void;
  filterConversations?: (filter: string) => void;
  searchConversations?: () => void;
  changeInboxSessionFilter?: (sessionId: string) => void;
  registerCurrentUser?: () => void;
  toggleContactInfo?: (forceOpen?: boolean) => void;
  logout?: () => void;
};

export default function Inbox() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/inbox');

      if (cancelled) return;

      const win = window as Window & InboxGlobals;
      if (typeof win.initInbox === 'function') {
        win.initInbox();
      } else if (typeof (mod as { initInbox?: () => void }).initInbox === 'function') {
        (mod as { initInbox?: () => void }).initInbox?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & InboxGlobals;

  return (
    <div className="inbox-react">
      <style>{`
        .inbox-react {
            --inbox-scroll-track: rgba(7, 13, 23, 0.94);
            --inbox-scroll-track-border: rgba(255, 255, 255, 0.03);
            --inbox-scroll-thumb: rgba(var(--primary-rgb), 0.42);
            --inbox-scroll-thumb-hover: rgba(var(--primary-rgb), 0.62);
            --inbox-scroll-thumb-active: rgba(var(--primary-rgb), 0.74);
            --inbox-main-pad-y: 20px;
        }
        .inbox-container {
            display: grid;
            grid-template-columns: 350px 1fr 320px;
            grid-template-rows: 1fr;
            height: calc(100vh - (var(--inbox-main-pad-y) * 2));
            height: calc(100dvh - (var(--inbox-main-pad-y) * 2));
            gap: 0;
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
        }
        .inbox-react .conversations-list,
        .inbox-react .chat-messages,
        .inbox-react .quick-reply-picker,
        .inbox-react .inbox-right-panel,
        .inbox-react .inbox-right-panel-content,
        .inbox-react .chat-input textarea {
            scrollbar-width: thin;
            scrollbar-color: var(--inbox-scroll-thumb) var(--inbox-scroll-track);
        }
        .inbox-react .conversations-list::-webkit-scrollbar,
        .inbox-react .chat-messages::-webkit-scrollbar,
        .inbox-react .quick-reply-picker::-webkit-scrollbar,
        .inbox-react .inbox-right-panel::-webkit-scrollbar,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar,
        .inbox-react .chat-input textarea::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        .inbox-react .conversations-list::-webkit-scrollbar-track,
        .inbox-react .chat-messages::-webkit-scrollbar-track,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-track,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-track,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-track,
        .inbox-react .chat-input textarea::-webkit-scrollbar-track {
            background: linear-gradient(180deg, rgba(9, 15, 25, 0.96), rgba(11, 19, 31, 0.96));
            border-left: 1px solid var(--inbox-scroll-track-border);
        }
        .inbox-react .conversations-list::-webkit-scrollbar-thumb,
        .inbox-react .chat-messages::-webkit-scrollbar-thumb,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-thumb,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-thumb,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-thumb,
        .inbox-react .chat-input textarea::-webkit-scrollbar-thumb {
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
        .inbox-react .conversations-list::-webkit-scrollbar-thumb:hover,
        .inbox-react .chat-messages::-webkit-scrollbar-thumb:hover,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-thumb:hover,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-thumb:hover,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-thumb:hover,
        .inbox-react .chat-input textarea::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(
                180deg,
                rgba(var(--primary-rgb), 0.78) 0%,
                rgba(var(--primary-rgb), 0.5) 100%
            );
        }
        .inbox-react .conversations-list::-webkit-scrollbar-thumb:active,
        .inbox-react .chat-messages::-webkit-scrollbar-thumb:active,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-thumb:active,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-thumb:active,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-thumb:active,
        .inbox-react .chat-input textarea::-webkit-scrollbar-thumb:active {
            background: var(--inbox-scroll-thumb-active);
        }
        .inbox-react .conversations-list::-webkit-scrollbar-button,
        .inbox-react .chat-messages::-webkit-scrollbar-button,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-button,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-button,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-button,
        .inbox-react .chat-input textarea::-webkit-scrollbar-button {
            background: rgba(8, 14, 24, 0.96);
            border-left: 1px solid var(--inbox-scroll-track-border);
            border-top: 1px solid var(--inbox-scroll-track-border);
            height: 12px;
            width: 12px;
        }
        .inbox-react .conversations-list::-webkit-scrollbar-corner,
        .inbox-react .chat-messages::-webkit-scrollbar-corner,
        .inbox-react .quick-reply-picker::-webkit-scrollbar-corner,
        .inbox-react .inbox-right-panel::-webkit-scrollbar-corner,
        .inbox-react .inbox-right-panel-content::-webkit-scrollbar-corner,
        .inbox-react .chat-input textarea::-webkit-scrollbar-corner {
            background: rgba(8, 14, 24, 0.96);
        }
        @media (max-width: 1024px) {
            .inbox-container { grid-template-columns: 350px 1fr; }
            .inbox-right-panel { display: none; }
        }
        @media (max-width: 768px) {
            .inbox-container { grid-template-columns: 1fr; }
            .chat-panel { display: none; }
            .chat-panel.active { display: flex; }
            .conversations-panel.hidden { display: none; }
            .inbox-right-panel { display: none; }
        }
        .conversations-panel {
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .conversations-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
        }
        .conversations-header h2 {
            margin: 0 0 15px;
            font-size: 20px;
            color: var(--dark);
        }
        .inbox-session-filter {
            margin-bottom: 12px;
        }
        .inbox-session-filter .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--gray-700);
            margin-bottom: 6px;
        }
        .inbox-session-filter .form-select {
            width: 100%;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: var(--surface);
            color: var(--dark);
            font-size: 13px;
            padding: 9px 10px;
        }
        .inbox-session-highlight {
            margin-bottom: 12px;
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
        }
        .inbox-session-highlight-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: rgba(var(--primary-rgb), 0.9);
            font-weight: 700;
            margin-bottom: 2px;
        }
        .inbox-session-highlight-name {
            font-size: 14px;
            color: var(--dark);
            font-weight: 700;
            line-height: 1.2;
        }
        .inbox-session-highlight-meta {
            font-size: 11px;
            color: var(--gray-600);
            margin-top: 3px;
            line-height: 1.3;
        }
        .inbox-session-highlight-status {
            border-radius: 999px;
            border: 1px solid rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
        }
        .inbox-session-highlight-status.connected {
            border-color: rgba(var(--primary-rgb), 0.5);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
        }
        .inbox-session-highlight-status.disconnected {
            border-color: rgba(var(--primary-rgb), 0.3);
            background: rgba(15, 23, 42, 0.24);
            color: var(--gray-700);
        }
        .inbox-session-highlight-status.all {
            border-color: rgba(var(--primary-rgb), 0.42);
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
        }
        .conversations-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .conversations-tabs button {
            padding: 8px 16px;
            border: 1px solid var(--border-color);
            background: var(--gray-100);
            color: var(--gray-800);
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }
        .conversations-tabs button.active {
            background: var(--primary);
            color: white;
        }
        .conversations-list {
            flex: 1;
            overflow-y: auto;
            background: var(--surface);
        }
        .conversation-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 15px 20px;
            cursor: pointer;
            transition: background 0.2s;
            border-bottom: 1px solid var(--border-color);
        }
        .conversation-item:hover { background: rgba(var(--primary-rgb), 0.08); }
        .conversation-item.active { background: rgba(var(--primary-rgb), 0.16); }
        .conversation-item.unread { background: rgba(var(--primary-rgb), 0.1); }
        .conversation-item.unread .conversation-name { font-weight: 700; }
        .conversation-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: white;
            font-size: 16px;
            flex-shrink: 0;
        }
        .conversation-avatar.has-image {
            overflow: hidden;
            color: transparent;
            font-size: 0;
            padding: 0;
        }
        .conversation-avatar-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .conversation-info { flex: 1; min-width: 0; }
        .conversation-name-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .conversation-name {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-session-chip {
            flex-shrink: 0;
            max-width: 120px;
            padding: 1px 7px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 600;
            line-height: 1.4;
            color: var(--gray-700);
            background: rgba(var(--primary-rgb), 0.15);
            border: 1px solid rgba(var(--primary-rgb), 0.35);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-preview {
            font-size: 13px;
            color: var(--gray-700);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .conversation-preview-media-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 14px;
            height: 14px;
            font-size: 12px;
            line-height: 1;
            color: var(--gray-600);
            opacity: 0.9;
        }
        .conversation-meta {
            text-align: right;
            flex-shrink: 0;
        }
        .conversation-time {
            font-size: 11px;
            color: var(--gray-600);
        }
        .conversation-badge {
            background: var(--primary);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            margin-top: 5px;
            display: inline-block;
        }
        .chat-panel {
            display: flex;
            flex-direction: column;
            background: linear-gradient(180deg, rgba(24, 40, 64, 0.94), rgba(20, 35, 57, 0.96));
            min-height: 0;
            position: relative;
        }
        .chat-header {
            background: var(--surface);
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .chat-header-info { flex: 1; }
        .chat-header-name { font-weight: 600; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-header-status { font-size: 12px; color: var(--gray-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            min-height: 0;
            position: relative;
            isolation: isolate;
            background:
                radial-gradient(520px 260px at 50% 0%, rgba(53, 224, 132, 0.02), rgba(53, 224, 132, 0)),
                linear-gradient(180deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0)),
                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240' fill='none'%3E%3Cg stroke='%2335e084' stroke-width='1.15' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.028'%3E%3Cpath d='M20 34h40a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H40l-12 9V74h-8a10 10 0 0 1-10-10V44a10 10 0 0 1 10-10Z'/%3E%3Cpath d='M104 28h34a9 9 0 0 1 9 9v16a9 9 0 0 1-9 9h-17l-10 8v-8h-7a9 9 0 0 1-9-9V37a9 9 0 0 1 9-9Z'/%3E%3Cpath d='M176 42l17 9-17 9 4-9-4-9Z'/%3E%3Cpath d='M37 132c8 12 18 21 30 27l10-10c2-2 4-2 6-1 6 3 12 5 18 6 2 0 3 2 3 4v16c0 3-2 5-5 5-40-2-73-35-75-75 0-3 2-5 5-5h16c2 0 4 1 4 3 1 6 3 12 6 18 1 2 1 4-1 6l-10 10Z'/%3E%3Cpath d='M127 112l7 7 15-15'/%3E%3Cpath d='M121 120l7 7 15-15'/%3E%3Cpath d='M173 118c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z'/%3E%3Cpath d='M166 156h14'/%3E%3Cpath d='M188 156h8'/%3E%3Cpath d='M34 201h30'/%3E%3Cpath d='M86 194h20a8 8 0 0 1 8 8v10a8 8 0 0 1-8 8H94l-8 6v-6h-4a8 8 0 0 1-8-8v-10a8 8 0 0 1 8-8Z'/%3E%3Cpath d='M144 191h34a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10h-12l-10 8v-8h-12a10 10 0 0 1-10-10v-14a10 10 0 0 1 10-10Z'/%3E%3Cpath d='M149 206h24'/%3E%3Cpath d='M149 213h17'/%3E%3C/g%3E%3C/svg%3E"),
                radial-gradient(420px 220px at 85% 0%, rgba(var(--primary-rgb), 0.032), rgba(var(--primary-rgb), 0)),
                radial-gradient(320px 180px at 12% 100%, rgba(var(--primary-rgb), 0.02), rgba(var(--primary-rgb), 0)),
                linear-gradient(180deg, #182941 0%, #15253d 55%, #122036 100%);
            background-repeat: no-repeat, no-repeat, repeat, no-repeat, no-repeat, no-repeat;
            background-size: auto, auto, 180px 180px, auto, auto, auto;
            background-position: 50% 0, 0 0, 12px 8px, 85% 0, 12% 100%, 0 0;
        }
        .chat-messages::before {
            content: none;
        }
        .chat-messages::after {
            content: none;
        }
        .chat-messages > * {
            position: relative;
            z-index: 1;
        }
        .chat-messages > .chat-messages-stack {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: stretch;
            gap: 10px;
            min-height: min-content;
        }
        .chat-messages .message {
            display: block !important;
            max-width: 70%;
            width: fit-content;
            min-width: 76px;
            margin: 0 !important;
            padding: 11px 15px 10px;
            border-radius: 14px;
            border: 1px solid transparent;
            font-size: 14px;
            line-height: 1.4;
            position: relative;
            word-break: break-word;
            font-family: inherit, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
            box-shadow: 0 10px 20px rgba(2, 6, 23, 0.14);
            transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
        }
        .chat-messages .message:not(.media-sticker):hover {
            transform: translateY(-1px);
        }
        .chat-messages .message.sent {
            background:
                linear-gradient(
                    90deg,
                    rgba(var(--primary-rgb), 0.24) 0%,
                    rgba(var(--primary-rgb), 0.18) 56%,
                    rgba(18, 39, 35, 0.16) 100%
                );
            border-color: rgba(var(--primary-rgb), 0.22);
            box-shadow:
                inset 0 1px 0 rgba(var(--primary-rgb), 0.22),
                0 12px 22px rgba(2, 8, 20, 0.14);
            color: #ecfff6;
            align-self: flex-end;
            margin-left: auto !important;
            border-bottom-right-radius: 6px;
        }
        .chat-messages .message.received {
            background:
                linear-gradient(
                    90deg,
                    rgba(28, 45, 72, 0.9) 0%,
                    rgba(31, 49, 77, 0.91) 56%,
                    rgba(39, 59, 90, 0.9) 100%
                );
            border-color: rgba(255, 255, 255, 0.06);
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.03),
                0 10px 20px rgba(2, 6, 23, 0.16);
            color: var(--dark);
            align-self: flex-start;
            margin-right: auto !important;
            border-bottom-left-radius: 6px;
        }
        .chat-messages .message.sent:not(.media-sticker):hover {
            border-color: rgba(var(--primary-rgb), 0.34);
            box-shadow:
                inset 0 1px 0 rgba(var(--primary-rgb), 0.28),
                0 14px 26px rgba(2, 8, 20, 0.18),
                0 0 0 1px rgba(var(--primary-rgb), 0.06);
        }
        .chat-messages .message.received:not(.media-sticker):hover {
            border-color: rgba(var(--primary-rgb), 0.14);
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.04),
                0 14px 24px rgba(2, 6, 23, 0.18);
        }
        .message-time {
            font-size: 10px;
            color: rgba(193, 206, 224, 0.72);
            margin-top: 6px;
            display: inline-flex;
            justify-content: flex-end;
            align-items: center;
            gap: 4px;
            width: 100%;
            letter-spacing: 0.01em;
            line-height: 1;
        }
        .chat-messages .message.sent .message-time {
            color: rgba(220, 249, 235, 0.72);
        }
        .chat-messages .message.received .message-time {
            color: rgba(190, 203, 223, 0.72);
        }
        .message-status {
            display: inline-flex;
            align-items: center;
            line-height: 1;
            font-size: 11px;
            letter-spacing: -2px;
            color: rgba(226, 236, 247, 0.9);
            min-width: 14px;
        }
        .message-status .tick {
            display: inline-block;
        }
        .message-status.is-single {
            letter-spacing: 0;
        }
        .message-status.is-read {
            color: #53bdeb;
        }
        .message-status.is-failed {
            color: #f87171;
            letter-spacing: 0;
            font-weight: 700;
        }
        .message-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .message-text,
        .message-caption {
            white-space: pre-wrap;
            word-break: break-word;
        }
        .message-media {
            max-width: 100%;
        }
        .message-media-preview-trigger {
            display: block;
            border: none;
            background: transparent;
            padding: 0;
            margin: 0;
            border-radius: 10px;
            cursor: zoom-in;
            line-height: 0;
        }
        .message-media-preview-trigger:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.35);
            outline-offset: 2px;
        }
        .message-media-video-frame {
            position: relative;
            display: inline-block;
            width: fit-content;
            max-width: 100%;
        }
        .message-media-preview-fab {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(2, 6, 23, 0.62);
            color: #f8fafc;
            font-size: 14px;
            line-height: 1;
            display: grid;
            place-items: center;
            cursor: pointer;
            backdrop-filter: blur(4px);
            transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }
        .message-media-preview-fab:hover {
            transform: translateY(-1px);
            background: rgba(2, 6, 23, 0.82);
            border-color: rgba(var(--primary-rgb), 0.32);
        }
        .message-media-preview-fab:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.35);
            outline-offset: 2px;
        }
        .message-media-image {
            display: block;
            width: 100%;
            max-width: 220px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }
        .chat-messages .message.sent .message-media-image {
            border-color: rgba(var(--primary-rgb), 0.35);
        }
        .chat-messages .message.media-audio {
            min-width: 250px;
            max-width: min(360px, 78%);
            padding: 9px 12px 8px;
        }
        .message-media-audio-wrap {
            width: 100%;
        }
        .message-media-audio-native {
            display: none;
        }
        .message-audio-player {
            display: grid;
            grid-template-columns: auto minmax(110px, 1fr) auto auto;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .message-audio-toggle {
            width: 28px;
            height: 28px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
            color: inherit;
            display: grid;
            place-items: center;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            transition: border-color 0.14s ease, background-color 0.14s ease, transform 0.14s ease;
        }
        .message-audio-toggle:hover {
            transform: translateY(-1px);
        }
        .chat-messages .message.sent .message-audio-toggle {
            border-color: rgba(var(--primary-rgb), 0.2);
            background: rgba(var(--primary-rgb), 0.08);
        }
        .chat-messages .message.received .message-audio-toggle {
            border-color: rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
        }
        .message-audio-toggle:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.28);
            outline-offset: 1px;
            border-color: rgba(var(--primary-rgb), 0.28);
        }
        .message-audio-toggle-icon {
            font-size: 12px;
            transform: translateX(0.5px);
        }
        .message-audio-player.is-playing .message-audio-toggle-icon {
            font-size: 10px;
            transform: none;
        }
        .message-audio-range {
            width: 100%;
            min-width: 0;
            margin: 0;
            background: transparent;
            accent-color: var(--primary);
            -webkit-appearance: none;
            appearance: none;
            cursor: pointer;
            height: 20px;
        }
        .message-audio-range::-webkit-slider-runnable-track {
            height: 2px;
            border-radius: 999px;
            background:
                linear-gradient(
                    90deg,
                    rgba(var(--primary-rgb), 0.72) 0%,
                    rgba(var(--primary-rgb), 0.72) var(--audio-progress),
                    rgba(255, 255, 255, 0.12) var(--audio-progress),
                    rgba(255, 255, 255, 0.12) 100%
                );
        }
        .chat-messages .message.sent .message-audio-range::-webkit-slider-runnable-track {
            background:
                linear-gradient(
                    90deg,
                    rgba(209, 255, 233, 0.82) 0%,
                    rgba(209, 255, 233, 0.82) var(--audio-progress),
                    rgba(232, 255, 244, 0.16) var(--audio-progress),
                    rgba(232, 255, 244, 0.16) 100%
                );
        }
        .message-audio-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            border: 1px solid rgba(var(--primary-rgb), 0.32);
            background: #eafcf4;
            margin-top: -4px;
            box-shadow: 0 1px 6px rgba(2, 6, 23, 0.2);
            opacity: 0;
            transition: opacity 0.14s ease, transform 0.14s ease;
        }
        .message-audio-player:hover .message-audio-range::-webkit-slider-thumb,
        .message-audio-range:focus-visible::-webkit-slider-thumb {
            opacity: 1;
        }
        .message-audio-range::-moz-range-track {
            height: 2px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.12);
        }
        .message-audio-range::-moz-range-progress {
            height: 2px;
            border-radius: 999px;
            background: rgba(var(--primary-rgb), 0.72);
        }
        .chat-messages .message.sent .message-audio-range::-moz-range-progress {
            background: rgba(209, 255, 233, 0.82);
        }
        .message-audio-range::-moz-range-thumb {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            border: 1px solid rgba(var(--primary-rgb), 0.32);
            background: #eafcf4;
            box-shadow: 0 1px 6px rgba(2, 6, 23, 0.2);
            opacity: 0;
            transition: opacity 0.14s ease;
        }
        .message-audio-player:hover .message-audio-range::-moz-range-thumb,
        .message-audio-range:focus-visible::-moz-range-thumb {
            opacity: 1;
        }
        .message-audio-range:focus-visible {
            outline: none;
        }
        .message-audio-time {
            font-size: 10px;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.01em;
            white-space: nowrap;
            color: rgba(189, 202, 221, 0.85);
        }
        .chat-messages .message.sent .message-audio-time {
            color: rgba(225, 252, 241, 0.84);
        }
        .message-media-download {
            color: var(--gray-700);
            text-decoration: none;
            font-size: 11px;
            font-weight: 600;
            width: fit-content;
        }
        .message-audio-download {
            display: inline-grid;
            place-items: center;
            width: 20px;
            min-width: 20px;
            height: 20px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
            font-size: 11px;
            line-height: 1;
            opacity: 0.86;
        }
        .message-audio-download:hover {
            text-decoration: none;
            opacity: 1;
            border-color: rgba(var(--primary-rgb), 0.2);
            background: rgba(var(--primary-rgb), 0.08);
        }
        .chat-messages .message.sent .message-media-download {
            color: rgba(236, 255, 246, 0.9);
        }
        .message-media-video {
            display: block;
            width: 100%;
            max-width: 220px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: #000;
        }
        .chat-messages .message.sent .message-media-video {
            border-color: rgba(var(--primary-rgb), 0.35);
        }
        .chat-messages .message.media-sticker {
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 4px 4px 6px;
            min-width: 0;
            max-width: 180px;
        }
        .chat-messages .message.sent.media-sticker,
        .chat-messages .message.received.media-sticker {
            background: transparent;
            border: none;
        }
        .message-media-sticker-wrap {
            display: inline-block;
        }
        .message-media-sticker {
            display: block;
            width: 100%;
            max-width: 140px;
            height: auto;
            border-radius: 8px;
            filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.2));
        }
        .chat-messages .message.media-sticker .message-time {
            margin-top: 6px;
            padding-inline: 4px;
        }
        .message-document-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            max-width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.12);
            color: inherit;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
        }
        .message-document-link span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .chat-messages .message.sent .message-document-link {
            border-color: rgba(var(--primary-rgb), 0.35);
            background: rgba(var(--primary-rgb), 0.16);
        }
        .chat-media-preview-modal[hidden] {
            display: none !important;
        }
        .chat-media-preview-modal {
            position: fixed;
            inset: 0;
            z-index: 1400;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(2, 6, 23, 0.78);
            backdrop-filter: blur(6px);
        }
        .chat-media-preview-dialog {
            position: relative;
            width: min(94vw, 1120px);
            max-height: 92vh;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
                radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.09), transparent 48%),
                rgba(4, 10, 18, 0.92);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
            padding: 14px;
        }
        .chat-media-preview-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 34px;
            height: 34px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(15, 23, 42, 0.76);
            color: #e2e8f0;
            display: grid;
            place-items: center;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
            z-index: 2;
        }
        .chat-media-preview-close:hover {
            border-color: rgba(var(--primary-rgb), 0.28);
            color: #ffffff;
        }
        .chat-media-preview-close:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.35);
            outline-offset: 2px;
        }
        .chat-media-preview-content {
            min-height: 160px;
            max-height: calc(92vh - 28px);
            display: grid;
            place-items: center;
            overflow: auto;
            border-radius: 12px;
        }
        .chat-media-preview-image,
        .chat-media-preview-video {
            display: block;
            max-width: 100%;
            max-height: calc(92vh - 70px);
            border-radius: 12px;
            background: #000;
            box-shadow: 0 14px 38px rgba(0, 0, 0, 0.28);
        }
        .chat-media-preview-video {
            width: min(100%, 960px);
        }
        .chat-input {
            background: var(--surface);
            border-top: 1px solid var(--border-color);
            padding: 15px 20px;
            display: flex;
            gap: 15px;
            align-items: flex-end;
            position: relative;
        }
        .chat-input .chat-input-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
            flex-shrink: 0;
        }
        .chat-input .chat-send-btn {
            background: var(--whatsapp);
        }
        .chat-input .chat-attach-btn {
            background: var(--surface-muted);
            border: 1px solid var(--border-color);
            color: var(--gray-700);
        }
        .chat-input .chat-emoji-btn {
            background: var(--surface-muted);
            border: 1px solid var(--border-color);
            color: var(--gray-700);
        }
        .chat-input .chat-input-btn:hover { transform: scale(1.05); }
        .chat-scroll-bottom-btn {
            position: absolute;
            right: 20px;
            bottom: 86px;
            width: 38px;
            height: 38px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(14, 23, 36, 0.94);
            color: rgba(227, 236, 246, 0.9);
            display: grid;
            place-items: center;
            cursor: pointer;
            box-shadow:
                0 8px 18px rgba(2, 6, 23, 0.24);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(8px) scale(0.96);
            transition:
                opacity 0.16s ease,
                transform 0.16s ease,
                border-color 0.16s ease,
                box-shadow 0.16s ease,
                visibility 0.16s ease;
            z-index: 16;
        }
        .chat-scroll-bottom-btn.visible {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(0) scale(1);
        }
        .chat-scroll-bottom-btn:hover {
            border-color: rgba(255, 255, 255, 0.16);
            box-shadow:
                0 10px 22px rgba(2, 6, 23, 0.28);
            background: rgba(15, 25, 39, 0.96);
        }
        .chat-scroll-bottom-btn:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.34);
            outline-offset: 2px;
            border-color: rgba(var(--primary-rgb), 0.32);
        }
        .chat-scroll-bottom-btn .chat-scroll-bottom-icon {
            display: inline-block;
            line-height: 1;
            font-size: 15px;
            transform: translateY(-1px);
        }
        .chat-input .chat-emoji-picker {
            display: none;
            position: absolute;
            left: 20px;
            bottom: calc(100% + 10px);
            width: min(320px, calc(100% - 40px));
            max-height: min(360px, 46vh);
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 10px;
            border-radius: 14px;
            border: 1px solid rgba(var(--primary-rgb), 0.16);
            background:
                radial-gradient(180px 90px at 80% 0%, rgba(var(--primary-rgb), 0.08), rgba(var(--primary-rgb), 0)),
                linear-gradient(180deg, rgba(12, 20, 32, 0.98), rgba(10, 16, 27, 0.99));
            box-shadow: 0 16px 30px rgba(2, 6, 23, 0.35);
            z-index: 20;
        }
        .chat-input .chat-emoji-picker.open {
            display: block;
        }
        .chat-input .chat-emoji-section + .chat-emoji-section {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .chat-input .chat-emoji-section-title {
            margin: 0 0 6px;
            color: rgba(191, 206, 227, 0.82);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            line-height: 1.2;
        }
        .chat-input .chat-emoji-section-grid {
            display: grid;
            grid-template-columns: repeat(8, minmax(0, 1fr));
            gap: 6px;
        }
        .chat-input .chat-emoji-item {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 10px;
            border: 1px solid transparent;
            background: rgba(255, 255, 255, 0.02);
            color: #eef7f7;
            cursor: pointer;
            display: grid;
            place-items: center;
            font-size: 18px;
            line-height: 1;
            padding: 0;
            transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
        }
        .chat-input .chat-emoji-item:hover {
            transform: translateY(-1px);
            border-color: rgba(var(--primary-rgb), 0.22);
            background: rgba(var(--primary-rgb), 0.1);
        }
        .chat-input .chat-emoji-item:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.35);
            outline-offset: 1px;
            border-color: rgba(var(--primary-rgb), 0.28);
            background: rgba(var(--primary-rgb), 0.12);
        }
        .chat-input textarea {
            flex: 1;
            border: 1px solid var(--border-color);
            border-radius: 20px;
            background: var(--surface-muted);
            color: var(--dark);
            padding: 12px 20px;
            font-size: 14px;
            resize: none;
            max-height: 120px;
            font-family: inherit, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
        }
        .chat-input textarea::placeholder { color: var(--gray-500); }
        .chat-input textarea:focus {
            outline: none;
            border-color: var(--primary);
        }
        .quick-reply-trigger {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 44px;
            border-radius: 14px;
            padding: 0 12px;
            font-weight: 600;
            font-size: 13px;
            flex-shrink: 0;
            white-space: nowrap;
            border: 1px solid var(--border-color);
            background: var(--surface-muted);
            color: var(--gray-700);
            cursor: pointer;
            transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .quick-reply-trigger:hover {
            background: rgba(var(--primary-rgb), 0.08);
            border-color: rgba(var(--primary-rgb), 0.2);
            color: var(--dark);
            transform: translateY(-1px);
        }
        .quick-reply-trigger:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.32);
            outline-offset: 1px;
            border-color: rgba(var(--primary-rgb), 0.24);
        }
        .quick-reply-picker {
            display: none;
            position: absolute;
            left: 20px;
            right: 20px;
            bottom: calc(100% + 10px);
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            padding: 8px;
            max-height: 220px;
            overflow-y: auto;
            z-index: 25;
        }
        .quick-reply-picker.open {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .quick-reply-option {
            width: 100%;
            border: 1px solid transparent;
            border-radius: 10px;
            background: transparent;
            color: var(--dark);
            text-align: left;
            font-size: 13px;
            padding: 10px 12px;
            cursor: pointer;
        }
        .quick-reply-option:hover {
            background: rgba(var(--primary-rgb), 0.1);
            border-color: var(--border-color);
        }
        .quick-reply-option:focus-visible {
            outline: 2px solid rgba(var(--primary-rgb), 0.28);
            outline-offset: 1px;
            border-color: rgba(var(--primary-rgb), 0.22);
            background: rgba(var(--primary-rgb), 0.08);
        }
        .quick-reply-empty {
            padding: 10px 12px;
            font-size: 13px;
            color: var(--gray-700);
        }
        .chat-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--gray-700);
            background:
                radial-gradient(360px 180px at 80% 0%, rgba(var(--primary-rgb), 0.03), rgba(var(--primary-rgb), 0)),
                linear-gradient(180deg, #15263f 0%, #132238 55%, #112034 100%);
            position: relative;
            isolation: isolate;
            overflow: hidden;
        }
        .chat-empty::before {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 0;
            opacity: 0.024;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240' fill='none'%3E%3Cg stroke='%2335e084' stroke-width='1.15' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.9'%3E%3Cpath d='M20 34h40a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H40l-12 9V74h-8a10 10 0 0 1-10-10V44a10 10 0 0 1 10-10Z'/%3E%3Cpath d='M104 28h34a9 9 0 0 1 9 9v16a9 9 0 0 1-9 9h-17l-10 8v-8h-7a9 9 0 0 1-9-9V37a9 9 0 0 1 9-9Z'/%3E%3Cpath d='M176 42l17 9-17 9 4-9-4-9Z'/%3E%3Cpath d='M37 132c8 12 18 21 30 27l10-10c2-2 4-2 6-1 6 3 12 5 18 6 2 0 3 2 3 4v16c0 3-2 5-5 5-40-2-73-35-75-75 0-3 2-5 5-5h16c2 0 4 1 4 3 1 6 3 12 6 18 1 2 1 4-1 6l-10 10Z'/%3E%3Cpath d='M127 112l7 7 15-15'/%3E%3Cpath d='M121 120l7 7 15-15'/%3E%3Cpath d='M173 118c7 0 13 6 13 13s-6 13-13 13-13-6-13-13 6-13 13-13Z'/%3E%3Cpath d='M166 156h14'/%3E%3Cpath d='M188 156h8'/%3E%3Cpath d='M34 201h30'/%3E%3Cpath d='M86 194h20a8 8 0 0 1 8 8v10a8 8 0 0 1-8 8H94l-8 6v-6h-4a8 8 0 0 1-8-8v-10a8 8 0 0 1 8-8Z'/%3E%3Cpath d='M144 191h34a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10h-12l-10 8v-8h-12a10 10 0 0 1-10-10v-14a10 10 0 0 1 10-10Z'/%3E%3Cpath d='M149 206h24'/%3E%3Cpath d='M149 213h17'/%3E%3C/g%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 180px 180px;
            background-position: 12px 8px;
        }
        .chat-empty > * {
            position: relative;
            z-index: 1;
        }
        .chat-empty-icon { font-size: 80px; margin-bottom: 20px; opacity: 0.5; }
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 10px 15px;
            background: var(--surface);
            border-radius: 12px;
            align-self: flex-start;
        }
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--gray-400);
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-5px); }
        }
        .contact-info-panel { display: none; }
        .inbox-right-panel {
            background: var(--surface);
            border-left: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 24px;
            min-height: 0;
        }
        .inbox-right-panel-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .inbox-right-panel-content.ready { align-items: stretch; justify-content: flex-start; text-align: left; }
        .inbox-right-panel-robot { font-size: 64px; margin-bottom: 20px; opacity: 0.6; }
        .inbox-right-panel p { color: var(--gray-700); line-height: 1.5; margin: 0 0 16px; font-size: 14px; }
        .inbox-right-panel .btn-register-user { background: var(--whatsapp, #25d366); color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; }
        .inbox-right-panel .btn-register-user:hover { opacity: 0.9; }
        .inbox-main-content {
            padding: var(--inbox-main-pad-y) 20px;
            box-sizing: border-box;
        }
        .chat-header-actions { display: flex; gap: 8px; align-items: center; }
        .chat-back-btn { display: none; }
        .contact-info-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.64);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity var(--transition), visibility var(--transition);
            z-index: 3390;
        }
        .contact-info-backdrop.active {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .contact-card { width: 100%; display: flex; flex-direction: column; gap: 16px; text-align: left; }
        .contact-card-empty { width: 100%; max-width: 260px; }
        .contact-card-header { display: flex; align-items: center; gap: 12px; }
        .contact-card-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-weight: 700;
        }
        .contact-card-avatar.has-image {
            overflow: hidden;
            color: transparent;
            font-size: 0;
            padding: 0;
        }
        .contact-card-avatar-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .contact-card-title { font-size: 16px; font-weight: 700; color: var(--dark); }
        .contact-card-subtitle { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
        .contact-card-section {
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 12px;
            background: rgba(15, 23, 42, 0.18);
        }
        .contact-card-section-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: var(--gray-600);
            margin-bottom: 10px;
        }
        .contact-info-grid,
        .contact-card-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .contact-info-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: baseline;
            font-size: 13px;
        }
        .contact-info-label { color: var(--gray-600); }
        .contact-info-value {
            color: var(--dark);
            font-weight: 600;
            text-align: right;
            max-width: 60%;
            word-break: break-word;
        }
        .contact-tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .contact-tag-chip {
            display: inline-flex;
            align-items: center;
            border: 1px solid var(--border-color);
            border-radius: 999px;
            padding: 3px 10px;
            font-size: 12px;
            color: var(--gray-700);
            background: rgba(var(--primary-rgb), 0.12);
        }
        .contact-card-muted { color: var(--gray-600); font-size: 12px; margin: 0; }
        .contact-card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .contact-card-actions .btn { width: 100%; }

        @media (max-width: 1024px) {
            .inbox-container {
                grid-template-columns: 340px 1fr !important;
            }
            .inbox-right-panel {
                display: flex !important;
                position: fixed;
                right: 0;
                top: 0;
                width: min(92vw, 360px);
                height: 100vh;
                z-index: 3400;
                transform: translateX(100%);
                transition: transform var(--transition);
                box-shadow: -12px 0 28px rgba(0, 0, 0, 0.28);
            }
            .inbox-right-panel.active {
                transform: translateX(0);
            }
        }

        @media (max-width: 768px) {
            .inbox-react { --inbox-main-pad-y: 8px; }
            .inbox-main-content { padding: 8px !important; }
            .inbox-container {
                grid-template-columns: 1fr !important;
                border-radius: 12px;
            }
            .conversations-panel {
                display: flex !important;
                border-right: none;
            }
            .conversations-panel.hidden {
                display: none !important;
            }
            .chat-panel {
                display: none !important;
            }
            .chat-panel.active {
                display: flex !important;
            }
            .chat-header {
                padding: 10px 12px;
                gap: 10px;
            }
            .chat-back-btn {
                display: inline-flex;
            }
            .chat-header-actions {
                gap: 6px;
            }
            .chat-header-actions .btn.btn-icon {
                width: 34px;
                height: 34px;
            }
            .chat-messages {
                padding: 10px 12px;
            }
            .chat-messages .message {
                max-width: 86%;
                font-size: 13px;
            }
            .chat-input {
                padding: 10px 12px;
                gap: 10px;
            }
            .chat-scroll-bottom-btn {
                right: 12px;
                bottom: 76px;
                width: 36px;
                height: 36px;
            }
            .quick-reply-trigger {
                height: 42px;
                padding: 0 10px;
                font-size: 12px;
                gap: 5px;
            }
            .quick-reply-picker {
                left: 12px;
                right: 12px;
                bottom: calc(100% + 8px);
            }
            .chat-input .chat-emoji-picker {
                left: 12px;
                right: 12px;
                width: auto;
                bottom: calc(100% + 8px);
                padding: 8px;
                border-radius: 12px;
            }
            .chat-input .chat-emoji-section-title {
                margin-bottom: 5px;
                font-size: 9px;
            }
            .chat-input .chat-emoji-section + .chat-emoji-section {
                margin-top: 8px;
                padding-top: 8px;
            }
            .chat-input .chat-emoji-section-grid {
                grid-template-columns: repeat(7, minmax(0, 1fr));
                gap: 5px;
            }
            .chat-input .chat-input-btn {
                width: 42px;
                height: 42px;
            }
            .chat-messages .message.media-audio {
                min-width: 0;
                max-width: 100%;
            }
            .message-audio-player {
                grid-template-columns: auto minmax(76px, 1fr) auto auto;
                gap: 6px;
            }
            .message-audio-time {
                font-size: 9px;
            }
            .message-audio-toggle {
                width: 26px;
                height: 26px;
            }
            .chat-media-preview-modal {
                padding: 12px;
            }
            .chat-media-preview-dialog {
                width: 100%;
                max-height: 94vh;
                padding: 10px;
            }
            .chat-media-preview-content {
                max-height: calc(94vh - 20px);
            }
            .chat-media-preview-image,
            .chat-media-preview-video {
                max-height: calc(94vh - 56px);
                border-radius: 10px;
            }
            .chat-media-preview-close {
                top: 6px;
                right: 6px;
                width: 32px;
                height: 32px;
            }
            .conversations-header {
                padding: 14px 12px;
            }
            .conversations-header h2 {
                font-size: 18px;
                margin-bottom: 10px;
            }
            .inbox-session-highlight {
                padding: 8px 10px;
                gap: 8px;
            }
            .inbox-session-highlight-name {
                font-size: 13px;
            }
            .inbox-session-highlight-status {
                font-size: 10px;
                padding: 3px 8px;
            }
            .conversations-tabs {
                margin-bottom: 10px;
            }
            .conversations-list .conversation-item {
                padding: 12px;
            }
            .contact-card-actions {
                grid-template-columns: 1fr;
            }
        }
      `}</style>

      <button
        className="mobile-menu-toggle"
        type="button"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        {'\u2630'}
      </button>
      <div
        className="sidebar-overlay"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      ></div>

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
              <li className="nav-item">
                <Link to="/inbox" className="nav-link active">
                  <span className="icon icon-inbox"></span>Inbox
                  <span className="badge" id="unreadBadge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>Configurações
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="whatsapp-status">
            <span className="status-indicator disconnected"></span>
            <span className="whatsapp-status-text">Desconectado</span>
          </div>
          <button className="btn-logout" onClick={() => globals.logout?.()}>Sair</button>
        </div>
      </aside>

      <main className="main-content inbox-main-content">
        <div className="inbox-container">
          <div className="conversations-panel" id="conversationsPanel">
            <div className="conversations-header">
              <h2><span className="icon icon-inbox icon-sm"></span> Inbox</h2>
              <div className="inbox-session-filter">
                <label className="form-label" htmlFor="inboxSessionFilter">Conta WhatsApp</label>
                <select
                  id="inboxSessionFilter"
                  className="form-select"
                  defaultValue=""
                  onChange={(event) => globals.changeInboxSessionFilter?.((event.target as HTMLSelectElement).value)}
                >
                  <option value="">Todas as contas</option>
                </select>
              </div>
              <div className="inbox-session-highlight" id="inboxSessionIndicator">
                <div>
                  <div className="inbox-session-highlight-label">Conta exibida</div>
                  <div className="inbox-session-highlight-name">Todas as contas</div>
                  <div className="inbox-session-highlight-meta">Mostrando conversas de todas as contas</div>
                </div>
                <span className="inbox-session-highlight-status all">Filtro geral</span>
              </div>
              <div className="conversations-tabs">
                <button id="filterAllBtn" className="active" onClick={() => globals.filterConversations?.('all')}>Todos</button>
                <button id="filterUnreadBtn" onClick={() => globals.filterConversations?.('unread')}>Não lidos</button>
              </div>
              <div className="search-box" style={{ maxWidth: '100%' }}>
                <span className="search-icon icon icon-search icon-sm"></span>
                <input
                  type="text"
                  id="searchConversations"
                  placeholder="Buscar conversa..."
                  onKeyUp={() => globals.searchConversations?.()}
                />
              </div>
            </div>
            <div className="conversations-list" id="conversationsList">
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Carregando conversas...</p>
              </div>
            </div>
          </div>

          <div className="chat-panel" id="chatPanel">
            <div className="chat-empty">
              <div className="chat-empty-icon icon icon-empty icon-lg"></div>
              <h3>Nenhum chat selecionado</h3>
              <p>Selecione uma conversa da lista ao lado para começar a conversar</p>
            </div>
          </div>

          <div className="inbox-right-panel" id="inboxRightPanel">
            <div className="inbox-right-panel-content" id="inboxRightContent">
              <span className="inbox-right-panel-robot icon icon-automation icon-lg"></span>
              <p><strong>Este cliente ainda não está cadastrado na sua audiência.</strong></p>
              <p>Vamos cadastrá-lo para que o cartão do usuário dele apareça aqui?</p>
              <button className="btn-register-user" onClick={() => globals.registerCurrentUser?.()}>
                SIM! Cadastrar este usuário
              </button>
            </div>
          </div>
        </div>
        <div className="contact-info-backdrop" id="contactInfoBackdrop" onClick={() => globals.toggleContactInfo?.(false)}></div>
        <div className="chat-media-preview-modal" id="chatMediaPreviewModal" hidden aria-hidden="true">
          <div className="chat-media-preview-dialog" id="chatMediaPreviewDialog" role="dialog" aria-modal="true" aria-label="Visualizacao de midia">
            <button className="chat-media-preview-close" id="chatMediaPreviewCloseBtn" type="button" aria-label="Fechar visualizacao">×</button>
            <div className="chat-media-preview-content" id="chatMediaPreviewContent"></div>
          </div>
        </div>
      </main>
    </div>
  );
}
