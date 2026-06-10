import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { resolveModel, resolveFreeModel } from "@/lib/ai-gateway.server";
import { injectProtocol0, fullGuardAndAudit } from "@/lib/protocol0-guard.server";
import { runL01Classify, type TaskCategory } from "@/lib/mll-intake.server";

// ─── Auth0 JWT verification (JWKS · RS256) ────────────────────────────────────

const AUTH0_JWKS_URL = "https://dev-6imvg2uallgochox.us.auth0.com/.well-known/jwks.json";
const AUTH0_AUDIENCE  = "https://api.sipa-os.org";
const AUTH0_ISSUER    = "https://dev-6imvg2uallgochox.us.auth0.com/";

interface JWK {
  kty: string;
  use?: string;
  n: string;
  e: string;
  kid: string;
  alg?: string;
}

// Minimal in-process JWKS cache (survives the lifetime of a single Worker isolate)
const jwksCache = new Map<string, CryptoKey>();
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 3_600_000; // 1 hour

function base64urlToBuffer(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getPublicKey(kid: string): Promise<CryptoKey | null> {
  const now = Date.now();
  if (jwksCache.has(kid) && now - jwksFetchedAt < JWKS_TTL_MS) {
    return jwksCache.get(kid)!;
  }

  const res = await fetch(AUTH0_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as { keys: JWK[] };

  jwksFetchedAt = now;
  jwksCache.clear();

  for (const jwk of keys) {
    if (jwk.use !== "sig" || jwk.kty !== "RSA") continue;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "RSA",
        n: jwk.n,
        e: jwk.e,
        alg: "RS256",
        ext: true,
        key_ops: ["verify"],
      },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    jwksCache.set(jwk.kid, cryptoKey);
  }

  return jwksCache.get(kid) ?? null;
}

function parseJwtHeader(token: string): { kid?: string; alg?: string } {
  const [headerB64] = token.split(".");
  try {
    return JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    throw new Error("JWT payload decode failed");
  }
}

/**
 * Verify an Auth0 RS256 JWT locally using JWKS.
 * Returns the payload (claims) on success, throws on failure.
 */
async function verifyAuth0JWT(token: string): Promise<Record<string, unknown>> {
  const header = parseJwtHeader(token);
  if (!header.kid) throw new Error("JWT missing kid");
  if (header.alg && header.alg !== "RS256") throw new Error("JWT alg must be RS256");

  const publicKey = await getPublicKey(header.kid);
  if (!publicKey) throw new Error(`No JWKS key found for kid=${header.kid}`);

  const [headerB64, payloadB64, sigB64] = token.split(".");
  // Use a fresh ArrayBuffer to avoid SharedArrayBuffer type conflicts in CF Workers
  const sigBytes  = base64urlToBuffer(sigB64);
  const sigBuf    = new Uint8Array(sigBytes).buffer as ArrayBuffer;
  const inputBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const inputBuf  = new Uint8Array(inputBytes).buffer as ArrayBuffer;

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    sigBuf,
    inputBuf
  );
  if (!valid) throw new Error("JWT signature invalid");

  const payload = parseJwtPayload(token);

  // Validate standard claims
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) throw new Error("JWT expired");
  if (typeof payload.nbf === "number" && payload.nbf > now) throw new Error("JWT not yet valid");
  if (payload.iss !== AUTH0_ISSUER) throw new Error(`JWT issuer mismatch: ${payload.iss}`);

  // Validate audience (can be string or array)
  const aud = payload.aud;
  const audOk = aud === AUTH0_AUDIENCE ||
    (Array.isArray(aud) && aud.includes(AUTH0_AUDIENCE));
  if (!audOk) throw new Error(`JWT audience mismatch: ${JSON.stringify(aud)}`);

  return payload;
}

// ─── Language helpers ─────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian",
  he: "Hebrew",
};

// ─── L01 → system prompt routing ─────────────────────────────────────────────

const CATEGORY_VOICE: Record<TaskCategory, string> = {
  research:      "technical",
  code:          "technical",
  vision:        "technical",
  writing:       "aelin",
  system:        "technical",
  voice_input:   "aelin",
  container_ops: "technical",
  nim_inference: "technical",
  braindump:     "aelin",
  unknown:       "neutral",
};

const VOICE_INSTRUCTIONS: Record<string, string> = {
  aelin:     "Raw, authentic, neurodivergent lens. No corporate speak. Personal truth. Direct.",
  technical: "Precise, copy-paste ready, no filler. Facts only.",
  neutral:   "Balanced, factual, no personality markers.",
};

