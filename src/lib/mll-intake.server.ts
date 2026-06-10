/**
 * SIPA OS · L01 Intake Router (lite)
 * Classifies user message via Lovable AI gateway (Gemini Flash)
 * CF Worker compatible — fetch() only
 */

export type TaskCategory =
  | "research"
  | "code"
  | "vision"
  | "writing"
  | "system"
  | "voice_input"
  | "container_ops"
  | "nim_inference"
  | "braindump"
  | "unknown";

export interface L01Result {
  category: TaskCategory;
  confidence: number;
  language: string;
}

const L01_SYSTEM = `You are L01 IntakeRouter for SIPA OS.
Classify the user message into exactly one category:
research | code | vision | writing | system | voice_input | container_ops | nim_inference | braindump | unknown

Return ONLY valid JSON: {"category":"<category>","confidence":<0.0-1.0>,"language":"<detected_lang_code>"}
No other text.`;

export async function runL01Classify(
  userMessage: string,
  lovableApiKey: string,
  gatewayFn: (key: string, model: string, messages: {role:string;content:string}[]) => Promise<string>
): Promise<L01Result> {
  try {
    const raw = await gatewayFn(lovableApiKey, "google/gemini-3-flash-preview", [
      { role: "system", content: L01_SYSTEM },
      { role: "user",   content: userMessage.slice(0, 500) },
    ]);
    // extract JSON from response
    const match = raw.match(/\{[^}]+\}/);
    if (match) return JSON.parse(match[0]) as L01Result;
  } catch {
    // classification failure is non-blocking
  }
  return { category: "unknown", confidence: 0, language: "unknown" };
}
