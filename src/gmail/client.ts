import type { GmailMessage, GmailMessageList } from "./types";

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";

function getHeader(headers: { name: string; value: string }[], name: string): string {
	return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
	const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
	return atob(base64);
}

function extractBody(payload: GmailMessage["payload"]): {
	text: string;
	html: string;
} {
	let text = "";
	let html = "";

	if (payload.body?.data) {
		const decoded = decodeBase64Url(payload.body.data);
		if (payload.mimeType === "text/plain") text = decoded;
		else if (payload.mimeType === "text/html") html = decoded;
	}

	if (payload.parts) {
		for (const part of payload.parts) {
			if (part.mimeType === "text/plain" && part.body?.data) {
				text = decodeBase64Url(part.body.data);
			} else if (part.mimeType === "text/html" && part.body?.data) {
				html = decodeBase64Url(part.body.data);
			} else if (part.mimeType === "multipart/alternative" && part.parts) {
				for (const subPart of part.parts) {
					if (subPart.mimeType === "text/plain" && subPart.body?.data) {
						text = decodeBase64Url(subPart.body.data);
					} else if (subPart.mimeType === "text/html" && subPart.body?.data) {
						html = decodeBase64Url(subPart.body.data);
					}
				}
			}
		}
	}

	return { text, html };
}

export interface MessageSummary {
	id: string;
	threadId: string;
	snippet: string;
	from: string;
	subject: string;
	date: string;
	labelIds: string[];
}

export interface MessageDetail {
	id: string;
	threadId: string;
	snippet: string;
	from: string;
	to: string;
	subject: string;
	date: string;
	labelIds: string[];
	body: {
		text: string;
		html: string;
	};
}

export async function listMessages(
	accessToken: string,
	query?: string,
	maxResults = 20,
): Promise<MessageSummary[]> {
	const params = new URLSearchParams({
		maxResults: String(maxResults),
	});
	if (query) params.set("q", query);

	const listRes = await fetch(`${GMAIL_API}/messages?${params}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!listRes.ok) {
		throw new Error(`Gmail list failed: ${await listRes.text()}`);
	}

	const list: GmailMessageList = await listRes.json();
	if (!list.messages?.length) return [];

	const messages = await Promise.all(
		list.messages.map(async (msg) => {
			const res = await fetch(
				`${GMAIL_API}/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);

			if (!res.ok) return null;

			const detail: GmailMessage = await res.json();
			const headers = detail.payload?.headers ?? [];

			return {
				id: detail.id,
				threadId: detail.threadId,
				snippet: detail.snippet,
				from: getHeader(headers, "From"),
				subject: getHeader(headers, "Subject"),
				date: getHeader(headers, "Date"),
				labelIds: detail.labelIds ?? [],
			};
		}),
	);

	return messages.filter((m): m is MessageSummary => m !== null);
}

export async function getMessage(accessToken: string, messageId: string): Promise<MessageDetail> {
	const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) {
		throw new Error(`Gmail get message failed: ${await res.text()}`);
	}

	const msg: GmailMessage = await res.json();
	const headers = msg.payload?.headers ?? [];
	const body = extractBody(msg.payload);

	return {
		id: msg.id,
		threadId: msg.threadId,
		snippet: msg.snippet,
		from: getHeader(headers, "From"),
		to: getHeader(headers, "To"),
		subject: getHeader(headers, "Subject"),
		date: getHeader(headers, "Date"),
		labelIds: msg.labelIds ?? [],
		body,
	};
}

function encodeBase64Url(str: string): string {
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMessage(
	accessToken: string,
	from: string,
	to: string,
	subject: string,
	body: string,
): Promise<{ id: string; threadId: string }> {
	const raw = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: base64",
		"",
		btoa(unescape(encodeURIComponent(body))),
	].join("\r\n");

	const encodedMessage = encodeBase64Url(raw);

	const res = await fetch(`${GMAIL_API}/messages/send`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ raw: encodedMessage }),
	});

	if (!res.ok) {
		throw new Error(`Gmail send failed: ${await res.text()}`);
	}

	return res.json();
}
