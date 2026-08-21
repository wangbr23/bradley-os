import "server-only";

import { ImapFlow, type FetchMessageObject } from "imapflow";

const MAX_MESSAGES = 50;
const SOURCE_PREVIEW_BYTES = 24_000;
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60_000;
let digestCache: { messages: InboxDigestMessage[]; fetchedAt: number } | null = null;
let digestRefresh: Promise<InboxDigestMessage[]> | null = null;

export interface InboxDigestMessage {
  id: string;
  sender: string;
  senderAddress?: string;
  subject: string;
  receivedAt: Date;
  snippet: string;
}

function getCredentials() {
  const user = process.env.OWNER_EMAIL?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replaceAll(" ", "").trim();

  if (!user || !pass) {
    throw new Error("Gmail IMAP credentials are not configured");
  }

  return { user, pass };
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function createSnippet(source?: Buffer) {
  if (!source) return "No preview available.";

  const raw = source.toString("utf8");
  const body = raw.split(/\r?\n\r?\n/, 2)[1] ?? "";
  const cleaned = decodeQuotedPrintable(body)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^--[-=_A-Za-z0-9.]+$/gm, " ")
    .replace(/^Content-(?:Type|Transfer-Encoding|Disposition):.*$/gim, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^[A-Za-z0-9+/=]{160,}$/.test(cleaned)) {
    return "No preview available.";
  }

  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}…` : cleaned;
}

function toDigestMessage(message: FetchMessageObject): InboxDigestMessage {
  const from = message.envelope?.from?.[0];
  const receivedAt = new Date(
    message.internalDate ?? message.envelope?.date ?? Date.now(),
  );

  return {
    id: String(message.uid),
    sender: from?.name || from?.address || "Unknown sender",
    senderAddress: from?.address,
    subject: message.envelope?.subject?.trim() || "(No subject)",
    receivedAt,
    snippet: createSnippet(message.source),
  };
}

export async function getInboxDigest(): Promise<InboxDigestMessage[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: getCredentials(),
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });

    const matches = await client.search(
      { gmraw: "category:primary is:unread newer_than:1d" },
      { uid: true },
    );

    if (!matches || matches.length === 0) return [];

    const messages = await client.fetchAll(
      matches.slice(-MAX_MESSAGES),
      {
        uid: true,
        envelope: true,
        internalDate: true,
        source: { maxLength: SOURCE_PREVIEW_BYTES },
      },
      { uid: true },
    );
    const cutoff = Date.now() - DIGEST_WINDOW_MS;

    return messages
      .map(toDigestMessage)
      .filter((message) => message.receivedAt.getTime() >= cutoff)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  } finally {
    if (client.usable) {
      await client.logout().catch(() => client.close());
    } else {
      client.close();
    }
  }
}

export async function getInboxDigestSnapshot(force = false) {
  const now = Date.now();
  if (!force && digestCache) {
    const stale = now - digestCache.fetchedAt >= CACHE_TTL_MS;
    if (stale && !digestRefresh) {
      digestRefresh = getInboxDigest()
        .then((messages) => {
          digestCache = { messages, fetchedAt: Date.now() };
          return messages;
        })
        .finally(() => {
          digestRefresh = null;
        });
    }
    return {
      messages: digestCache.messages,
      stale,
    };
  }

  if (!digestRefresh) {
    digestRefresh = getInboxDigest().finally(() => {
      digestRefresh = null;
    });
  }
  const messages = await digestRefresh;
  digestCache = { messages, fetchedAt: Date.now() };
  return { messages, stale: false };
}
