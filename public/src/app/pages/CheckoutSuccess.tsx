import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { brandFullLogoUrl, brandName } from '../lib/brand';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  premium: 'Premium',
  advanced: 'Avançado'
};

function readJsonSafely(response: Response) {
  return response.text().then((raw) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  });
}

export default function CheckoutSuccess() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sessionId = String(params.get('session_id') || '').trim();
  const planKey = String(params.get('plan') || '').trim().toLowerCase();
  const planLabel = PLAN_LABELS[planKey] || 'seu plano';
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const resendEmail = async () => {
    if (!sessionId || busy) return;
    setBusy(true);
    setInfoMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId
        })
      });
      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(String((data as { error?: string })?.error || 'Não foi possível reenviar o email agora.'));
      }

      setInfoMessage(String((data as { message?: string })?.message || 'Enviamos um novo email de confirmação.'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível reenviar o email agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="checkout-success-page">
      <style>{`
        .checkout-success-page {
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

        .checkout-success-card {
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

        .checkout-success-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(460px 240px at 80% -12%, rgba(0, 255, 163, 0.16) 0%, rgba(0, 255, 163, 0) 55%),
            radial-gradient(520px 260px at -16% 118%, rgba(0, 240, 255, 0.08) 0%, rgba(0, 240, 255, 0) 54%);
        }

        .checkout-success-card > * {
          position: relative;
          z-index: 1;
        }

        .checkout-success-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .checkout-success-logo img {
          width: clamp(160px, 42vw, 220px);
          height: auto;
          display: block;
          filter: drop-shadow(0 10px 18px rgba(2, 6, 23, 0.45));
        }

        .checkout-success-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin: 0 auto 18px;
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(0, 255, 163, 0.12);
          border: 1px solid rgba(0, 255, 163, 0.26);
          color: #9bffd4;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .checkout-success-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #00ffa3;
          box-shadow: 0 0 0 6px rgba(0, 255, 163, 0.14);
        }

        .checkout-success-title {
          margin: 0 0 10px;
          text-align: center;
          color: #f4f8fb;
          font-size: 32px;
          line-height: 1.12;
          font-weight: 700;
        }

        .checkout-success-text {
          margin: 0;
          text-align: center;
          color: #95a9b6;
          font-size: 15px;
          line-height: 1.7;
        }

        .checkout-success-steps {
          margin: 28px 0 24px;
          display: grid;
          gap: 14px;
        }

        .checkout-success-step {
          border: 1px solid rgba(86, 112, 126, 0.3);
          border-radius: 16px;
          background: rgba(13, 24, 35, 0.78);
          padding: 16px 18px;
        }

        .checkout-success-step-label {
          display: block;
          margin-bottom: 6px;
          color: #5df8c3;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .checkout-success-step p {
          margin: 0;
          color: #d6e3ec;
          font-size: 14px;
          line-height: 1.65;
        }

        .checkout-success-feedback {
          margin-bottom: 18px;
          border-radius: 12px;
          padding: 12px 14px;
          text-align: center;
          font-size: 13px;
          line-height: 1.5;
        }

        .checkout-success-feedback.info {
          background: rgba(22, 101, 52, 0.24);
          border: 1px solid rgba(74, 222, 128, 0.28);
          color: #bbf7d0;
        }

        .checkout-success-feedback.error {
          background: rgba(127, 29, 29, 0.34);
          border: 1px solid rgba(239, 68, 68, 0.45);
          color: #fecaca;
        }

        .checkout-success-actions {
          display: grid;
          gap: 12px;
        }

        .checkout-success-btn {
          width: 100%;
          min-height: 48px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.25s ease;
        }

        .checkout-success-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .checkout-success-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .checkout-success-btn.primary {
          background: linear-gradient(135deg, #00ffa3 0%, #00d789 42%, #00c775 100%);
          color: #042419;
          box-shadow: 0 12px 30px rgba(0, 255, 163, 0.26);
        }

        .checkout-success-btn.secondary {
          background: rgba(17, 27, 38, 0.88);
          color: #e8f6f0;
          border: 1px solid rgba(86, 112, 126, 0.42);
        }

        .checkout-success-note {
          margin-top: 18px;
          text-align: center;
          color: #7f97a8;
          font-size: 13px;
          line-height: 1.6;
        }

        @media (max-width: 640px) {
          .checkout-success-page {
            padding: 14px;
          }

          .checkout-success-card {
            padding: 24px 18px 22px;
            border-radius: 18px;
          }

          .checkout-success-title {
            font-size: 26px;
          }
        }
      `}</style>

      <div className="checkout-success-card">
        <div className="checkout-success-logo">
          <img src={brandFullLogoUrl} alt={brandName} />
        </div>

        <div className="checkout-success-badge">
          <span className="checkout-success-dot" aria-hidden="true"></span>
          Checkout concluído
        </div>

        <h1 className="checkout-success-title">Agora confirme seu email</h1>
        <p className="checkout-success-text">
          Seu checkout do plano <strong>{planLabel}</strong> foi concluído. Estamos enviando um email de confirmação
          para o endereço informado no pagamento.
        </p>

        <div className="checkout-success-steps">
          <div className="checkout-success-step">
            <span className="checkout-success-step-label">Próximo passo</span>
            <p>Abra o email recebido e clique em <strong>Confirmar e-mail</strong>.</p>
          </div>
          <div className="checkout-success-step">
            <span className="checkout-success-step-label">Depois disso</span>
            <p>Você será direcionado para concluir seu cadastro com nome, empresa e senha.</p>
          </div>
        </div>

        {infoMessage ? <div className="checkout-success-feedback info">{infoMessage}</div> : null}
        {errorMessage ? <div className="checkout-success-feedback error">{errorMessage}</div> : null}

        <div className="checkout-success-actions">
          <button type="button" className="checkout-success-btn primary" onClick={resendEmail} disabled={!sessionId || busy}>
            {busy ? 'Reenviando...' : 'Reenviar email de confirmação'}
          </button>
          <button
            type="button"
            className="checkout-success-btn secondary"
            onClick={() => { window.location.hash = '#/planos'; }}
          >
            Voltar para os planos
          </button>
        </div>

        <p className="checkout-success-note">
          Se não encontrar o email em alguns instantes, verifique sua caixa de spam ou solicite o reenvio acima.
        </p>
      </div>
    </div>
  );
}
