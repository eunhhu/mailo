import { createSignal, createEffect } from "solid-js";
import { apiGet, apiPost, apiPostAction } from "../api/client";

export interface MessageSummary {
  id: string;
  threadId: string;
  from: string;
  to?: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
}

export interface MessageDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
  body: {
    text: string;
    html: string;
  };
}

interface MessageListResponse {
  messages: MessageSummary[];
}

interface MessageDetailResponse {
  message: MessageDetail;
}

interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export type MailFolder = "inbox" | "sent" | "starred" | "archive" | "spam" | "trash" | "all";

const FOLDER_QUERIES: Record<MailFolder, string> = {
  inbox: "label:INBOX",
  sent: "label:SENT",
  starred: "label:STARRED",
  archive: "-label:INBOX -label:SPAM -label:TRASH -label:SENT",
  spam: "label:SPAM",
  trash: "label:TRASH",
  all: "",
};

// --- Cache ---
const CACHE_TTL = 2 * 60_000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const listCache = new Map<string, CacheEntry<MessageSummary[]>>();
const detailCache = new Map<string, CacheEntry<MessageDetail>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

// --- List store ---
const [currentFolder, setCurrentFolder] = createSignal<MailFolder>("inbox");
const [searchQuery, setSearchQuery] = createSignal("");
const [emails, setEmails] = createSignal<MessageSummary[]>([]);
const [emailsLoading, setEmailsLoading] = createSignal(false);
let lastListQuery = "";

function buildQuery(): string {
  const folder = currentFolder();
  const search = searchQuery();
  const parts: string[] = [];
  const folderQ = FOLDER_QUERIES[folder];
  if (folderQ) parts.push(folderQ);
  if (search) parts.push(search);
  return parts.join(" ");
}

async function loadEmails(force = false) {
  const query = buildQuery();

  if (!force) {
    const cached = getCached(listCache, query);
    if (cached && query === lastListQuery) {
      setEmails(cached);
      return;
    }
  }

  // If query didn't change and we have data, show stale while revalidating
  if (query === lastListQuery && emails().length > 0) {
    // background refresh - don't show loading
  } else {
    setEmailsLoading(true);
  }

  lastListQuery = query;

  try {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const data = await apiGet<MessageListResponse>(`/api/messages${params}`);
    setCache(listCache, query, data.messages);
    // Only update if still the current query
    if (buildQuery() === query) {
      setEmails(data.messages);
    }
  } catch (e) {
    if (buildQuery() === query && emails().length === 0) {
      setEmails([]);
    }
    throw e;
  } finally {
    setEmailsLoading(false);
  }
}

// Auto-fetch when folder/search changes
createEffect(() => {
  const query = buildQuery();
  const cached = getCached(listCache, query);
  if (cached) {
    setEmails(cached);
    lastListQuery = query;
    return;
  }
  loadEmails();
});

export function useEmails() {
  return {
    emails,
    loading: emailsLoading,
    refetch: () => loadEmails(true),
    searchQuery,
    setSearchQuery,
    currentFolder,
    setCurrentFolder,
  };
}

// --- Detail store ---
const [currentEmail, setCurrentEmail] = createSignal<MessageDetail | null>(null);
const [emailLoading, setEmailLoading] = createSignal(false);
let lastDetailId = "";

async function loadEmail(id: string, force = false) {
  if (!id) return;

  if (!force) {
    const cached = getCached(detailCache, id);
    if (cached) {
      setCurrentEmail(cached);
      lastDetailId = id;
      return;
    }
  }

  if (id !== lastDetailId) {
    setEmailLoading(true);
  }

  lastDetailId = id;

  try {
    const data = await apiGet<MessageDetailResponse>(`/api/messages/${id}`);
    setCache(detailCache, id, data.message);
    if (lastDetailId === id) {
      setCurrentEmail(data.message);
    }
  } catch {
    if (lastDetailId === id) {
      setCurrentEmail(null);
    }
  } finally {
    setEmailLoading(false);
  }
}

export function useEmail(id: () => string) {
  createEffect(() => {
    const emailId = id();
    if (emailId) loadEmail(emailId);
  });

  return {
    email: currentEmail,
    loading: emailLoading,
    refetch: () => loadEmail(lastDetailId, true),
  };
}

// --- Actions ---
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  await apiPost("/api/messages/send", payload);
}

function invalidateAll(id: string) {
  listCache.clear();
  detailCache.delete(id);
}

export async function archiveEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/archive`);
  invalidateAll(id);
}

export async function deleteEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/trash`);
  invalidateAll(id);
}

export async function untrashEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/untrash`);
  invalidateAll(id);
}

export async function markAsRead(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/read`);
  // 리스트 캐시에서 해당 메일의 UNREAD 라벨을 즉시 제거 (뒤로 가기 시 반영)
  for (const [key, entry] of listCache) {
    const idx = entry.data.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const updated = [...entry.data];
      updated[idx] = {
        ...updated[idx],
        labelIds: updated[idx].labelIds.filter((l) => l !== "UNREAD"),
      };
      entry.data = updated;
      setEmails((prev) =>
        prev.map((m) => m.id === id ? { ...m, labelIds: m.labelIds.filter((l) => l !== "UNREAD") } : m)
      );
    }
  }
  detailCache.delete(id);
}

export async function markAsUnread(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/unread`);
  invalidateAll(id);
}

export async function starEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/star`);
  invalidateAll(id);
}

export async function unstarEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/unstar`);
  invalidateAll(id);
}

export async function reportSpam(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/spam`);
  invalidateAll(id);
}

export async function unspamEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/unspam`);
  invalidateAll(id);
}

export async function moveToInbox(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/move-to-inbox`);
  invalidateAll(id);
}

export async function permanentDeleteEmail(id: string): Promise<void> {
  await apiPostAction(`/api/messages/${id}/delete`);
  invalidateAll(id);
}
