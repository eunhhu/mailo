import { createSignal, Show } from "solid-js";
import { Motion, Presence } from "@motionone/solid";

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

      window.location.href = "/auth/login";
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="login-page">
      <Motion.div
        class="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, easing: [0.25, 0.1, 0.25, 1] }}
      >
        <div class="login-logo">mailo</div>

        <form onSubmit={handleSubmit} class="login-form">
          <input
            class="login-input"
            type="password"
            placeholder="비밀번호"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            autofocus
          />

          <Presence>
            <Show when={error()}>
              <Motion.div
                class="error-msg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ margin: "0" }}
              >
                {error()}
              </Motion.div>
            </Show>
          </Presence>

          <button type="submit" class="login-btn" disabled={loading()}>
            <Show when={!loading()} fallback={<div class="spinner" />}>
              계속
            </Show>
          </button>
        </form>
      </Motion.div>
    </div>
  );
}
