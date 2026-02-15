import { createSignal, createResource } from "solid-js";
import { apiGet, apiPost } from "../api/client";

export interface MessageSummary {
  id: string;
  threadId: string;
  from: string;
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

const [searchQuery, setSearchQuery] = createSignal("");

async function fetchMessages(query: string): Promise<MessageSummary[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : "";
  const data = await apiGet<MessageListResponse>(`/api/messages${params}`);
  return data.messages;
}

async function fetchMessage(id: string): Promise<MessageDetail> {
  const data = await apiGet<MessageDetailResponse>(`/api/messages/${id}`);
  return data.message;
}

export function useEmails() {
  const [emails] = createResource(searchQuery, fetchMessages);
  return { emails, searchQuery, setSearchQuery };
}

export function useEmail(id: () => string) {
  const [email] = createResource(id, fetchMessage);
  return email;
}

export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  await apiPost("/api/messages/send", payload);
}