function buildSystemPrompt(language?: string, category?: TaskCategory): string {
  const langName = LANG_NAMES[language ?? ""] ?? null;
  const langInstruction = langName
    ? `You MUST respond exclusively in ${langName}. Do not switch languages under any circumstances.`
    : "Respond in the same language as the user.";

  const voice = CATEGORY_VOICE[category ?? "unknown"] ?? "neutral";
  const voiceInstr = VOICE_INSTRUCTIONS[voice] ?? "";

  const base = `You are SIPA OS — an AI Coordinator for creative intelligence, built for neurodivergent minds (ADHD, dissociation, fast thinkers).

Layer: L08-Writer · Voice: ${voice}
${voiceInstr}

Principles:
- Be precise. Never invent facts. If unsure, say so.
- Be direct and concise — minds running at 200 km/h don't need filler.
- Hold context like a forensic record. Reference earlier turns when relevant.
- Help structure chaos: turn brain dumps into protocols, decisions, next actions.
- ${langInstruction}

You are a coordinator, not a therapist. Ground every answer in what the user said.`;

  // L06 Guard: inject Protocol 0 rules
  return injectProtocol0(base);
}

// ─── Gateway helper for L01 ───────────────────────────────────────────────────

async function gatewayCall(
  apiKey: string,
  _model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 100,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const json = await res.json() as any;
  return json.choices?.[0]?.message?.content ?? "";
}

// ─── RAG Retrieval (SIPA GCP gen-ai-rag-with-ingestion) ─────────────────────

const RAG_CATEGORIES = new Set(["braindump", "research", "writing", "unknown"]);
const RAG_TIMEOUT_MS = 3000;

interface RagResult {
  context: string;
  sources: string[];
}

async function ragRetrieve(
  retrievalUrl: string,
  query: string,
  numResults = 4
): Promise<RagResult | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), RAG_TIMEOUT_MS);

    // Google gen-ai-rag-with-ingestion: GET /amenities/search?query=...&top_k=N
    const url = new URL(`${retrievalUrl}/amenities/search`);
    url.searchParams.set("query", query.slice(0, 500));
    url.searchParams.set("top_k", String(numResults));

    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return null;

    const data = await res.json() as any;

    // Response: [{name, description, location, terminal, category, hour, content, embedding}]
    const results: { content?: string; name?: string; description?: string; category?: string }[] =
      Array.isArray(data) ? data : [];

    if (!results.length) return null;

    const context = results
      .map((r, i) => {
        const text = r.content ?? r.description ?? r.name ?? "";
        const label = r.name ? `[${i + 1}] ${r.name}` : `[${i + 1}]`;
        return `${label}: ${text}`.trim();
      })
      .filter(Boolean)
      .join("\n\n");

    const sources = results
      .map((r) => r.name ?? r.category ?? "")
      .filter(Boolean);

    return context ? { context, sources } : null;
  } catch {
    return null;
  }
}

