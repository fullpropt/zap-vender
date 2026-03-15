import { useEffect } from 'react';
import { brandFullLogoUrl, brandName } from '../lib/brand';

type LoginGlobals = {
  initLogin?: () => void;
  handleLogin?: (event: Event) => boolean | Promise<boolean>;
  resendEmailConfirmation?: () => Promise<void>;
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
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background:
                radial-gradient(900px 520px at 78% 10%, rgba(0, 255, 163, 0.12) 0%, rgba(0, 255, 163, 0) 58%),
                radial-gradient(760px 440px at 18% 84%, rgba(0, 240, 255, 0.08) 0%, rgba(0, 240, 255, 0) 62%),
                linear-gradient(170deg, #04080f 0%, #03060b 48%, #020202 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: linear-gradient(165deg, rgba(10, 18, 26, 0.96) 0%, rgba(8, 15, 24, 0.97) 100%);
            padding: 34px 34px 28px;
            border-radius: 22px;
            border: 1px solid rgba(89, 118, 133, 0.36);
            box-shadow:
                0 26px 72px rgba(2, 6, 23, 0.7),
                0 0 0 1px rgba(255, 255, 255, 0.03) inset,
                0 0 44px rgba(0, 255, 163, 0.12);
            width: 100%;
            max-width: 430px;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(12px);
        }

        .login-container::before {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
                radial-gradient(460px 240px at 80% -12%, rgba(0, 255, 163, 0.18) 0%, rgba(0, 255, 163, 0) 55%),
                radial-gradient(520px 260px at -16% 118%, rgba(0, 240, 255, 0.1) 0%, rgba(0, 240, 255, 0) 54%);
        }

        .login-container > * {
            position: relative;
            z-index: 1;
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
            color: #f4f8fb;
            margin-bottom: 6px;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 700;
            text-shadow: 0 0 16px rgba(255, 255, 255, 0.08);
        }

        .login-subtitle {
            text-align: center;
            color: #95a9b6;
            margin-bottom: 24px;
            font-size: 14px;
        }

        .form-section-title {
            font-size: 18px;
            font-weight: 700;
            color: #e6edf3;
            margin-bottom: 14px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            margin-bottom: 7px;
            color: #d6e3ec;
            font-weight: 600;
        }

        .form-input {
            width: 100%;
            padding: 13px 14px;
            border: 1px solid rgba(86, 112, 126, 0.48);
            border-radius: 10px;
            font-size: 15px;
            color: #e8f6f0;
            background: rgba(17, 27, 38, 0.9);
            transition: all 0.3s;
        }

        .form-input::placeholder {
            color: #7f97a8;
        }

        .form-input:focus {
            outline: none;
            border-color: rgba(0, 255, 163, 0.78);
            box-shadow: 0 0 0 3px rgba(0, 255, 163, 0.18), 0 0 18px rgba(0, 255, 163, 0.12);
            background: rgba(20, 33, 45, 0.96);
        }

        .remember-row {
            margin-bottom: 14px;
        }

        .remember-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            color: #c1d5d0;
            font-size: 14px;
            cursor: pointer;
            user-select: none;
        }

        .remember-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: #00dc8d;
        }

        .btn-login {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #00ffa3 0%, #00d789 42%, #00c775 100%);
            color: #042419;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0, 255, 163, 0.33), 0 0 28px rgba(0, 240, 255, 0.16);
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

        .error-message.success-message {
            background: rgba(22, 101, 52, 0.25);
            border-color: rgba(74, 222, 128, 0.35);
            color: #bbf7d0;
        }

        .hidden {
            display: none;
        }

        .auth-switch {
            margin-top: 14px;
            text-align: center;
            color: #9fb4bf;
            font-size: 13px;
        }

        .auth-switch-link {
            border: none;
            background: transparent;
            color: #00e39a;
            font-weight: 700;
            cursor: pointer;
            padding: 0;
            margin-left: 4px;
            text-decoration: none;
        }

        .auth-switch-link:hover {
            color: #5df8c3;
            text-decoration: underline;
        }

        .auth-resend-wrap {
            margin-top: 10px;
            text-align: center;
        }

        .auth-resend-btn {
            border: none;
            background: transparent;
            color: #79d8ff;
            font-size: 13px;
            cursor: pointer;
            text-decoration: underline;
            padding: 0;
        }

        .auth-resend-btn:disabled {
            opacity: 0.65;
            cursor: default;
        }

        .security-badge {
            text-align: center;
            margin-top: 20px;
            color: #8ea2ae;
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

        <div className="error-message" id="authInfoMsg">
          {'Verifique seu e-mail para concluir o cadastro'}
        </div>

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

          <div className="remember-row">
            <label className="remember-label" htmlFor="rememberSession">
              <input type="checkbox" className="remember-checkbox" id="rememberSession" />
              Manter sessão salva
            </label>
          </div>

          <button type="submit" className="btn-login">Entrar</button>

          <div className="auth-resend-wrap hidden" id="resendConfirmationWrap">
            <button
              type="button"
              className="auth-resend-btn"
              id="resendConfirmationBtn"
              onClick={() => globals.resendEmailConfirmation?.()}
            >
              Reenviar confirmação
            </button>
          </div>

        <div className="auth-switch">
          {'Ainda n\u00E3o tem conta?'}
            <button type="button" className="auth-switch-link" onClick={() => { window.location.hash = '#/planos'; }}>
              Cadastrar
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
