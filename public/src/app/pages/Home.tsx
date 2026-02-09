import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="app-shell">
      <header className="page-header" style={{ padding: '24px' }}>
        <div className="page-title">
          <h1>SELF Proteção Veicular</h1>
          <p>Nova aplicação React (migração gradual)</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" to="/">Início</Link>
          <Link className="btn btn-outline" to="/dashboard">Dashboard React</Link>
          <a className="btn btn-outline" href="dashboard.html">Dashboard antigo</a>
        </div>
      </header>

      <main className="main-content" style={{ padding: '0 24px 24px' }}>
        <section className="card" style={{ padding: '24px' }}>
          <h2 style={{ marginTop: 0 }}>Migração para React</h2>
          <p>
            Esta é a base React do projeto. Vamos migrar tela por tela, mantendo o HTML antigo funcionando.
          </p>
          <p>
            Comece acessando o Dashboard React e compare com o legado.
          </p>
        </section>
      </main>
    </div>
  );
}