function buildSystemPromptWithRag(
  language?: string,
  category?: TaskCategory,
  rag?: RagResult | null
): string {
  const base = buildSystemPrompt(language, category);
  if (!rag) return base;

  const ragBlock = `\n\n## SIPA Knowledge Base — Retrieved Context\nThe following excerpts from SIPA's knowledge base are relevant to this query. Use them as primary source before answering:\n\n${rag.context}${rag.sources.length ? `\n\nSources: ${rag.sources.join(", ")}` : ""}`;

  return base + ragBlock;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL             = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const DEEPSEEK_API_KEY         = process.env.DEEPSEEK_API_KEY!;
        const TOGETHER_API_KEY         = process.env.TOGETHER_API_KEY;
        const SAMBANOVA_API_KEY        = process.env.SAMBANOVA_API_KEY;
        const ALIBABA_MODEL_STUDIO_KEY_SG = process.env.ALIBABA_MODEL_STUDIO_KEY_SG;

        // ── Auth0 JWT verification ────────────────────────────────────────────
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        let claims: Record<string, unknown>;
        try {
          claims = await verifyAuth0JWT(token);
        } catch (err) {
          console.error("[Auth0] JWT verification failed:", err);
          return new Response("Unauthorized", { status: 401 });
        }

        // Auth0 sub = "auth0|<uuid>" or "google-oauth2|<id>" etc.
        const userId = claims.sub as string | undefined;
        if (!userId) {
          return new Response("Unauthorized: no sub", { status: 401 });
        }

        // ── Supabase client for DATA access only (no auth) ───────────────────
        // We use the service-level publishable key for data reads/writes.
        // RLS on Supabase must use user_id columns directly (not auth.uid()).
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const GROQ_API_KEY         = process.env.GROQ_API_KEY;
        const CEREBRAS_API_KEY     = process.env.CEREBRAS_API_KEY;
        const NIM_API_KEY          = process.env.NIM_API_KEY;
        const SILICONFLOW_API_KEY  = process.env.SILICONFLOW_API_KEY;
        const HF_TOKEN             = process.env.HF_TOKEN;

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
          thread_id?: string;
          language?: string;
          provider?: string;
          model?: string;
        };
        // Support both threadId and thread_id from Lovable frontend
        body.threadId = body.threadId ?? body.thread_id;
        if (!Array.isArray(body.messages) || !body.threadId) {
          return new Response("Invalid request", { status: 400 });
        }

        // Verify thread ownership (user_id column, not RLS)
        const { data: thread, error: threadErr } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", body.threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (threadErr || !thread) {
          return new Response("Thread not found", { status: 404 });
        }

        // Persist user message
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const { error: insErr } = await supabase.from("chat_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            role: "user",
            message: lastUser as unknown as object,
          });
          if (insErr) console.error("[L01] persist user msg failed:", insErr.message);
        }

        // Auto-title
        if (thread.title === "New chat" && lastUser) {
          const text = lastUser.parts
            ?.map((p) => (p.type === "text" ? p.text : ""))
            .join(" ").trim().slice(0, 60);
          if (text) {
            await supabase.from("chat_threads").update({ title: text }).eq("id", body.threadId);
          }
        }

        // ── L01: classify intent (non-blocking, 4s budget) ──────────────────
        const userText = lastUser?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join(" ").trim() ?? "";

        const classifyTimeout = new Promise<null>(r => setTimeout(() => r(null), 4000));
        const l01Result = await Promise.race([
          runL01Classify(userText, DEEPSEEK_API_KEY, gatewayCall),
          classifyTimeout,
        ]).catch(() => null);

        const category = l01Result?.category ?? "unknown";
        console.log(`[L01] category=${category} confidence=${l01Result?.confidence ?? 0}`);

        // ── L05: RAG retrieval (non-blocking, 3s budget) ──────────────────────
        const RETRIEVAL_URL = process.env.RETRIEVAL_URL ?? "";
        let ragResult: RagResult | null = null;

        if (RETRIEVAL_URL && userText && RAG_CATEGORIES.has(category)) {
          ragResult = await ragRetrieve(RETRIEVAL_URL, userText).catch(() => null);
          console.log(`[L05] RAG ${ragResult ? `hit (${ragResult.sources.length} sources)` : "miss/skip"}`);
        }

        // ── L08: build system prompt (Protocol 0 + RAG injected) ─────────────
        const systemPrompt = buildSystemPromptWithRag(body.language, category as TaskCategory, ragResult);

        // ── L09: resolve model (free open-source first, then paid) ───────────
        const freeEnv: Record<string, string | undefined> = {
          GROQ_API_KEY, CEREBRAS_API_KEY, NIM_API_KEY, SILICONFLOW_API_KEY, HF_TOKEN,
        };
        const model = (body.model ? resolveFreeModel(body.model, freeEnv) : null)
          ?? resolveModel(body.provider, {
            DEEPSEEK_API_KEY,
            TOGETHER_API_KEY,
            SAMBANOVA_API_KEY,
            ALIBABA_MODEL_STUDIO_KEY_SG,
          });

        const result = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            const assistant = messages[messages.length - 1];
            if (!assistant || assistant.role !== "assistant") return;

            // Persist assistant message
            const { error } = await supabase.from("chat_messages").insert({
              thread_id: body.threadId!,
              user_id: userId,
              role: "assistant",
              message: assistant as unknown as object,
            });
            if (error) console.error("[L09] persist assistant failed:", error.message);

            // bump updated_at
            await supabase.from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", body.threadId!);

            // ── L06: Guard check + audit log ─────────────────────────────────
            const outputText = assistant.parts
              ?.map((p: any) => (p.type === "text" ? p.text : ""))
              .join("") ?? "";

            const guardResult = await fullGuardAndAudit(
              SUPABASE_URL,
              SUPABASE_PUBLISHABLE_KEY,
              `L06·${body.threadId}`,
              userText,
              outputText
            );

            if (!guardResult.pass) {
              console.warn("[L06] Guard violations:", guardResult.violations);
            } else {
              console.log("[L06] Guard PASS");
            }
          },
        });
      },
    },
  },
});
