import fs from "fs";

const path = "app/chat/page.tsx";
let lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const startRemove1 = lines.findIndex((l) => l.startsWith("function getChatErrorMessage"));
const endRemove1 = lines.findIndex((l) => l.includes("const SUGGESTIONS_GROUP_A"));
if (startRemove1 >= 0 && endRemove1 > startRemove1) {
  lines.splice(startRemove1, endRemove1 - startRemove1);
}

const startRemove2 = lines.findIndex((l) => l.includes("const SUGGESTIONS_GROUP_A"));
const endRemove2 = lines.findIndex((l) => l.startsWith("export default function ChatPage"));
if (startRemove2 >= 0 && endRemove2 > startRemove2) {
  lines.splice(startRemove2, endRemove2 - startRemove2);
}

let content = lines.join("\n");

const newImports = `import { FormattedMessage } from "@/components/chat/formatted-message";
import { SuggestionCarousel } from "@/components/chat/suggestion-carousel";
import { getRandomSuggestions } from "@/components/chat/suggestion-data";
import {
  CHAT_TURNSTILE_COOKIE,
  FETCH_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  escapeRegExp,
  formatTime24,
  getActiveMentionMatch,
  getChatErrorMessage,
  getRandomLoadingPhrase,
  parseChatResponse,
  prepareHistory,
  type ChatMessageItem,
  type MentionMatch,
} from "@/components/chat/chat-utils";
import {
  getInitialChatSessions,
  mergeSessionMapsFromHomepage,
  resolveSessionsForProgram,
  type ProgramSessionMap,
} from "@/lib/chat/session-state";
`;

content = content.replace(
  'import { useEngagementPrompt } from "@/components/engagement-prompt-provider";',
  `import { useEngagementPrompt } from "@/components/engagement-prompt-provider";\n${newImports}`
);

content = content
  .replace('import useEmblaCarousel from "embla-carousel-react";\n', "")
  .replace(/import {\s*Table,[\s\S]*?} from "@\/components\/ui\/table";\n/, "")
  .replace(/import {\s*isMarkdownTableSeparator,[\s\S]*?} from "@\/lib\/format-ai-table";\n/, "");

content = content.replace(
  /interface Message \{[\s\S]*?\}\n\ninterface MentionMatch \{[\s\S]*?\}\n\n/,
  "type Message = ChatMessageItem;\n\n"
);

content = content.replace(
  /\{messages\.length === 0 && \(\s*<div className="suggestions-carousel[\s\S]*?<\/div>\s*\)\}/,
  `{messages.length === 0 && (
            <SuggestionCarousel
              suggestions={suggestions}
              disabled={
                waitForTurnstileConfig ||
                (requiresTurnstile && !turnstileToken.trim()) ||
                isLoading
              }
              onSelect={(suggestion) => sendMessage(suggestion)}
            />
          )}`
);

content = content.replace(/\n\s*const \[emblaRef\] = useEmblaCarousel\([^)]*\);\n/, "\n");

// Remove duplicate session-state helpers if still present
content = content.replace(
  /type ProgramSessionMap = Partial<Record<ProgramValue, SessionId\[\]>>;\n\nfunction resolveSessionsForProgram\([\s\S]*?\n\}\n\nfunction normalizeEntriesFromSessionMap\([\s\S]*?\n\}\n\nfunction mergeSessionMapsFromHomepage\([\s\S]*?\n\}\n\n/,
  ""
);

content = content.replace(
  /function getRandomSuggestions\([\s\S]*?\n\}\n\n/,
  ""
);

content = content.replace(
  /const MAX_HISTORY_CONTENT_LENGTH = 2000;\nconst MAX_HISTORY_ITEMS = 4;\n\nfunction prepareHistory\([\s\S]*?\n\}\n\n/,
  ""
);

content = content.replace(
  /function formatTime24\([\s\S]*?\n\}\n\nfunction getInitialChatSessions\([\s\S]*?\n\}\n\nfunction getActiveMentionMatch\([\s\S]*?\n\}\n\nfunction escapeRegExp\([\s\S]*?\n\}\n\n/,
  ""
);

content = content.replace(
  /const LOADING_PHRASES = \[[\s\S]*?\];\n\nconst FETCH_TIMEOUT_MS = 60_000;\nconst RETRY_DELAYS_MS = \[400, 800, 1600\];\nconst CHAT_TURNSTILE_COOKIE = "chat_turnstile_verified";\n\nfunction getRandomLoadingPhrase\([\s\S]*?\n\}\n\n/,
  ""
);

fs.writeFileSync(path, content);
console.log("patched chat page");
