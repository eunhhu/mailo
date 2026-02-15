export interface GmailHeader {
	name: string;
	value: string;
}

export interface GmailPart {
	partId: string;
	mimeType: string;
	filename: string;
	headers: GmailHeader[];
	body: {
		attachmentId?: string;
		size: number;
		data?: string;
	};
	parts?: GmailPart[];
}

export interface GmailPayload {
	partId: string;
	mimeType: string;
	filename: string;
	headers: GmailHeader[];
	body: {
		size: number;
		data?: string;
	};
	parts?: GmailPart[];
}

export interface GmailMessage {
	id: string;
	threadId: string;
	labelIds: string[];
	snippet: string;
	payload: GmailPayload;
	sizeEstimate: number;
	internalDate: string;
}

export interface GmailMessageList {
	messages: { id: string; threadId: string }[];
	nextPageToken?: string;
	resultSizeEstimate: number;
}

export interface SendMailRequest {
	to: string;
	subject: string;
	body: string;
}
