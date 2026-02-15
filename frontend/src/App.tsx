import { Router, Route, Navigate } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { apiGet } from "./api/client";
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

  function AuthGuard(props: { children: any }) {
    return (
      <Show when={!loading()} fallback={<div class="loading">로딩 중...</div>}>
        <Show when={user()} fallback={<Navigate href="/login" />}>
          {props.children}
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
            <Inbox />
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
