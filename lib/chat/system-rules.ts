export interface SystemRulesJson {
  schemaVersion: number;
  calendarPromptCompact: string | string[];
  calendarPromptTemplate: string | string[];
  researchPrompt: string | string[];
}

let _systemRules: SystemRulesJson | null = null;

export async function getSystemRules(origin: string): Promise<SystemRulesJson> {
  if (_systemRules) return _systemRules;
  try {
    const res = await fetch(`${origin}/system-rules.json`);
    if (res.ok) {
      _systemRules = (await res.json()) as SystemRulesJson;
      return _systemRules;
    }
  } catch {
    // fall through to embedded fallback
  }
  _systemRules = { schemaVersion: 1, calendarPromptCompact: "", calendarPromptTemplate: "", researchPrompt: "" };
  return _systemRules;
}

export function getCachedSystemRules(): SystemRulesJson {
  return _systemRules ?? { schemaVersion: 1, calendarPromptCompact: "", calendarPromptTemplate: "", researchPrompt: "" };
}

export function compilePrompt(sections: string | readonly string[]): string {
  return typeof sections === "string" ? sections : sections.join("\n\n");
}
