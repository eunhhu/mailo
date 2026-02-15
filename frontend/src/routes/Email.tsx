import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Motion } from "@motionone/solid";
import {
  useEmail, useEmails,
  archiveEmail, deleteEmail,
  markAsRead, markAsUnread,
  starEmail, unstarEmail, reportSpam,
  unspamEmail, moveToInbox,
} from "../stores/emails";
import { showToast } from "../components/Toast";

export default function Email() {
  const params = useParams<{ id: string }>();
  const { email, loading, refetch: refetchDetail } = useEmail(() => params.id);
  const { currentFolder } = useEmails();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = createSignal(false);

  const folder = () => currentFolder();
  const isTrash = () => folder() === "trash";
  const isSpam = () => folder() === "spam";
  const isSent = () => folder() === "sent";
  const isArchive = () => folder() === "archive";

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/", { replace: true });
    }
  }

  createEffect(() => {
    const e = email();
    if (e && e.labelIds.includes("UNREAD")) {
      markAsRead(e.id).catch(() => {
        showToast("읽음 처리에 실패했습니다", "error");
      });
    }
  });

  // iframe 자동 높이 조절
  function setupIframeAutoResize(frame: HTMLIFrameElement) {
    function updateHeight() {
      if (frame.contentDocument?.body) {
        const h = frame.contentDocument.body.scrollHeight;
        frame.style.height = `${h + 24}px`;
      }
    }

    updateHeight();

    const doc = frame.contentDocument;
    if (!doc) return;

    const images = doc.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", updateHeight);
        img.addEventListener("error", updateHeight);
      }
    });

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(doc.body);
      onCleanup(() => ro.disconnect());
    }

    const mo = new MutationObserver(updateHeight);
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
    onCleanup(() => mo.disconnect());
  }

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

  function handleForward() {
    const e = email();
    if (!e) return;
    const subject = e.subject.startsWith("Fwd:") ? e.subject : `Fwd: ${e.subject}`;
    const fwdBody = `\n\n---------- Forwarded message ----------\nFrom: ${e.from}\nDate: ${formatDate(e.date)}\nSubject: ${e.subject}\nTo: ${e.to}\n\n${e.body.text || ""}`;
    navigate(`/compose?subject=${encodeURIComponent(subject)}&fwdBody=${encodeURIComponent(fwdBody)}`);
  }

  async function runAction(action: () => Promise<void>, successMsg: string, errorMsg: string, shouldGoBack = false) {
    if (actionLoading()) return;
    setActionLoading(true);
    try {
      await action();
      showToast(successMsg, "success");
      if (shouldGoBack) {
        goBack();
      } else {
        refetchDetail();
      }
    } catch {
      showToast(errorMsg, "error");
    } finally {
      setActionLoading(false);
    }
  }

  // --- 폴더별 primary 액션 ---
  function handlePrimary() {
    const e = email();
    if (!e) return;
    if (isTrash() || isArchive()) {
      runAction(() => moveToInbox(e.id), "받은편지함으로 이동됨", "이동 실패", true);
    } else if (isSpam()) {
      runAction(() => unspamEmail(e.id), "스팸 해제됨", "처리 실패", true);
    } else {
      runAction(() => archiveEmail(e.id), "보관됨", "보관 실패", true);
    }
  }

  // --- 삭제 (휴지통으로 이동) ---
  function handleDelete() {
    const e = email();
    if (!e) return;
    runAction(() => deleteEmail(e.id), "휴지통으로 이동됨", "삭제 실패", true);
  }

  function handleToggleStar() {
    const e = email();
    if (!e) return;
    const isStarred = e.labelIds.includes("STARRED");
    if (isStarred) {
      runAction(() => unstarEmail(e.id), "별표 해제됨", "처리 실패");
    } else {
      runAction(() => starEmail(e.id), "별표 표시됨", "처리 실패");
    }
  }

  function handleSpam() {
    const e = email();
    if (!e) return;
    runAction(() => reportSpam(e.id), "스팸으로 신고됨", "신고 실패", true);
  }

  function handleToggleRead() {
    const e = email();
    if (!e) return;
    const isUnread = e.labelIds.includes("UNREAD");
    if (isUnread) {
      runAction(() => markAsRead(e.id), "읽음 처리됨", "처리 실패");
    } else {
      runAction(() => markAsUnread(e.id), "읽지 않음 표시됨", "처리 실패");
    }
  }

  /** 별표 표시 가능 여부 */
  function showStar(): boolean {
    return !isTrash() && !isSpam() && !isSent();
  }

  /** 스팸 신고 표시 여부 (이미 스팸/휴지통/보낸편지함이면 불필요) */
  function showSpamReport(): boolean {
    return !isSpam() && !isTrash() && !isSent();
  }

  /** 읽음 토글 표시 여부 (보낸편지함/휴지통/스팸에서는 불필요) */
  function showReadToggle(): boolean {
    return !isSent() && !isTrash() && !isSpam();
  }

  /** primary 액션 표시 여부 */
  function showPrimary(): boolean {
    return !isSent();
  }

  /** 삭제(휴지통으로 이동) 표시 여부 — 이미 휴지통이면 불필요 */
  function showDelete(): boolean {
    return !isTrash();
  }

  function primaryLabel(): string {
    if (isTrash() || isArchive()) return "받은편지함으로";
    if (isSpam()) return "스팸 아님";
    return "보관";
  }

  function deleteLabel(): string {
    return "삭제";
  }

  // Primary 아이콘
  function PrimaryActionIcon(props: { size?: number }) {
    const s = props.size ?? 18;
    if (isTrash() || isArchive()) {
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
    }
    if (isSpam()) {
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
    }
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
  }

  return (
    <>
      <header class="content-header">
        <button class="icon-btn" onClick={goBack} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="header-spacer" />
        <div class="action-toolbar">
          {/* Primary: 보관/받은편지함으로/스팸아님 */}
          <Show when={showPrimary()}>
            <button class="icon-btn" onClick={handlePrimary} aria-label={primaryLabel()} disabled={actionLoading()}>
              <PrimaryActionIcon />
            </button>
          </Show>
          {/* 삭제 (휴지통으로 이동) */}
          <Show when={showDelete()}>
            <button class="icon-btn danger" onClick={handleDelete} aria-label={deleteLabel()} disabled={actionLoading()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </Show>
          {/* 별표 */}
          <Show when={showStar()}>
            <button class="icon-btn" classList={{ active: email()?.labelIds.includes("STARRED") }} onClick={handleToggleStar} aria-label={email()?.labelIds.includes("STARRED") ? "별표 해제" : "별표 표시"} disabled={actionLoading()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={email()?.labelIds.includes("STARRED") ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </Show>
          {/* 스팸 신고 */}
          <Show when={showSpamReport()}>
            <button class="icon-btn danger" onClick={handleSpam} aria-label="스팸 신고" disabled={actionLoading()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </button>
          </Show>
          {/* 읽음/안읽음 토글 */}
          <Show when={showReadToggle()}>
            <button class="icon-btn" onClick={handleToggleRead} aria-label={email()?.labelIds.includes("UNREAD") ? "읽음 표시" : "읽지 않음 표시"} disabled={actionLoading()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </button>
          </Show>
          {/* 답장 */}
          <button class="icon-btn" onClick={handleReply} aria-label="답장">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          </button>
        </div>
      </header>

      <div class="detail-scroll">
        <Show when={!loading()} fallback={<div class="loading-screen" style="height:auto;padding:60px"><div class="spinner" /></div>}>
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
                      sandbox="allow-same-origin"
                      srcdoc={e().body.html}
                      title="이메일 본문"
                      onLoad={(ev) => setupIframeAutoResize(ev.currentTarget)}
                    />
                  </Show>
                </div>

                <div class="detail-actions-full">
                  <button class="action-btn" onClick={handleReply}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    답장
                  </button>
                  <button class="action-btn" onClick={handleForward}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                    전달
                  </button>
                  <Show when={showPrimary()}>
                    <button class="action-btn" onClick={handlePrimary} disabled={actionLoading()}>
                      <PrimaryActionIcon size={14} /> {primaryLabel()}
                    </button>
                  </Show>
                  <Show when={showDelete()}>
                    <button class="action-btn danger" onClick={handleDelete} disabled={actionLoading()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      {deleteLabel()}
                    </button>
                  </Show>
                </div>
              </Motion.div>
            )}
          </Show>
        </Show>
      </div>
    </>
  );
}
