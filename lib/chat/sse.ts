export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseResponse(
  stream: ReadableStream<Uint8Array>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(stream, {
    headers: { ...SSE_HEADERS, ...extraHeaders },
  });
}

export interface ChatStreamDonePayload {
  reply: string;
  correlationId: string;
}

export interface ChatStreamErrorPayload {
  error: string;
  status?: number;
}

export interface ChatStreamTokenPayload {
  token: string;
}

/** Parse SSE lines from a chunk buffer (handles partial lines across reads). */
export function parseSseBuffer(
  buffer: string,
  onEvent: (event: string, data: unknown) => void
): string {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  for (const block of parts) {
    const lines = block.split("\n");
    let event = "message";
    let dataLine = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
    }
    if (dataLine) {
      try {
        onEvent(event, JSON.parse(dataLine));
      } catch {
        onEvent(event, dataLine);
      }
    }
  }
  return remainder;
}

export async function consumeChatStream(
  response: Response,
  handlers: {
    onToken: (token: string) => void;
    onDone: (payload: ChatStreamDonePayload) => void | Promise<void>;
    onError: (payload: ChatStreamErrorPayload) => void;
  }
): Promise<void> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as {
        reply?: string;
        error?: string;
        correlationId?: string;
      };
      if (!response.ok) {
        handlers.onError({ error: data.error ?? "Request failed", status: response.status });
        return;
      }
      if (data.reply != null) {
        handlers.onDone({
          reply: data.reply,
          correlationId: data.correlationId ?? "",
        });
      }
    } catch {
      handlers.onError({ error: "Invalid response from server", status: response.status });
    }
    return;
  }

  if (!response.body) {
    handlers.onError({ error: "Empty stream", status: response.status });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePromise: Promise<void> | undefined;

  const handleEvent = (event: string, data: unknown) => {
    if (event === "token") {
      const payload = data as ChatStreamTokenPayload;
      if (payload.token) handlers.onToken(payload.token);
    } else if (event === "done") {
      donePromise = Promise.resolve(
        handlers.onDone(data as ChatStreamDonePayload)
      );
    } else if (event === "error") {
      handlers.onError(data as ChatStreamErrorPayload);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseBuffer(buffer, handleEvent);
  }

  if (buffer.trim()) {
    parseSseBuffer(`${buffer}\n\n`, handleEvent);
  }

  if (donePromise) await donePromise;
}
