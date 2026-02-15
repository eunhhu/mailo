import { Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { useEmail } from "../stores/emails";

export default function Email() {
  const params = useParams<{ id: string }>();
  const email = useEmail(() => params.id);
  const navigate = useNavigate();

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleReply() {
    const e = email();
    if (!e) return;
    const subject = e.subject.startsWith("Re:") ? e.subject : `Re: ${e.subject}`;
    navigate(`/compose?to=${encodeURIComponent(e.from)}&subject=${encodeURIComponent(subject)}`);
  }

  return (
    <div class="email-page">
      <header class="email-header">
        <button class="back-btn" onClick={() => navigate("/")}>
          ← 받은편지함
        </button>
        <button class="reply-btn" onClick={handleReply}>
          답장
        </button>
      </header>

      <Show when={!email.loading} fallback={<div class="loading">로딩 중...</div>}>
        <Show when={email()} fallback={<div class="empty">이메일을 찾을 수 없습니다.</div>}>
          {(e) => (
            <article class="email-detail">
              <h1 class="email-detail-subject">{e().subject}</h1>
              <div class="email-meta">
                <div>
                  <strong>보낸 사람:</strong> {e().from}
                </div>
                <div>
                  <strong>받는 사람:</strong> {e().to}
                </div>
                <div>
                  <strong>날짜:</strong> {formatDate(e().date)}
                </div>
              </div>
              <div class="email-body">
                <Show
                  when={e().body.html}
                  fallback={<pre style="white-space:pre-wrap;font-family:inherit;">{e().body.text}</pre>}
                >
                  <iframe
                    sandbox=""
                    srcdoc={e().body.html}
                    style="width:100%;border:none;min-height:300px;"
                    onLoad={(ev) => {
                      const frame = ev.currentTarget;
                      if (frame.contentDocument) {
                        frame.style.height = `${frame.contentDocument.body.scrollHeight + 20}px`;
                      }
                    }}
                  />
                </Show>
              </div>
            </article>
          )}
        </Show>
      </Show>
    </div>
  );
}
