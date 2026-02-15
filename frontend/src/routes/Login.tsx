import { createSignal } from "solid-js";

export default function Login() {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!password()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password() }),
      });

      if (!res.ok) {
        setError("비밀번호가 틀렸습니다.");
        return;
      }

      // 비밀번호 확인됨 → Google OAuth로 이동
      window.location.href = "/auth/login";
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Mailo</h1>
        <p class="login-subtitle">간편하고 빠른 웹메일</p>

        <form onSubmit={handleSubmit} class="login-form">
          <div class="form-field">
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              autofocus
            />
          </div>

          {error() && <div class="error-msg">{error()}</div>}

          <button type="submit" class="google-btn" disabled={loading()}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading() ? "확인 중..." : "Google로 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
