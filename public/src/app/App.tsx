import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Automacao from './pages/Automacao';
import AdminDashboard from './pages/AdminDashboard';
import Campanhas from './pages/Campanhas';
import Configuracoes from './pages/Configuracoes';
import Contatos from './pages/Contatos';
import Conversas from './pages/Conversas';
import ConversasV2 from './pages/ConversasV2';
import Dashboard from './pages/Dashboard';
import FlowBuilder from './pages/FlowBuilder';
import Fluxos from './pages/Fluxos';
import Funil from './pages/Funil';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Login from './pages/Login';
import Planos from './pages/Planos';
import Transmissao from './pages/Transmissao';
import Whatsapp from './pages/Whatsapp';

export default function App() {
  const location = useLocation();

  const closeSidebar = () => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement | null;

    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  };

  const syncSidebarAccessibility = () => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const isOpen = Boolean(sidebar?.classList.contains('open'));
    const toggles = document.querySelectorAll('.mobile-menu-toggle');

    toggles.forEach((toggle) => {
      if (!(toggle instanceof HTMLButtonElement)) return;
      toggle.type = 'button';
      toggle.setAttribute('aria-label', isOpen ? 'Fechar menu de navegacao' : 'Abrir menu de navegacao');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.body.classList.toggle('sidebar-open', isOpen);
  };

  const syncApplicationAdminSidebarShortcut = () => {
    const isApplicationAdmin = sessionStorage.getItem('selfDashboardIsAppAdmin') === '1';
    const sidebars = document.querySelectorAll('.sidebar');
    const isAdminDashboardRoute = location.pathname === '/admin-dashboard';

    sidebars.forEach((sidebarEl) => {
      if (!(sidebarEl instanceof HTMLElement)) return;
      const footer = sidebarEl.querySelector('.sidebar-footer');
      if (!(footer instanceof HTMLElement)) return;

      let wrapper = footer.querySelector('.sidebar-admin-access');
      if (!(wrapper instanceof HTMLElement)) {
        wrapper = null;
      }

      if (!isApplicationAdmin) {
        wrapper?.remove();
        return;
      }

      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'sidebar-admin-access';
        footer.insertBefore(wrapper, footer.firstChild || null);
      }

      let link = wrapper.querySelector('a');
      if (!(link instanceof HTMLAnchorElement)) {
        link = document.createElement('a');
        link.href = '#/admin-dashboard';
        link.className = 'nav-link sidebar-admin-link';
        link.innerHTML = '<span class="icon icon-building"></span>Admin da Aplicacao';
        wrapper.appendChild(link);
      }

      link.classList.toggle('active', isAdminDashboardRoute);
      if (isAdminDashboardRoute) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  useEffect(() => {
    (window as Window & { refreshWhatsAppStatus?: () => void }).refreshWhatsAppStatus?.();
    closeSidebar();
    syncSidebarAccessibility();
    syncApplicationAdminSidebarShortcut();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('.mobile-menu-toggle')) {
        window.setTimeout(() => {
          syncSidebarAccessibility();
        }, 0);
        return;
      }

      if (target.closest('.sidebar-overlay')) {
        closeSidebar();
        return;
      }

      if (target.closest('.sidebar .nav-link') && window.matchMedia('(max-width: 1024px)').matches) {
        closeSidebar();
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/planos" element={<Planos />} />
      <Route path="/venda" element={<Planos />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/contatos" element={<Contatos />} />
      <Route path="/campanhas" element={<Campanhas />} />
      <Route path="/automacao" element={<Automacao />} />
      <Route path="/fluxos" element={<Fluxos />} />
      <Route path="/flow-builder" element={<FlowBuilder />} />
      <Route path="/funil" element={<Funil />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/conversas" element={<Conversas />} />
      <Route path="/conversas-v2" element={<ConversasV2 />} />
      <Route path="/transmissao" element={<Transmissao />} />
      <Route path="/whatsapp" element={<Whatsapp />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
    </Routes>
  );
}
