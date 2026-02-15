import { createSignal, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { Motion, Presence } from "@motionone/solid";
import { sendEmail } from "../stores/emails";

export default function Compose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramTo = searchParams.to;
  const paramSubject = searchParams.subject;
  const [to, setTo] = createSignal(Array.isArray(paramTo) ? paramTo[0] : paramTo ?? "");
  const [subject, setSubject] = createSignal(Array.isArray(paramSubject) ? paramSubject[0] : paramSubject ?? "");
  const [body, setBody] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSend() {
    if (!to() || !subject()) {
      setError("수신자와 제목을 입력해주세요.");
      return;
    }

    setSending(true);
    setError("");
    try {
      await sendEmail({ to: to(), subject: subject(), body: body() });
      navigate("/");
    } catch {
      setError("메일 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div class="app-layout">
      <header class="detail-header">
        <button class="icon-btn" onClick={() => navigate("/")} title="취소">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="header-spacer" />
        <span style="font-size:0.95rem;font-weight:500">새 메일</span>
        <div class="header-spacer" />
        <div style="width:40px" />
      </header>

      <Motion.div
        class="compose-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div class="compose-field">
          <span class="compose-label">받는이</span>
          <input
            class="compose-input"
            type="email"
            placeholder="email@example.com"
            value={to()}
            onInput={(e) => setTo(e.currentTarget.value)}
            autofocus={!paramTo}
          />
        </div>
        <div class="compose-field">
          <span class="compose-label">제목</span>
          <input
            class="compose-input"
            type="text"
            placeholder="제목을 입력하세요"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
          />
        </div>
        <textarea
          class="compose-textarea"
          placeholder="내용을 입력하세요..."
          value={body()}
          onInput={(e) => setBody(e.currentTarget.value)}
        />
      </Motion.div>

      <Presence>
        <Show when={error()}>
          <Motion.div
            class="error-msg"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error()}
          </Motion.div>
        </Show>
      </Presence>

      <div class="compose-footer">
        <button class="send-btn" onClick={handleSend} disabled={sending()}>
          <Show when={!sending()} fallback={<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.3);border-top-color:#fff" />}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>
            보내기
          </Show>
        </button>
      </div>
    </div>
  );
}
