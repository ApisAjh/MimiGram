import { useAuth } from '../features/auth/AuthContext';

export default function GatePage() {
  const { error, loginWithTelegram, loading } = useAuth();

  return (
    <div className="gate-page">
      <div className="logo">MimiGram</div>
      <p style={{ marginBottom: 24 }}>
        MimiGram adalah Mini App Telegram. Buka melalui bot MimiGram di Telegram untuk masuk otomatis — tanpa email atau password.
      </p>
      {error && (
        <p style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 14 }}>{error}</p>
      )}
      <button className="btn btn-primary" onClick={loginWithTelegram} disabled={loading}>
        {loading ? 'Memuat…' : 'Coba lagi'}
      </button>
      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        1. Buka bot MimiGram di Telegram
        <br />
        2. Tekan tombol <strong>Buka MimiGram</strong>
        <br />
        3. Masuk otomatis dengan akun Telegram Anda
      </p>
    </div>
  );
}
