import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
import './footer.css';

type FooterPremiumProps = {
  onNavigateSection?: (sectionId: string) => void;
};

export default function FooterPremium({ onNavigateSection }: FooterPremiumProps) {
  const currentYear = new Date().getFullYear();

  const handleSectionNavigate = (sectionId: string) => {
    onNavigateSection?.(sectionId);
  };

  return (
    <footer className="premium-footer" aria-label="Rodape principal">
      <div className="premium-footer-shell">
        <div className="premium-footer-grid">
          <section className="premium-footer-col premium-footer-brand-col" aria-label="Marca e posicionamento">
            <Link to="/planos" className="premium-footer-brand" aria-label={`${brandName} pagina inicial de planos`}>
              <img src={brandLogoUrl} alt="" aria-hidden="true" />
              <span>{brandName}</span>
            </Link>

            <p className="premium-footer-positioning">
              SaaS para escalar atendimento e vendas no WhatsApp com operacao previsivel.
            </p>

            <ul className="premium-footer-benefits" aria-label="Beneficios principais">
              <li>API Oficial</li>
              <li>Infraestrutura Segura</li>
              <li>Suporte Especializado</li>
            </ul>
          </section>

          <nav className="premium-footer-col" aria-label="Links de produto">
            <h3>Produto</h3>
            <ul className="premium-footer-links">
              <li><button type="button" onClick={() => handleSectionNavigate('recursos')}>Recursos</button></li>
              <li><button type="button" onClick={() => handleSectionNavigate('planos-lista')}>Planos</button></li>
              <li><Link to="/configuracoes">Integracoes</Link></li>
              <li><button type="button" onClick={() => handleSectionNavigate('solucao')}>Solução</button></li>
            </ul>
          </nav>

          <nav className="premium-footer-col" aria-label="Links institucionais">
            <h3>Empresa</h3>
            <ul className="premium-footer-links">
              <li><button type="button" onClick={() => handleSectionNavigate('visao-geral')}>Sobre</button></li>
              <li><a href="mailto:comercial@zapvender.com.br">Contato</a></li>
              <li><Link to="/login?tab=terms">Termos</Link></li>
              <li><Link to="/login?tab=privacy">Privacidade</Link></li>
            </ul>
          </nav>

          <section className="premium-footer-col premium-footer-cta-col" aria-label="Chamada principal para assinatura">
            <h3 className="premium-footer-cta-title">Pronto para escalar seu atendimento?</h3>
            <Link to="/login" className="premium-footer-btn premium-footer-btn-primary">Assinar agora</Link>
            <a href="mailto:comercial@zapvender.com.br" className="premium-footer-btn premium-footer-btn-secondary">
              Falar com especialista
            </a>
          </section>
        </div>

        <div className="premium-footer-bottom">
          <span>{`© ${currentYear} ${brandName}. Todos os direitos reservados.`}</span>
          <span>Feito para operacoes que precisam de velocidade e controle.</span>
        </div>
      </div>
    </footer>
  );
}
