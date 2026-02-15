import { createSignal } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
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

  async function handleSend(e: Event) {
    e.preventDefault();
    if (!to() || !subject()) {
      setError("수신자와 제목을 입력해주세요.");
      return;
    }

    setSending(true);
    setError("");
    try {
      await sendEmail({ to: to(), subject: subject(), body: body() });
      navigate("/");
    } catch (err) {
      setError("메일 전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div class="compose-page">
      <header class="compose-header">
        <button class="back-btn" onClick={() => navigate("/")}>
          ← 취소
        </button>
        <h2>새 메일</h2>
      </header>

      <form class="compose-form" onSubmit={handleSend}>
        <div class="form-field">
          <label for="to">받는 사람</label>
          <input
            id="to"
            type="email"
            placeholder="example@gmail.com"
            value={to()}
            onInput={(e) => setTo(e.currentTarget.value)}
            required
          />
        </div>
        <div class="form-field">
          <label for="subject">제목</label>
          <input
            id="subject"
            type="text"
            placeholder="메일 제목"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
            required
          />
        </div>
        <div class="form-field">
          <label for="body">내용</label>
          <textarea
            id="body"
            placeholder="메일 내용을 입력하세요..."
            value={body()}
            onInput={(e) => setBody(e.currentTarget.value)}
            rows={15}
          />
        </div>

        {error() && <div class="error-msg">{error()}</div>}

        <button type="submit" class="send-btn" disabled={sending()}>
          {sending() ? "전송 중..." : "보내기"}
        </button>
      </form>
    </div>
  );
}
