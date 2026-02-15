import { Show, For } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useEmails } from "../stores/emails";

export default function Inbox() {
  const { emails, searchQuery, setSearchQuery } = useEmails();
  const navigate = useNavigate();

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  }

  function extractName(from: string): string {
    const match = from.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].replace(/"/g, "") : from;
  }

  return (
    <div class="inbox-page">
      <header class="header">
        <h1 class="logo">Mailo</h1>
        <div class="search-bar">
          <input
            type="text"
            placeholder="메일 검색..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <button class="compose-btn" onClick={() => navigate("/compose")}>
          + 새 메일
        </button>
      </header>

      <main class="email-list">
        <Show when={!emails.loading} fallback={<div class="loading">로딩 중...</div>}>
          <Show
            when={emails()?.length}
            fallback={<div class="empty">메일이 없습니다.</div>}
          >
            <For each={emails()}>
              {(email) => (
                <A
                  href={`/email/${email.id}`}
                  class="email-row"
                  classList={{ unread: email.labelIds?.includes("UNREAD") }}
                >
                  <span class="email-from">{extractName(email.from)}</span>
                  <span class="email-content">
                    <span class="email-subject">{email.subject}</span>
                    <span class="email-snippet"> — {email.snippet}</span>
                  </span>
                  <span class="email-date">{formatDate(email.date)}</span>
                </A>
              )}
            </For>
          </Show>
        </Show>
      </main>
    </div>
  );
}
