import { Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Motion } from "@motionone/solid";
import { useEmail } from "../stores/emails";

export default function Email() {
  const params = useParams<{ id: string }>();
  const email = useEmail(() => params.id);
  const navigate = useNavigate();

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    }) + " " + d.toLocaleTimeString("ko-KR", {
      hour: "2-digit", minute: "2-digit",
    });
  }

  function extractName(from: string): string {
    const match = from.match(/^"?(.+?)"?\s*<.*>$/);
    return match ? match[1] : from;
  }

  function getInitial(from: string): string {
    return extractName(from).charAt(0).toUpperCase();
  }

  function handleReply() {
    const e = email();
    if (!e) return;
    const subject = e.subject.startsWith("Re:") ? e.subject : `Re: ${e.subject}`;
    navigate(`/compose?to=${encodeURIComponent(e.from)}&subject=${encodeURIComponent(subject)}`);
  }

  return (
    <div class="app-layout">
      <header class="detail-header">
        <button class="icon-btn" onClick={() => navigate("/")} title="뒤로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="header-spacer" />
        <button class="icon-btn" onClick={handleReply} title="답장">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
        </button>
      </header>

      <Show when={!email.loading} fallback={<div class="loading-screen"><div class="spinner" /></div>}>
        <Show when={email()} fallback={<div class="empty-state">이메일을 찾을 수 없습니다</div>}>
          {(e) => (
            <Motion.div
              class="detail-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <h1 class="detail-subject">{e().subject || "(제목 없음)"}</h1>

              <div class="detail-meta">
                <div class="detail-meta-avatar">{getInitial(e().from)}</div>
                <div class="detail-meta-info">
                  <div class="detail-meta-from">{extractName(e().from)}</div>
                  <div class="detail-meta-to">to {e().to}</div>
                </div>
                <div class="detail-meta-date">{formatDate(e().date)}</div>
              </div>

              <div class="detail-body">
                <Show
                  when={e().body.html}
                  fallback={<pre>{e().body.text}</pre>}
                >
                  <iframe
                    sandbox=""
                    srcdoc={e().body.html}
                    onLoad={(ev) => {
                      const frame = ev.currentTarget;
                      if (frame.contentDocument) {
                        frame.style.height = `${frame.contentDocument.body.scrollHeight + 24}px`;
                      }
                    }}
                  />
                </Show>
              </div>
            </Motion.div>
          )}
        </Show>
      </Show>
    </div>
  );
}
