import { useEffect } from 'react';

type LoginGlobals = {
  initLogin?: () => void;
  handleLogin?: (event: Event) => boolean | Promise<boolean>;
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

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #5a2a6b 0%, #7a3a8b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }

        .login-logo {
            text-align: center;
            margin-bottom: 30px;
        }

        .login-logo img {
            height: 60px;
            border-radius: 10px;
        }

        .login-title {
            text-align: center;
            color: #5a2a6b;
            margin-bottom: 30px;
            font-size: 24px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }

        .form-input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s;
        }

        .form-input:focus {
            outline: none;
            border-color: #5a2a6b;
            box-shadow: 0 0 0 3px rgba(90, 42, 107, 0.1);
        }

        .btn-login {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #5a2a6b 0%, #7a3a8b 100%);
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
            box-shadow: 0 10px 30px rgba(90, 42, 107, 0.4);
        }

        .error-message {
            background: #fee2e2;
            color: #dc2626;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            display: none;
        }

        .security-badge {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
        }
      `}</style>
      <div className="login-container">
        <div className="login-logo">
          <img src="img/logo-self.png" alt="SELF" />
        </div>
        <h1 className="login-title">Acesso ao Dashboard</h1>

        <div className="error-message" id="errorMsg">
          Usuario ou senha incorretos
        </div>

        <form id="loginForm" onSubmit={(event) => globals.handleLogin?.(event as unknown as Event)}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              className="form-input"
              id="username"
              placeholder="Digite seu e-mail ou usuÃ¡rio"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" id="password" placeholder="Digite sua senha" required />
          </div>

          <button type="submit" className="btn-login">Entrar</button>
        </form>

        <div className="security-badge">
          Conexao segura e criptografada
        </div>
      </div>
    </div>
  );
}
