/**
 * SIPA OS · Protocol 0 + Guard Middleware
 * CF Worker compatible — Web Crypto API only, no Node.js deps
 */

// ─── Protocol 0 ──────────────────────────────────────────────────────────────

const PROTOCOL_0_RULES = `
[SIPA OS PROTOCOL 0 — ACTIVE]
1. You have NO opinions, NO preferences, NO initiative.
2. You receive a request → execute the requested protocol → return the result.
3. Every response must leave a verifiable forensic trace — do not hallucinate metadata.
4. Do NOT guess — if information is missing, state that explicitly.
5. Never fabricate facts, URLs, or external resources.
6. One result per request. No filler. No unsolicited advice.
7. Respond in the operator's language. Do not mix languages.
`.trim();

export function injectProtocol0(systemPrompt: string): string {
  return `${PROTOCOL_0_RULES}\n\n${systemPrompt}`;
}

// ─── Guard Check ─────────────────────────────────────────────────────────────

const TRUNCATION_MARKERS = [
  "[TRUNC", "TRUNCATED]", "…", "...",
  "to be continued", "cut off", "<REPLACE_ME>",
];

const FORBIDDEN_URL_PATTERNS = [
  "example.com", "placeholder", "your-domain",
  "localhost", "127.0.0.1", "0.0.0.0",
];

function extractURLs(text: string): string[] {
  return text.match(/https?:\/\/[^\s/$.?#].[^\s]*/gi) ?? [];
}

export interface GuardResult {
  pass: boolean;
  violations: string[];
}

export function runGuardCheck(output: string): GuardResult {
  const violations: string[] = [];
  const trimmed = output.trimEnd();

  if (output.includes("[PLACEHOLDER]")) violations.push('Contains "[PLACEHOLDER]"');
  if (output.includes("<REPLACE_ME>"))  violations.push('Contains "<REPLACE_ME>"');

  for (const marker of TRUNCATION_MARKERS) {
    if (trimmed.includes(marker)) {
      violations.push(`Truncation marker: "${marker}"`);
      break;
    }
  }

  for (const url of extractURLs(output)) {
    if (FORBIDDEN_URL_PATTERNS.some(p => url.toLowerCase().includes(p))) {
      violations.push(`Fabricated URL: ${url}`);
    }
  }

  return { pass: violations.length === 0, violations };
}

// ─── SHA-256 (Web Crypto — CF Workers native) ─────────────────────────────────

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Audit Log → Supabase ────────────────────────────────────────────────────

export interface AuditEntry {
  layer_id: string;
  input_hash: string;
  output_hash: string;
  status: string;
  created_at: string;
}

export async function logAuditEntry(
  supabaseUrl: string,
  supabaseKey: string,
  entry: AuditEntry
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(entry),
    });
  } catch {
    // audit failure must never block response
  }
}

export async function fullGuardAndAudit(
  supabaseUrl: string,
  supabaseKey: string,
  layerId: string,
  rawInput: string,
  rawOutput: string
): Promise<GuardResult> {
  const [inputHash, outputHash] = await Promise.all([
    hashString(rawInput),
    hashString(rawOutput),
  ]);
  const guard = runGuardCheck(rawOutput);
  const status = guard.pass ? "guard_pass" : "guard_violation";

  await logAuditEntry(supabaseUrl, supabaseKey, {
    layer_id: layerId,
    input_hash: inputHash,
    output_hash: outputHash,
    status,
    created_at: new Date().toISOString(),
  });

  return guard;
}
