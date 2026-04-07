import { generateChatCompletion, verifySupabaseUser } from "../lib/chat.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim() || "";

  const user = await verifySupabaseUser({
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  }).catch(() => null);

  if (!user) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const mode = String(request.body?.mode || "chat");
  const prompt = String(request.body?.prompt || "").trim();
  const history = Array.isArray(request.body?.history) ? request.body.history : [];

  if (!prompt) {
    response.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const completion = await generateChatCompletion({
      env: process.env,
      mode,
      prompt,
      history,
    });

    response.status(200).json(completion);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || "NVIDIA API request failed.",
      raw: error.payload || null,
    });
  }
}
