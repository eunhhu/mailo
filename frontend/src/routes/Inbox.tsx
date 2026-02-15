import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Motion } from "@motionone/solid";
import {
  useEmails, archiveEmail, deleteEmail,
  starEmail, unstarEmail, moveToInbox, unspamEmail,
  type MailFolder,
} from "../stores/emails";
import { showToast } from "../components/Toast";

const FOLDER_LABELS: Record<MailFolder, string> = {
  inbox: "받은편지함",
  sent: "보낸편지함",
  starred: "중요편지함",
  archive: "보관함",
  spam: "스팸",
  trash: "휴지통",
  all: "전체메일",
};

export default function Inbox(props: { onMenuClick: () => void }) {
  const { emails, loading, refetch, searchQuery, setSearchQuery, currentFolder } = useEmails();
  const navigate = useNavigate();

  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set<string>());
  const [selectMode, setSelectMode] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);

  // Swipe state
  let touchStartX = 0;
  let touchStartY = 0;
  let swipeId: string | null = null;
  let swipeLocked = false;
  const [swipeOffset, setSwipeOffset] = createSignal<Record<string, number>>({});

  const folder = () => currentFolder();
  const isTrash = () => folder() === "trash";
  const isSpam = () => folder() === "spam";
  const isSent = () => folder() === "sent";
  const isArchive = () => folder() === "archive";

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60_000) return "방금";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분`;
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
    return extractName(from).charAt(0).toUpperCase();
  }

  function displayName(email: { from: string; to?: string }): string {
    if (isSent() && email.to) return extractName(email.to);
    return extractName(email.from);
  }

  function displayInitial(email: { from: string; to?: string }): string {
    if (isSent() && email.to) return extractName(email.to).charAt(0).toUpperCase();
    return getInitial(email.from);
  }

  // --- 폴더별 primary 액션 (스와이프 오른쪽 / 행 버튼) ---
  async function handleRowPrimary(e: Event, id: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isTrash()) {
        await moveToInbox(id);
        showToast("받은편지함으로 이동됨", "success");
      } else if (isSpam()) {
        await unspamEmail(id);
        showToast("스팸 해제됨", "success");
      } else if (isArchive()) {
        await moveToInbox(id);
        showToast("받은편지함으로 이동됨", "success");
      } else {
        await archiveEmail(id);
        showToast("보관됨", "success");
      }
      refetch();
    } catch {
      showToast("처리 실패", "error");
    }
  }

  // --- 폴더별 삭제 액션 ---
  async function handleRowDelete(e: Event, id: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteEmail(id);
      showToast("휴지통으로 이동됨", "success");
      refetch();
    } catch {
      showToast("삭제 실패", "error");
    }
  }

  // --- 별표 토글 (휴지통/스팸/보낸편지함에서는 표시 안 함) ---
  async function handleRowStar(e: Event, id: string, isStarred: boolean) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isStarred) {
        await unstarEmail(id);
        showToast("별표 해제됨", "success");
      } else {
        await starEmail(id);
        showToast("별표 표시됨", "success");
      }
      refetch();
    } catch {
      showToast("처리 실패", "error");
    }
  }

  /** 현재 폴더에서 별표 액션을 표시할지 */
  function showStarAction(): boolean {
    return !isTrash() && !isSpam() && !isSent();
  }

  /** 현재 폴더에서 primary(보관/복원/이동) 액션을 표시할지 */
  function showPrimaryAction(): boolean {
    return !isSent();
  }

  /** 삭제(휴지통으로 이동) 표시 여부 — 이미 휴지통이면 불필요 */
  function showDeleteAction(): boolean {
    return !isTrash();
  }

  // --- 폴더별 스와이프 액션 ---
  function swipeRightAction(id: string) {
    if (isTrash() || isArchive()) {
      return moveToInbox(id).then(() => {
        showToast("받은편지함으로 이동됨", "success");
        refetch();
      });
    }
    if (isSpam()) {
      return unspamEmail(id).then(() => {
        showToast("스팸 해제됨", "success");
        refetch();
      });
    }
    return archiveEmail(id).then(() => {
      showToast("보관됨", "success");
      refetch();
    });
  }

  function swipeLeftAction(id: string) {
    return deleteEmail(id).then(() => {
      showToast("휴지통으로 이동됨", "success");
      refetch();
    });
  }

  function swipeRightLabel(): string {
    if (isTrash() || isArchive()) return "받은편지함";
    if (isSpam()) return "스팸 아님";
    return "보관";
  }

  function swipeLeftLabel(): string {
    return "삭제";
  }

  // Keyboard navigation
  function handleKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const list = emails();
    if (!list?.length) return;

    switch (e.key) {
      case "j": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, list.length - 1));
        break;
      }
      case "k": {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      }
      case "Enter": {
        const idx = focusedIndex();
        if (idx >= 0 && idx < list.length) {
          navigate(`/email/${list[idx].id}`);
        }
        break;
      }
      case "e": {
        e.preventDefault();
        const idx = focusedIndex();
        if (idx >= 0 && idx < list.length) {
          const id = list[idx].id;
          if (isTrash() || isArchive()) {
            moveToInbox(id).then(() => {
              showToast("받은편지함으로 이동됨", "success");
              refetch();
            }).catch(() => showToast("처리 실패", "error"));
          } else if (isSpam()) {
            unspamEmail(id).then(() => {
              showToast("스팸 해제됨", "success");
              refetch();
            }).catch(() => showToast("처리 실패", "error"));
          } else {
            archiveEmail(id).then(() => {
              showToast("보관됨", "success");
              refetch();
            }).catch(() => showToast("보관 실패", "error"));
          }
        }
        break;
      }
      case "#": {
        e.preventDefault();
        const idx = focusedIndex();
        if (idx >= 0 && idx < list.length) {
          deleteEmail(list[idx].id).then(() => {
            showToast("휴지통으로 이동됨", "success");
            refetch();
          }).catch(() => showToast("삭제 실패", "error"));
        }
        break;
      }
      case "c": {
        e.preventDefault();
        navigate("/compose");
        break;
      }
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Swipe handlers
  function handleTouchStart(id: string, e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipeId = id;
    swipeLocked = false;
  }

  function handleTouchMove(id: string, e: TouchEvent) {
    if (swipeId !== id) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (!swipeLocked && Math.abs(dy) > Math.abs(dx)) {
      swipeId = null;
      return;
    }

    if (Math.abs(dx) > 10) {
      swipeLocked = true;
      e.preventDefault();
      setSwipeOffset((prev) => ({ ...prev, [id]: dx }));
    }
  }

  function handleTouchEnd(id: string) {
    if (swipeId !== id) return;
    const offset = swipeOffset()[id] || 0;
    const threshold = 100;

    if (offset > threshold) {
      swipeRightAction(id).catch(() => showToast("처리 실패", "error"));
    } else if (offset < -threshold) {
      swipeLeftAction(id).catch(() => showToast("처리 실패", "error"));
    }

    setSwipeOffset((prev) => ({ ...prev, [id]: 0 }));
    swipeId = null;
    swipeLocked = false;
  }

  // Batch selection
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }

  function handleLongPress(id: string) {
    setSelectMode(true);
    setSelectedIds(new Set<string>([id]));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set<string>());
  }

  async function batchPrimary() {
    const ids = Array.from(selectedIds());
    try {
      if (isTrash() || isArchive()) {
        await Promise.all(ids.map((id) => moveToInbox(id)));
        showToast(`${ids.length}개 받은편지함으로 이동됨`, "success");
      } else if (isSpam()) {
        await Promise.all(ids.map((id) => unspamEmail(id)));
        showToast(`${ids.length}개 스팸 해제됨`, "success");
      } else {
        await Promise.all(ids.map((id) => archiveEmail(id)));
        showToast(`${ids.length}개 보관됨`, "success");
      }
      exitSelectMode();
      refetch();
    } catch {
      showToast("일부 처리 실패", "error");
    }
  }

  async function batchDelete() {
    const ids = Array.from(selectedIds());
    try {
      await Promise.all(ids.map((id) => deleteEmail(id)));
      showToast(`${ids.length}개 휴지통으로 이동됨`, "success");
      exitSelectMode();
      refetch();
    } catch {
      showToast("일부 삭제 실패", "error");
    }
  }

  let longPressTimer: ReturnType<typeof setTimeout>;

  // 행 primary 버튼 아이콘
  function PrimaryIcon() {
    if (isTrash() || isArchive()) {
      // 받은편지함 아이콘
      return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
    }
    if (isSpam()) {
      // 체크 아이콘 (스팸 아님)
      return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
    }
    // 보관 아이콘
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
  }

  function primaryLabel(): string {
    if (isTrash() || isArchive()) return "받은편지함으로";
    if (isSpam()) return "스팸 아님";
    return "보관";
  }

  function deleteLabel(): string {
    return "삭제";
  }

  return (
    <>
      <header class="content-header">
        <Show when={!searchOpen()}>
          <button class="icon-btn mobile-menu-btn" onClick={props.onMenuClick} aria-label="메뉴 열기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <span class="content-title">{FOLDER_LABELS[currentFolder()]}</span>
          <div class="header-spacer" />
          <button class="icon-btn" onClick={() => setSearchOpen(true)} aria-label="검색">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button class="icon-btn" onClick={() => refetch()} aria-label="새로고침">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
        </Show>
        <Show when={searchOpen()}>
          <div class="search-container search-expanded">
            <span class="search-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <input
              class="search-input"
              type="text"
              placeholder="메일 검색..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              aria-label="메일 검색"
              autofocus
            />
            <button class="icon-btn search-close-btn" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="검색 닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </Show>
      </header>

      <Show when={selectMode()}>
        <div class="batch-toolbar">
          <span class="batch-count">{selectedIds().size}개 선택</span>
          <Show when={showPrimaryAction()}>
            <button onClick={batchPrimary} aria-label={primaryLabel()}>
              <PrimaryIcon /> {primaryLabel()}
            </button>
          </Show>
          <Show when={showDeleteAction()}>
            <button onClick={batchDelete} aria-label={deleteLabel()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              {deleteLabel()}
            </button>
          </Show>
          <button onClick={exitSelectMode} aria-label="선택 취소">취소</button>
        </div>
      </Show>

      <div class="email-list-scroll" role="list" aria-label="이메일 목록">
        <Show when={!loading()} fallback={<div class="loading-screen" style="height:auto;padding:60px"><div class="spinner" /></div>}>
          <Show
            when={emails()?.length}
            fallback={
              <div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="opacity:0.3" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                메일이 없습니다
              </div>
            }
          >
            <For each={emails()}>
              {(email, i) => (
                <Motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i() * 0.025, 0.25) }}
                  role="listitem"
                >
                  <div class="email-row-wrapper">
                    <Show when={(swipeOffset()[email.id] || 0) > 0}>
                      <div class="swipe-bg archive" aria-hidden="true">{swipeRightLabel()}</div>
                    </Show>
                    <Show when={(swipeOffset()[email.id] || 0) < 0}>
                      <div class="swipe-bg delete" aria-hidden="true">{swipeLeftLabel()}</div>
                    </Show>
                    <div
                      class="email-row-inner"
                      style={{ transform: `translateX(${swipeOffset()[email.id] || 0}px)` }}
                      onTouchStart={(e) => handleTouchStart(email.id, e)}
                      onTouchMove={(e) => handleTouchMove(email.id, e)}
                      onTouchEnd={() => handleTouchEnd(email.id)}
                      onMouseDown={() => {
                        longPressTimer = setTimeout(() => handleLongPress(email.id), 500);
                      }}
                      onMouseUp={() => clearTimeout(longPressTimer)}
                      onMouseLeave={() => clearTimeout(longPressTimer)}
                    >
                      <A
                        href={selectMode() ? "#" : `/email/${email.id}`}
                        class="email-row"
                        classList={{
                          unread: email.labelIds?.includes("UNREAD"),
                          focused: focusedIndex() === i(),
                        }}
                        onClick={(e) => {
                          if (selectMode()) {
                            e.preventDefault();
                            toggleSelect(email.id);
                          }
                        }}
                        aria-label={`${displayName(email)}: ${email.subject || "(제목 없음)"}`}
                      >
                        <Show when={selectMode()}>
                          <div
                            class="email-checkbox"
                            classList={{ checked: selectedIds().has(email.id) }}
                            aria-checked={selectedIds().has(email.id)}
                            role="checkbox"
                          >
                            <Show when={selectedIds().has(email.id)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </Show>
                          </div>
                        </Show>
                        <Show when={!selectMode() && email.labelIds?.includes("UNREAD")}>
                          <div class="unread-dot" />
                        </Show>
                        <div class="email-avatar" aria-hidden="true">{displayInitial(email)}</div>
                        <div class="email-body-preview">
                          <div class="email-top-row">
                            <span class="email-from">
                              {isSent() ? <span class="sent-prefix">To </span> : null}
                              {displayName(email)}
                            </span>
                            <span class="email-date">{formatDate(email.date)}</span>
                          </div>
                          <div class="email-subject">{email.subject || "(제목 없음)"}</div>
                          <div class="email-snippet">{email.snippet}</div>
                        </div>
                        <Show when={!selectMode()}>
                          <div class="email-row-actions">
                            <Show when={showPrimaryAction()}>
                              <button
                                class="email-row-action desktop-only-action"
                                onClick={(e) => handleRowPrimary(e, email.id)}
                                aria-label={primaryLabel()}
                              >
                                <PrimaryIcon />
                              </button>
                            </Show>
                            <Show when={showDeleteAction()}>
                              <button
                                class="email-row-action danger"
                                onClick={(e) => handleRowDelete(e, email.id)}
                                aria-label={deleteLabel()}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </Show>
                            <Show when={showStarAction()}>
                              <button
                                class={`email-row-action ${email.labelIds?.includes("STARRED") ? "starred" : ""}`}
                                onClick={(e) => handleRowStar(e, email.id, email.labelIds?.includes("STARRED"))}
                                aria-label={email.labelIds?.includes("STARRED") ? "별표 해제" : "별표"}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill={email.labelIds?.includes("STARRED") ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              </button>
                            </Show>
                          </div>
                        </Show>
                      </A>
                    </div>
                  </div>
                </Motion.div>
              )}
            </For>
          </Show>
        </Show>
      </div>

      <button class="fab-compose" onClick={() => navigate("/compose")} aria-label="새 메일 작성">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </>
  );
}
