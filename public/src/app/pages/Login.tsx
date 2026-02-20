import { useEffect } from 'react';
import { brandFullLogoUrl, brandName } from '../lib/brand';

type LoginGlobals = {
  initLogin?: () => void;
  handleLogin?: (event: Event) => boolean | Promise<boolean>;
  handleRegister?: (event: Event) => boolean | Promise<boolean>;
  showLogin?: () => void;
  showRegister?: () => void;
};

export default function Login() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const mod = await import('../../pages/login');

      if (cancelled) return;

      const win = window as Window & LoginGlobals;
      if (typeof win.initLogin === 'function') {
        win.initLogin();
      } else if (typeof (mod as { initLogin?: () => void }).initLogin === 'function') {
        (mod as { initLogin?: () => void }).initLogin?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & LoginGlobals;

  return (
    <div className="login-react">
      <style>{`
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .login-react {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background:
                radial-gradient(900px 520px at 85% 8%, rgba(23, 140, 73, 0.16) 0%, rgba(23, 140, 73, 0) 60%),
                radial-gradient(700px 420px at 12% 86%, rgba(30, 64, 175, 0.14) 0%, rgba(30, 64, 175, 0) 65%),
                linear-gradient(135deg, #020817 0%, #091224 50%, #020617 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: linear-gradient(165deg, rgba(18, 33, 54, 0.97) 0%, rgba(12, 24, 40, 0.97) 100%);
            padding: 34px 34px 28px;
            border-radius: 22px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            box-shadow: 0 26px 72px rgba(2, 6, 23, 0.58);
            width: 100%;
            max-width: 430px;
        }

        .login-logo {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
        }

        .login-logo img {
            width: clamp(150px, 42vw, 210px);
            height: auto;
            display: block;
            filter: drop-shadow(0 10px 18px rgba(2, 6, 23, 0.45));
        }

        .login-title {
            text-align: center;
            color: #e8eef8;
            margin-bottom: 6px;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 700;
        }

        .login-subtitle {
            text-align: center;
            color: #9fb0c8;
            margin-bottom: 24px;
            font-size: 14px;
        }

        .form-section-title {
            font-size: 18px;
            font-weight: 700;
            color: #dbe6f7;
            margin-bottom: 14px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            margin-bottom: 7px;
            color: #d8e4f6;
            font-weight: 600;
        }

        .form-input {
            width: 100%;
            padding: 13px 14px;
            border: 1px solid rgba(148, 163, 184, 0.32);
            border-radius: 10px;
            font-size: 15px;
            color: #eaf1ff;
            background: rgba(30, 47, 72, 0.86);
            transition: all 0.3s;
        }

        .form-input::placeholder {
            color: #8ea3bf;
        }

        .form-input:focus {
            outline: none;
            border-color: rgba(23, 140, 73, 0.78);
            box-shadow: 0 0 0 3px rgba(23, 140, 73, 0.18);
            background: rgba(34, 56, 84, 0.94);
        }

        .btn-login {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #1aae5e 0%, #178c49 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(23, 140, 73, 0.34);
        }

        .error-message {
            background: rgba(127, 29, 29, 0.34);
            border: 1px solid rgba(239, 68, 68, 0.45);
            color: #fecaca;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 14px;
            text-align: center;
            display: none;
            font-size: 13px;
        }

        .hidden {
            display: none;
        }

        .auth-switch {
            margin-top: 14px;
            text-align: center;
            color: #a8bbd4;
            font-size: 13px;
        }

        .auth-switch-link {
            border: none;
            background: transparent;
            color: #49c97d;
            font-weight: 700;
            cursor: pointer;
            padding: 0;
            margin-left: 4px;
            text-decoration: none;
        }

        .auth-switch-link:hover {
            color: #7ce9a7;
            text-decoration: underline;
        }

        .security-badge {
            text-align: center;
            margin-top: 20px;
            color: #9fb0c8;
            font-size: 12px;
            letter-spacing: 0.02em;
        }

        @media (max-width: 640px) {
            .login-react {
                padding: 14px;
            }

            .login-container {
                padding: 24px 18px 20px;
                border-radius: 16px;
            }

            .login-title {
                font-size: 24px;
            }
        }
      `}</style>

      <div className="login-container">
        <div className="login-logo">
          <img src={brandFullLogoUrl} alt={brandName} />
        </div>
        <h1 className="login-title" id="authTitle">Acesso ao Dashboard</h1>
        <p className="login-subtitle" id="authSubtitle">{'Entre com seu usu\u00E1rio para continuar.'}</p>

        <div className="error-message" id="errorMsg">
          {'Usu\u00E1rio ou senha incorretos'}
        </div>

        <form id="loginForm" onSubmit={(event) => globals.handleLogin?.(event as unknown as Event)}>
          <h2 className="form-section-title">Entrar</h2>
          <div className="form-group">
            <label className="form-label">{'Usu\u00E1rio'}</label>
            <input
              type="text"
              className="form-input"
              id="username"
              placeholder={'Digite seu e-mail ou usu\u00E1rio'}
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" id="password" placeholder="Digite sua senha" required />
          </div>

          <button type="submit" className="btn-login">Entrar</button>

          <div className="auth-switch">
            {'Ainda n\u00E3o tem conta?'}
            <button type="button" className="auth-switch-link" onClick={() => globals.showRegister?.()}>
              Criar conta
            </button>
          </div>
        </form>

        <div className="error-message" id="registerErrorMsg">
          Falha ao criar conta
        </div>

        <form id="registerForm" className="hidden" onSubmit={(event) => globals.handleRegister?.(event as unknown as Event)}>
          <h2 className="form-section-title">Criar conta</h2>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input
              type="text"
              className="form-input"
              id="registerName"
              placeholder="Digite seu nome"
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-input"
              id="registerEmail"
              placeholder="Digite seu e-mail"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" id="registerPassword" placeholder="Crie uma senha" required />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar senha</label>
            <input type="password" className="form-input" id="registerConfirm" placeholder="Repita a senha" required />
          </div>

          <button type="submit" className="btn-login">Criar conta</button>

          <div className="auth-switch">
            {'J\u00E1 tem conta?'}
            <button type="button" className="auth-switch-link" onClick={() => globals.showLogin?.()}>
              Entrar
            </button>
          </div>
        </form>

        <div className="security-badge">
          {'Conex\u00E3o segura e criptografada'}
        </div>
      </div>
    </div>
  );
}
