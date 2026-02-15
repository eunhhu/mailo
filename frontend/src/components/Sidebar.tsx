import { createEffect, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { MailFolder } from "../stores/emails";

interface SidebarProps {
  currentFolder: () => MailFolder;
  onFolderChange: (folder: MailFolder) => void;
  email: string;
  open: boolean;
  onClose: () => void;
}

const FOLDERS: { id: MailFolder; label: string; icon: string }[] = [
  { id: "inbox", label: "받은편지함", icon: "inbox" },
  { id: "starred", label: "중요편지함", icon: "star" },
  { id: "sent", label: "보낸편지함", icon: "send" },
  { id: "archive", label: "보관함", icon: "archive" },
  { id: "spam", label: "스팸", icon: "alert" },
  { id: "trash", label: "휴지통", icon: "trash" },
  { id: "all", label: "전체메일", icon: "mail" },
];

function FolderIcon(props: { type: string }) {
  const size = 18;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const, "aria-hidden": "true" as const };

  switch (props.type) {
    case "inbox": return <svg {...common}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
    case "star": return <svg {...common}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case "send": return <svg {...common}><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>;
    case "archive": return <svg {...common}><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
    case "alert": return <svg {...common}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>;
    case "trash": return <svg {...common}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    case "mail": return <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
    default: return null;
  }
}

export default function Sidebar(props: SidebarProps) {
  const navigate = useNavigate();
  let sidebarRef: HTMLElement | undefined;

  function handleFolder(folder: MailFolder) {
    props.onFolderChange(folder);
    props.onClose();
    navigate("/");
  }

  async function handleLogout() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Focus trapping for mobile sidebar
  createEffect(() => {
    if (!props.open || !sidebarRef) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        props.onClose();
        return;
      }

      if (e.key !== "Tab" || !sidebarRef) return;

      const focusable = sidebarRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <>
      <div
        class={`sidebar-overlay ${props.open ? "open" : ""}`}
        onClick={props.onClose}
        aria-hidden="true"
      />
      <aside
        ref={sidebarRef}
        class={`sidebar ${props.open ? "open" : ""}`}
        role="navigation"
        aria-label="메일 폴더 탐색"
      >
        <div class="sidebar-header">
          <span class="sidebar-logo">mailo</span>
        </div>

        <div class="sidebar-compose">
          <button class="compose-sidebar-btn" onClick={() => { navigate("/compose"); props.onClose(); }} aria-label="새 메일 작성">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            새 메일
          </button>
        </div>

        <nav class="sidebar-nav" aria-label="메일 폴더">
          {FOLDERS.map((f) => (
            <button
              class={`nav-item ${props.currentFolder() === f.id ? "active" : ""}`}
              onClick={() => handleFolder(f.id)}
              aria-current={props.currentFolder() === f.id ? "page" : undefined}
              aria-label={f.label}
            >
              <FolderIcon type={f.icon} />
              <span class="nav-item-label">{f.label}</span>
            </button>
          ))}
        </nav>

        <div class="sidebar-footer">
          <span class="sidebar-footer-email">{props.email}</span>
          <button class="logout-btn" onClick={handleLogout} aria-label="로그아웃">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>
    </>
  );
}
