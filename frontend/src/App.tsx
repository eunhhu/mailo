import { Router, Route, Navigate } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";
import { apiGet } from "./api/client";
import { useEmails } from "./stores/emails";
import Sidebar from "./components/Sidebar";
import { ToastContainer } from "./components/Toast";
import Login from "./routes/Login";
import Inbox from "./routes/Inbox";
import Email from "./routes/Email";
import Compose from "./routes/Compose";

interface AuthUser {
  email: string;
}

export default function App() {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const { currentFolder, setCurrentFolder } = useEmails();

  onMount(async () => {
    try {
      const me = await apiGet<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      // not authenticated
    } finally {
      setLoading(false);
    }
  });

  function Shell(props: { children: JSX.Element }) {
    return (
      <>
        <a href="#main-content" class="skip-nav">본문으로 바로가기</a>
        <div class="shell">
          <Sidebar
            currentFolder={currentFolder}
            onFolderChange={setCurrentFolder}
            email={user()?.email ?? ""}
            open={sidebarOpen()}
            onClose={() => setSidebarOpen(false)}
          />
          <main class="main-content" id="main-content">
            {props.children}
          </main>
        </div>
        <ToastContainer />
      </>
    );
  }

  function AuthGuard(props: { children: JSX.Element }) {
    return (
      <Show when={!loading()} fallback={<div class="loading-screen"><div class="spinner" /></div>}>
        <Show when={user()} fallback={<Navigate href="/login" />}>
          <Shell>{props.children}</Shell>
        </Show>
      </Show>
    );
  }

  return (
    <Router>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={() => (
          <AuthGuard>
            <Inbox onMenuClick={() => setSidebarOpen(true)} />
          </AuthGuard>
        )}
      />
      <Route
        path="/email/:id"
        component={() => (
          <AuthGuard>
            <Email />
          </AuthGuard>
        )}
      />
      <Route
        path="/compose"
        component={() => (
          <AuthGuard>
            <Compose />
          </AuthGuard>
        )}
      />
    </Router>
  );
}
