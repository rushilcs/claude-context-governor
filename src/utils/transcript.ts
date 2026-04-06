import { readFileSync } from "node:fs";

export interface TranscriptMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface TranscriptEntry {
  type: string;
  message?: TranscriptMessage;
  [key: string]: unknown;
}

/**
 * Parse a Claude Code transcript JSONL file into structured messages.
 * Each line is a JSON object. We extract assistant messages for memory extraction.
 */
export function parseTranscript(filePath: string): TranscriptMessage[] {
  const raw = readFileSync(filePath, "utf-8");
  return parseTranscriptText(raw);
}

export function parseTranscriptText(text: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;

      if (entry.message) {
        const msg = entry.message;
        let contentStr: string | undefined;

        if (typeof msg.content === "string") {
          contentStr = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Claude Code stores content as [{type:"text", text:"..."}, ...]
          const textParts = (msg.content as Array<Record<string, unknown>>)
            .filter((block) => block.type === "text" && typeof block.text === "string")
            .map((block) => block.text as string);
          if (textParts.length > 0) {
            contentStr = textParts.join("\n");
          }
        }

        if (contentStr && contentStr.length > 0) {
          messages.push({
            role: msg.role || "assistant",
            content: contentStr,
            timestamp: (entry.timestamp as string) || undefined,
            tool_calls: msg.tool_calls,
          });
        }
      } else if (entry.type === "text" && typeof entry.content === "string") {
        messages.push({
          role: (entry.role as "user" | "assistant") || "assistant",
          content: entry.content as string,
        });
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

export function extractAssistantMessages(
  messages: TranscriptMessage[],
): string[] {
  return messages
    .filter((m) => m.role === "assistant" && m.content.length > 0)
    .map((m) => m.content);
}

export function getRelatedFilesFromTranscript(
  messages: TranscriptMessage[],
): string[] {
  const files = new Set<string>();
  const filePattern = /(?:^|\s|["'`])([./][\w./-]+\.\w{1,10})(?:\s|["'`]|$)/g;

  for (const msg of messages) {
    let match;
    while ((match = filePattern.exec(msg.content)) !== null) {
      files.add(match[1]);
    }
    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        const args = call.arguments;
        if (typeof args.path === "string") files.add(args.path);
        if (typeof args.file === "string") files.add(args.file);
        if (typeof args.filePath === "string") files.add(args.filePath);
      }
    }
  }

  return [...files];
}
