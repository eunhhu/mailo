import { createSignal, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { Motion } from "@motionone/solid";
import { sendEmail } from "../stores/emails";
import { showToast } from "../components/Toast";

export default function Compose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/", { replace: true });
    }
  }

  const paramTo = searchParams.to;
  const paramSubject = searchParams.subject;
  const paramFwdBody = searchParams.fwdBody;
  const [to, setTo] = createSignal(Array.isArray(paramTo) ? paramTo[0] : paramTo ?? "");
  const [subject, setSubject] = createSignal(Array.isArray(paramSubject) ? paramSubject[0] : paramSubject ?? "");
  const [body, setBody] = createSignal(
    Array.isArray(paramFwdBody) ? paramFwdBody[0] : paramFwdBody ?? ""
  );
  const [sending, setSending] = createSignal(false);

  async function handleSend() {
    if (!to() || !subject()) {
      showToast("수신자와 제목을 입력해주세요.", "error");
      return;
    }

    setSending(true);
    try {
      await sendEmail({ to: to(), subject: subject(), body: body() });
      showToast("메일이 전송되었습니다.", "success");
      goBack();
    } catch {
      showToast("메일 전송에 실패했습니다.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <header class="content-header">
        <button class="icon-btn" onClick={goBack} aria-label="취소">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <div class="header-spacer" />
        <span class="content-title">새 메일</span>
        <div class="header-spacer" />
        <button class="send-btn header-send-btn" onClick={handleSend} disabled={sending()} aria-label="메일 보내기">
          <Show when={!sending()} fallback={<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.3);border-top-color:#fff" />}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>
            보내기
          </Show>
        </button>
      </header>

      <Motion.div
        class="compose-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div class="compose-field">
          <label class="compose-label" for="compose-to">받는이</label>
          <input
            id="compose-to"
            class="compose-input"
            type="email"
            placeholder="email@example.com"
            value={to()}
            onInput={(e) => setTo(e.currentTarget.value)}
            autofocus={!paramTo}
            aria-required="true"
          />
        </div>
        <div class="compose-field">
          <label class="compose-label" for="compose-subject">제목</label>
          <input
            id="compose-subject"
            class="compose-input"
            type="text"
            placeholder="제목을 입력하세요"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
            aria-required="true"
          />
        </div>
        <textarea
          class="compose-textarea"
          placeholder="내용을 입력하세요..."
          value={body()}
          onInput={(e) => setBody(e.currentTarget.value)}
          aria-label="메일 본문"
        />
      </Motion.div>

      <div class="compose-footer-mobile">
        <button class="send-btn" onClick={handleSend} disabled={sending()} aria-label="메일 보내기">
          <Show when={!sending()} fallback={<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.3);border-top-color:#fff" />}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>
            보내기
          </Show>
        </button>
      </div>
    </>
  );
}
