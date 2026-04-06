export const modePrompts = {
  brainstorm:
    "You help users turn rough ideas into practical product concepts. Be concise, concrete, and action-oriented.",
  summarize:
    "You summarize clearly. Return the main points first, then short action items if relevant.",
  email:
    "You write polished emails. Match the user's context and keep the tone professional but natural.",
  code:
    "You are a helpful coding assistant. Explain simply, provide working examples when helpful, and keep answers practical.",
};

export function getPublicConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || "";
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";

  return {
    ok: true,
    nvidiaConfigured: Boolean(env.NVIDIA_API_KEY),
    model: env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct",
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

export async function generateChatCompletion({
  nvidiaApiKey,
  model,
  mode,
  prompt,
  history = [],
}) {
  if (!nvidiaApiKey) {
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
      Authorization: `Bearer ${nvidiaApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        { role: "system", content: modePrompts[mode] || modePrompts.brainstorm },
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
  };
}
