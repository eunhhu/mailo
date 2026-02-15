import { Show, For, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Motion, Presence } from "@motionone/solid";
import { useEmails } from "../stores/emails";

export default function Inbox() {
  const { emails, searchQuery, setSearchQuery } = useEmails();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = createSignal(false);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60_000) return "방금";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "어제";
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString("ko-KR", { year: "2-digit", month: "short", day: "numeric" });
  }

  function extractName(from: string): string {
    const match = from.match(/^"?(.+?)"?\s*<.*>$/);
    return match ? match[1] : from.split("@")[0];
  }

  function getInitial(from: string): string {
    const name = extractName(from);
    return name.charAt(0).toUpperCase();
  }

  return (
    <div class="app-layout">
      <header class="header">
        <Show
          when={!searchOpen()}
          fallback={
            <div class="search-container" style="flex:1">
              <span class="search-icon">Q</span>
              <input
                class="search-input"
                type="text"
                placeholder="검색..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                autofocus
              />
              <button
                class="icon-btn"
                style="position:absolute;right:4px;top:50%;transform:translateY(-50%)"
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              >
                x
              </button>
            </div>
          }
        >
          <span class="header-logo">mailo</span>
          <div class="header-spacer" />
          <button class="icon-btn" onClick={() => setSearchOpen(true)} title="검색">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
        </Show>
      </header>

      <main class="email-list">
        <Show when={!emails.loading} fallback={<div class="loading-screen"><div class="spinner" /></div>}>
          <Show
            when={emails()?.length}
            fallback={
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                메일이 없습니다
              </div>
            }
          >
            <For each={emails()}>
              {(email, i) => (
                <Motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i() * 0.03, 0.3) }}
                >
                  <A
                    href={`/email/${email.id}`}
                    class="email-row"
                    classList={{ unread: email.labelIds?.includes("UNREAD") }}
                  >
                    <div class="email-avatar">{getInitial(email.from)}</div>
                    <div class="email-body-preview">
                      <div class="email-top-row">
                        <span class="email-from">{extractName(email.from)}</span>
                        <span class="email-date">{formatDate(email.date)}</span>
                      </div>
                      <div class="email-subject">{email.subject || "(제목 없음)"}</div>
                      <div class="email-snippet">{email.snippet}</div>
                    </div>
                  </A>
                </Motion.div>
              )}
            </For>
          </Show>
        </Show>
      </main>

      <Motion.button
        class="fab"
        onClick={() => navigate("/compose")}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2, easing: [0.34, 1.56, 0.64, 1] }}
        title="새 메일"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </Motion.button>
    </div>
  );
}
