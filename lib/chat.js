const CHAT_MODEL = "mistralai/mistral-large-3-675b-instruct-2512";
const CODE_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";
const RESEARCH_MODEL = "qwen/qwq-32b";

export const modePrompts = {
  chat:
    "You are a strong daily-use assistant. Be clear, practical, conversational, and helpful for normal questions, summaries, and writing tasks.",
  code:
    "You are a high-quality coding assistant. Provide correct code, explain clearly, and help with debugging, refactoring, and implementation details.",
  research:
    "You are a deep research assistant. Reason carefully, compare options, surface tradeoffs, and produce strong structured answers for harder questions.",
};

export function getPublicConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || "";
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";

  return {
    ok: true,
    nvidiaConfigured: Boolean(env.NVIDIA_API_KEY),
    model: resolveModeConfig("chat", env).model,
    providers: {
      chat: resolveModeConfig("chat", env),
      code: resolveModeConfig("code", env),
      research: resolveModeConfig("research", env),
    },
    supabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
    supabaseUrl,
    supabaseAnonKey: supabasePublishableKey,
    supabasePublishableKey,
  };
}

export async function verifySupabaseUser({ accessToken, supabaseUrl, supabaseAnonKey }) {
  if (!accessToken) {
    throw new Error("Missing access token.");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function generateChatCompletion({ env = process.env, mode, prompt, history = [] }) {
  const config = resolveModeConfig(mode, env);

  return generateNvidiaCompletion({
    apiKey: env.NVIDIA_API_KEY || "",
    model: config.model,
    mode,
    prompt,
    history,
  });
}

export function resolveModeConfig(mode, env = process.env) {
  const normalizedMode = String(mode || "chat").toLowerCase();

  if (normalizedMode === "code") {
    return {
      provider: "nvidia",
      model: env.CODE_MODEL || CODE_MODEL,
    };
  }

  if (normalizedMode === "research") {
    return {
      provider: "nvidia",
      model: env.RESEARCH_MODEL || RESEARCH_MODEL,
    };
  }

  return {
    provider: "nvidia",
    model: env.CHAT_MODEL || env.NVIDIA_MODEL || CHAT_MODEL,
  };
}

async function generateNvidiaCompletion({ apiKey, model, mode, prompt, history = [] }) {
  if (!apiKey) {
    throw new Error("Missing NVIDIA API key.");
  }

  const normalizedHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && typeof entry.content === "string")
        .map((entry) => ({
          role: entry.role === "assistant" ? "assistant" : "user",
          content: entry.content,
        }))
    : [];

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        { role: "system", content: modePrompts[mode] || modePrompts.chat },
        ...normalizedHistory,
        { role: "user", content: prompt },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.detail ||
      payload?.message ||
      "NVIDIA API request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    text: payload?.choices?.[0]?.message?.content || "No response received.",
    model,
    provider: "nvidia",
  };
}
