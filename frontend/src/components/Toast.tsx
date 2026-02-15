import { createSignal, For, onCleanup } from "solid-js";
import { Motion, Presence } from "@motionone/solid";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  undoAction?: () => void;
}

let nextId = 0;
const [toasts, setToasts] = createSignal<Toast[]>([]);

export function showToast(message: string, type: ToastType = "info", undoAction?: () => void) {
  const id = nextId++;
  setToasts((prev) => [...prev, { id, message, type, undoAction }]);

  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
}

function dismissToast(id: number) {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

export function ToastContainer() {
  return (
    <div class="toast-container" aria-live="polite" role="status">
      <Presence>
        <For each={toasts()}>
          {(toast) => (
            <Motion.div
              class={`toast toast-${toast.type}`}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <span class="toast-message">{toast.message}</span>
              {toast.undoAction && (
                <button
                  class="toast-undo"
                  onClick={() => {
                    toast.undoAction!();
                    dismissToast(toast.id);
                  }}
                >
                  실행취소
                </button>
              )}
              <button
                class="toast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="알림 닫기"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </Motion.div>
          )}
        </For>
      </Presence>
    </div>
  );
}
