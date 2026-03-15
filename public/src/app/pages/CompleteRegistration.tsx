import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { brandFullLogoUrl, brandName } from '../lib/brand';

type ConfirmResponse = {
  success?: boolean;
  flow?: 'complete_registration' | 'login';
  message?: string;
  error?: string;
  code?: string;
  registration?: {
    email?: string;
    plan?: {
      code?: string;
      name?: string;
      status?: string;
    };
  };
  user?: {
    email?: string;
    name?: string;
  };
};

function readJsonSafely(response: Response): Promise<ConfirmResponse> {
  return response.text().then((raw) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as ConfirmResponse;
    } catch (_) {
      return {};
    }
  });
}

type ScreenState = 'loading' | 'form' | 'login' | 'success' | 'error';

export default function CompleteRegistration() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const confirmEmailToken = String(params.get('confirmEmailToken') || '').trim();
  const routeError = String(params.get('emailConfirmError') || '').trim();

  const [screen, setScreen] = useState<ScreenState>('loading');
  const [infoMessage, setInfoMessage] = useState('Confirmando seu email...');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [planName, setPlanName] = useState('Plano');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let cancelled = false;

    const confirmEmail = async () => {
      if (!confirmEmailToken) {
        setScreen('error');
        setErrorMessage(
          routeError === 'token_required'
            ? 'Link de confirmação inválido: token ausente.'
            : 'Link de confirmação inválido ou ausente.'
        );
        return;
      }

      setScreen('loading');
      setInfoMessage('Confirmando seu email...');
      setErrorMessage('');

      try {
        const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(confirmEmailToken)}`, {
          method: 'GET'
        });
        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(String(data?.error || data?.message || 'Não foi possível confirmar seu email.'));
        }

        if (cancelled) return;

        setEmail(String(data?.registration?.email || data?.user?.email || '').trim());
        setPlanName(String(data?.registration?.plan?.name || 'Plano').trim() || 'Plano');
        setInfoMessage(String(data?.message || 'Email confirmado com sucesso.'));

        if (data?.flow === 'complete_registration') {
          setScreen('form');
          return;
        }

        setScreen('login');
      } catch (error) {
        if (cancelled) return;
        setScreen('error');
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível confirmar seu email.');
      }
    };

    void confirmEmail();

    return () => {
      cancelled = true;
    };
  }, [confirmEmailToken, routeError]);

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const normalizedName = name.trim();
    const normalizedCompanyName = companyName.trim();
    if (!normalizedName || !normalizedCompanyName || !password || !confirmPassword) {
      setErrorMessage('Preencha todos os campos para concluir seu cadastro.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setBusy(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: confirmEmailToken,
          name: normalizedName,
          companyName: normalizedCompanyName,
          password
        })
      });
      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(String(data?.error || data?.message || 'Não foi possível concluir seu cadastro.'));
      }

      setScreen('success');
      setInfoMessage(String(data?.message || 'Cadastro concluído com sucesso.'));
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir seu cadastro.');
    } finally {
      setBusy(false);
    }
  };

  const openLogin = () => {
    window.location.hash = '#/login';
  };

  return (
    <div className="complete-registration-page">
      <style>{`
        .complete-registration-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(880px 520px at 82% 14%, rgba(0, 255, 163, 0.14) 0%, rgba(0, 255, 163, 0) 56%),
            radial-gradient(720px 420px at 12% 88%, rgba(0, 240, 255, 0.09) 0%, rgba(0, 240, 255, 0) 62%),
            linear-gradient(170deg, #04080f 0%, #03060b 48%, #020202 100%);
          color: #e8f6f0;
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .complete-registration-card {
          width: 100%;
          max-width: 560px;
          border-radius: 24px;
          border: 1px solid rgba(89, 118, 133, 0.34);
          background: linear-gradient(165deg, rgba(10, 18, 26, 0.96) 0%, rgba(8, 15, 24, 0.97) 100%);
          box-shadow:
            0 26px 72px rgba(2, 6, 23, 0.72),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 44px rgba(0, 255, 163, 0.12);
          padding: 34px 34px 30px;
          position: relative;
          overflow: hidden;
        }

        .complete-registration-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(460px 240px at 80% -12%, rgba(0, 255, 163, 0.16) 0%, rgba(0, 255, 163, 0) 55%),
            radial-gradient(520px 260px at -16% 118%, rgba(0, 240, 255, 0.08) 0%, rgba(0, 240, 255, 0) 54%);
        }

        .complete-registration-card > * {
          position: relative;
          z-index: 1;
        }

        .complete-registration-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .complete-registration-logo img {
          width: clamp(160px, 42vw, 220px);
          height: auto;
          display: block;
          filter: drop-shadow(0 10px 18px rgba(2, 6, 23, 0.45));
        }

        .complete-registration-title {
          margin: 0 0 10px;
          text-align: center;
          color: #f4f8fb;
          font-size: 30px;
          line-height: 1.14;
          font-weight: 700;
        }

        .complete-registration-text {
          margin: 0;
          text-align: center;
          color: #95a9b6;
          font-size: 14px;
          line-height: 1.7;
        }

        .complete-registration-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 20px auto 0;
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(0, 255, 163, 0.12);
          border: 1px solid rgba(0, 255, 163, 0.24);
          color: #9bffd4;
          font-size: 13px;
          font-weight: 700;
        }

        .complete-registration-feedback {
          margin: 22px 0 0;
          border-radius: 12px;
          padding: 12px 14px;
          text-align: center;
          font-size: 13px;
          line-height: 1.6;
        }

        .complete-registration-feedback.info {
          background: rgba(22, 101, 52, 0.24);
          border: 1px solid rgba(74, 222, 128, 0.28);
          color: #bbf7d0;
        }

        .complete-registration-feedback.error {
          background: rgba(127, 29, 29, 0.34);
          border: 1px solid rgba(239, 68, 68, 0.45);
          color: #fecaca;
        }

        .complete-registration-form {
          margin-top: 24px;
        }

        .complete-registration-group {
          margin-bottom: 16px;
        }

        .complete-registration-label {
          display: block;
          margin-bottom: 7px;
          color: #d6e3ec;
          font-weight: 600;
          font-size: 14px;
        }

        .complete-registration-input {
          width: 100%;
          min-height: 48px;
          padding: 13px 14px;
          border: 1px solid rgba(86, 112, 126, 0.48);
          border-radius: 12px;
          font-size: 15px;
          color: #e8f6f0;
          background: rgba(17, 27, 38, 0.9);
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }

        .complete-registration-input:focus {
          outline: none;
          border-color: rgba(0, 255, 163, 0.78);
          box-shadow: 0 0 0 3px rgba(0, 255, 163, 0.18), 0 0 18px rgba(0, 255, 163, 0.12);
          background: rgba(20, 33, 45, 0.96);
        }

        .complete-registration-input[readonly] {
          opacity: 0.92;
          cursor: default;
        }

        .complete-registration-actions {
          display: grid;
          gap: 12px;
          margin-top: 24px;
        }

        .complete-registration-btn {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.25s ease;
        }

        .complete-registration-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .complete-registration-btn:disabled {
          opacity: 0.72;
          cursor: default;
        }

        .complete-registration-btn.primary {
          background: linear-gradient(135deg, #00ffa3 0%, #00d789 42%, #00c775 100%);
          color: #042419;
          box-shadow: 0 12px 30px rgba(0, 255, 163, 0.26);
        }

        .complete-registration-btn.secondary {
          background: rgba(17, 27, 38, 0.88);
          color: #e8f6f0;
          border: 1px solid rgba(86, 112, 126, 0.42);
        }

        @media (max-width: 640px) {
          .complete-registration-page {
            padding: 14px;
          }

          .complete-registration-card {
            padding: 24px 18px 22px;
            border-radius: 18px;
          }

          .complete-registration-title {
            font-size: 25px;
          }
        }
      `}</style>

      <div className="complete-registration-card">
        <div className="complete-registration-logo">
          <img src={brandFullLogoUrl} alt={brandName} />
        </div>

        <h1 className="complete-registration-title">
          {screen === 'form' ? 'Finalize seu cadastro' : 'Confirmação de email'}
        </h1>
        <p className="complete-registration-text">
          {screen === 'form'
            ? 'Seu email foi confirmado. Preencha os dados abaixo para liberar seu acesso.'
            : 'Estamos validando o seu acesso para concluir a entrada na plataforma.'}
        </p>

        {email ? <div className="complete-registration-pill">{email} · {planName}</div> : null}

        {screen === 'loading' && infoMessage ? (
          <div className="complete-registration-feedback info">{infoMessage}</div>
        ) : null}

        {screen === 'error' && errorMessage ? (
          <div className="complete-registration-feedback error">{errorMessage}</div>
        ) : null}

        {screen === 'login' ? (
          <>
            {infoMessage ? <div className="complete-registration-feedback info">{infoMessage}</div> : null}
            <div className="complete-registration-actions">
              <button type="button" className="complete-registration-btn primary" onClick={openLogin}>
                Ir para o login
              </button>
              <button
                type="button"
                className="complete-registration-btn secondary"
                onClick={() => { window.location.hash = '#/planos'; }}
              >
                Ver planos
              </button>
            </div>
          </>
        ) : null}

        {screen === 'success' ? (
          <>
            {infoMessage ? <div className="complete-registration-feedback info">{infoMessage}</div> : null}
            <div className="complete-registration-actions">
              <button type="button" className="complete-registration-btn primary" onClick={openLogin}>
                Entrar no painel
              </button>
            </div>
          </>
        ) : null}

        {screen === 'form' ? (
          <form className="complete-registration-form" onSubmit={submitRegistration}>
            {errorMessage ? <div className="complete-registration-feedback error">{errorMessage}</div> : null}

            <div className="complete-registration-group">
              <label className="complete-registration-label" htmlFor="completeRegistrationEmail">Email</label>
              <input
                id="completeRegistrationEmail"
                className="complete-registration-input"
                type="email"
                value={email}
                readOnly
              />
            </div>

            <div className="complete-registration-group">
              <label className="complete-registration-label" htmlFor="completeRegistrationName">Nome</label>
              <input
                id="completeRegistrationName"
                className="complete-registration-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Digite seu nome"
                autoComplete="name"
                required
              />
            </div>

            <div className="complete-registration-group">
              <label className="complete-registration-label" htmlFor="completeRegistrationCompany">Nome da empresa</label>
              <input
                id="completeRegistrationCompany"
                className="complete-registration-input"
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Digite o nome da empresa"
                autoComplete="organization"
                required
              />
            </div>

            <div className="complete-registration-group">
              <label className="complete-registration-label" htmlFor="completeRegistrationPassword">Senha</label>
              <input
                id="completeRegistrationPassword"
                className="complete-registration-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Crie uma senha"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="complete-registration-group">
              <label className="complete-registration-label" htmlFor="completeRegistrationPasswordConfirm">Confirmar senha</label>
              <input
                id="completeRegistrationPasswordConfirm"
                className="complete-registration-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="complete-registration-actions">
              <button type="submit" className="complete-registration-btn primary" disabled={busy}>
                {busy ? 'Concluindo...' : 'Concluir cadastro'}
              </button>
              <button
                type="button"
                className="complete-registration-btn secondary"
                onClick={() => { window.location.hash = '#/planos'; }}
                disabled={busy}
              >
                Voltar aos planos
              </button>
            </div>
          </form>
        ) : null}

        {screen === 'error' ? (
          <div className="complete-registration-actions">
            <button
              type="button"
              className="complete-registration-btn secondary"
              onClick={() => { window.location.hash = '#/planos'; }}
            >
              Voltar aos planos
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
