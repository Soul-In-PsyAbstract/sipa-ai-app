import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Free open-source model map: "provider/model-id" → { baseURL, apiKeyEnv }
const FREE_MODEL_MAP: Record<string, { baseURL: string; keyEnv: string; modelId: string }> = {
  "groq/llama-3.3-70b-versatile":        { baseURL: "https://api.groq.com/openai/v1",             keyEnv: "GROQ_API_KEY",       modelId: "llama-3.3-70b-versatile" },
  "groq/llama-3.1-8b-instant":           { baseURL: "https://api.groq.com/openai/v1",             keyEnv: "GROQ_API_KEY",       modelId: "llama-3.1-8b-instant" },
  "groq/qwen-qwq-32b":                   { baseURL: "https://api.groq.com/openai/v1",             keyEnv: "GROQ_API_KEY",       modelId: "qwen-qwq-32b" },
  "groq/gemma2-9b-it":                   { baseURL: "https://api.groq.com/openai/v1",             keyEnv: "GROQ_API_KEY",       modelId: "gemma2-9b-it" },
  "groq/mixtral-8x7b-32768":             { baseURL: "https://api.groq.com/openai/v1",             keyEnv: "GROQ_API_KEY",       modelId: "mixtral-8x7b-32768" },
  "cerebras/llama-3.3-70b":              { baseURL: "https://api.cerebras.ai/v1",                 keyEnv: "CEREBRAS_API_KEY",   modelId: "llama-3.3-70b" },
  "cerebras/llama3.1-8b":                { baseURL: "https://api.cerebras.ai/v1",                 keyEnv: "CEREBRAS_API_KEY",   modelId: "llama3.1-8b" },
  "nim/meta/llama-3.1-8b-instruct":      { baseURL: "https://integrate.api.nvidia.com/v1",        keyEnv: "NIM_API_KEY",        modelId: "meta/llama-3.1-8b-instruct" },
  "nim/nvidia/nemotron-mini-4b-instruct":{ baseURL: "https://integrate.api.nvidia.com/v1",        keyEnv: "NIM_API_KEY",        modelId: "nvidia/nemotron-mini-4b-instruct" },
  "sf/Qwen/Qwen2.5-7B-Instruct":        { baseURL: "https://api.siliconflow.cn/v1",              keyEnv: "SILICONFLOW_API_KEY",modelId: "Qwen/Qwen2.5-7B-Instruct" },
  "sf/deepseek-ai/DeepSeek-V2.5":       { baseURL: "https://api.siliconflow.cn/v1",              keyEnv: "SILICONFLOW_API_KEY",modelId: "deepseek-ai/DeepSeek-V2.5" },
  "hf/mistralai/Mistral-7B-Instruct-v0.3":{ baseURL: "https://router.huggingface.co/hf-inference/v1", keyEnv: "HF_TOKEN",      modelId: "mistralai/Mistral-7B-Instruct-v0.3" },
  "hf/Qwen/Qwen2.5-72B-Instruct":       { baseURL: "https://router.huggingface.co/hf-inference/v1", keyEnv: "HF_TOKEN",        modelId: "Qwen/Qwen2.5-72B-Instruct" },
};

export function resolveFreeModel(
  modelKey: string,
  env: Record<string, string | undefined>
) {
  const cfg = FREE_MODEL_MAP[modelKey];
  if (!cfg) return null;
  const apiKey = env[cfg.keyEnv];
  if (!apiKey) return null;
  const provider = createOpenAICompatible({ name: cfg.keyEnv, baseURL: cfg.baseURL, headers: { Authorization: `Bearer ${apiKey}` } });
  return provider(cfg.modelId);
}

export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
}

export function createTogetherProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "together",
    baseURL: "https://api.together.xyz/v1",
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
}

export function createSambaNovaProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "sambanova",
    baseURL: "https://api.sambanova.ai/v1",
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
}

export function createAlibabaProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "alibaba",
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
}

// Provider + model from "provider:model-id" string, defaults to deepseek
export type ProviderName = "deepseek" | "together" | "sambanova" | "alibaba";

export const PROVIDER_DEFAULTS: Record<ProviderName, string> = {
  deepseek:  "deepseek-chat",
  together:  "meta-llama/Llama-3.1-70B-Instruct-Turbo",
  sambanova: "Meta-Llama-3.1-405B-Instruct",
  alibaba:   "qwen-max-latest",
};

export function resolveModel(
  providerStr: string | undefined,
  env: {
    DEEPSEEK_API_KEY: string;
    TOGETHER_API_KEY?: string;
    SAMBANOVA_API_KEY?: string;
    ALIBABA_MODEL_STUDIO_KEY_SG?: string;
  }
) {
  const [providerName, ...modelParts] = (providerStr ?? "deepseek").split(":");
  const modelId = modelParts.join(":") || PROVIDER_DEFAULTS[providerName as ProviderName] || "deepseek-chat";

  switch (providerName as ProviderName) {
    case "together":
      if (!env.TOGETHER_API_KEY) throw new Error("TOGETHER_API_KEY not configured");
      return createTogetherProvider(env.TOGETHER_API_KEY)(modelId);
    case "sambanova":
      if (!env.SAMBANOVA_API_KEY) throw new Error("SAMBANOVA_API_KEY not configured");
      return createSambaNovaProvider(env.SAMBANOVA_API_KEY)(modelId);
    case "alibaba":
      if (!env.ALIBABA_MODEL_STUDIO_KEY_SG) throw new Error("ALIBABA_MODEL_STUDIO_KEY_SG not configured");
      return createAlibabaProvider(env.ALIBABA_MODEL_STUDIO_KEY_SG)(modelId);
    default:
      return createDeepSeekProvider(env.DEEPSEEK_API_KEY)(modelId);
  }
}
