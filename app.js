import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const authView = document.querySelector("#authView");
const chatView = document.querySelector("#chatView");
const authNotice = document.querySelector("#authNotice");
const chatSidebar = document.querySelector("#chatSidebar");
const authForm = document.querySelector("#authForm");
const signUpTab = document.querySelector("#signUpTab");
const signInTab = document.querySelector("#signInTab");
const authHeading = document.querySelector("#authHeading");
const authSubmit = document.querySelector("#authSubmit");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const userEmail = document.querySelector("#userEmail");
const chatTitle = document.querySelector("#chatTitle");
const chatList = document.querySelector("#chatList");
const newChatButton = document.querySelector("#newChatButton");
const logoutButton = document.querySelector("#logoutButton");
const promptInput = document.querySelector("#prompt");
const messageList = document.querySelector("#messageList");
const statusText = document.querySelector("#status");
const statusPill = document.querySelector("#statusPill");
const modelBadge = document.querySelector("#modelBadge");
const sampleButton = document.querySelector("#sampleButton");
const copyButton = document.querySelector("#copyButton");
const charCount = document.querySelector("#charCount");
const modeDescription = document.querySelector("#modeDescription");
const composerForm = document.querySelector("#composerForm");
const runButton = document.querySelector("#runButton");
const modeButtons = [...document.querySelectorAll(".mode-chip")];

const samples = {
  brainstorm:
    "I want to build an AI tool for small restaurants that reads customer reviews, groups complaints by theme, and suggests simple menu or service improvements. Give me a product concept, target users, MVP features, and a 7-day launch plan.",
  summarize:
    "Summarize this text into five bullets and a short takeaway:\n\nNVIDIA APIs let developers prototype with hosted models for chat, retrieval, vision, and multimodal workflows. A small team can use one API key to test ideas quickly before committing to heavier infrastructure. The main tradeoff is that prototyping access is not the same as a production deployment plan, so teams should validate licensing, quotas, and costs before launch.",
  email:
    "Write a polite email to a client explaining that our AI prototype is ready for demo this Friday, and we would like 30 minutes to walk them through the main features.",
  code:
    "Create a simple Express route that accepts a POST body with { name } and returns { message: `Hello, ${name}` }. Also explain it line by line.",
};

const modeMeta = {
  brainstorm: {
    description: "Turn a rough idea into an MVP concept, target users, and action plan.",
    placeholder: "Describe a product idea, business workflow, or tool you want to build.",
  },
  summarize: {
    description: "Paste long content and compress it into a short, useful summary.",
    placeholder: "Paste notes, an article, or a long explanation you want summarized.",
  },
  email: {
    description: "Draft a clearer message with context, tone, and your goal built in.",
    placeholder: "Explain who the email is for, what it should say, and the tone you want.",
  },
  code: {
    description: "Ask for code, debugging help, or an implementation walkthrough.",
    placeholder: "Describe the code you want, the bug you hit, or the feature you need help with.",
  },
};

const state = {
  activeMode: "brainstorm",
  authMode: "signUp",
  config: null,
  supabase: null,
  session: null,
  user: null,
  chats: [],
  activeChatId: null,
  messages: [],
  isSending: false,
};

setActiveMode("brainstorm");
setAuthMode("signUp");
updateCharacterCount();
bindEvents();
initializeApp();

function bindEvents() {
  signUpTab.addEventListener("click", () => setAuthMode("signUp"));
  signInTab.addEventListener("click", () => setAuthMode("signIn"));
  authForm.addEventListener("submit", handleAuthSubmit);
  logoutButton.addEventListener("click", handleLogout);
  newChatButton.addEventListener("click", startNewChat);
  sampleButton.addEventListener("click", () => {
    promptInput.value = samples[state.activeMode];
    updateCharacterCount();
    promptInput.focus();
  });
  copyButton.addEventListener("click", copyLastAssistantMessage);
  promptInput.addEventListener("input", updateCharacterCount);
  composerForm.addEventListener("submit", handleSendMessage);

  for (const button of modeButtons) {
    button.addEventListener("click", () => setActiveMode(button.dataset.mode || "brainstorm"));
  }

  chatList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-chat-id]");
    if (!button) {
      return;
    }

    const chatId = button.dataset.chatId;
    if (!chatId || chatId === state.activeChatId) {
      return;
    }

    await openChat(chatId);
  });
}

async function initializeApp() {
  try {
    const response = await fetch("/api/health");
    const config = await response.json();

    state.config = config;
    modelBadge.textContent = config.model || "Unknown model";
    applyHealthStatus(config);

    if (!config.supabaseConfigured || !config.supabaseUrl || !config.supabaseAnonKey) {
      statusText.textContent =
        "Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY first.";
      disableAuthAndChat();
      return;
    }

    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

    const {
      data: { session },
    } = await state.supabase.auth.getSession();

    await applySession(session);

    state.supabase.auth.onAuthStateChange(async (_event, sessionUpdate) => {
      await applySession(sessionUpdate);
    });
  } catch (error) {
    statusText.textContent =
      error instanceof Error ? error.message : "Failed to load the application configuration.";
    disableAuthAndChat();
  }
}

function disableAuthAndChat() {
  authSubmit.disabled = true;
  runButton.disabled = true;
  sampleButton.disabled = true;
  newChatButton.disabled = true;
}

async function applySession(session) {
  state.session = session || null;
  state.user = session?.user || null;

  if (!state.user) {
    authView.classList.remove("hidden");
    chatView.classList.add("hidden");
    authNotice.classList.remove("hidden");
    chatSidebar.classList.add("hidden");
    logoutButton.classList.add("hidden");
    userEmail.textContent = "Not signed in";
    state.chats = [];
    state.activeChatId = null;
    state.messages = [];
    renderChatList();
    renderMessages();
    chatTitle.textContent = "New chat";
    statusText.textContent = state.config?.supabaseConfigured
      ? "Create an account or log in to save chats."
      : statusText.textContent;
    return;
  }

  authView.classList.add("hidden");
  chatView.classList.remove("hidden");
  authNotice.classList.add("hidden");
  chatSidebar.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  userEmail.textContent = state.user.email || "Signed in";
  statusText.textContent = "Signed in. Your chats are stored in Supabase.";

  await loadChats();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isSignUp = mode === "signUp";

  signUpTab.classList.toggle("active", isSignUp);
  signInTab.classList.toggle("active", !isSignUp);
  authHeading.textContent = isSignUp ? "Create your account" : "Log in to your account";
  authSubmit.textContent = isSignUp ? "Create account" : "Log in";
  passwordInput.autocomplete = isSignUp ? "new-password" : "current-password";
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!state.supabase) {
    statusText.textContent = "Supabase is not configured yet.";
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    statusText.textContent = "Email and password are required.";
    return;
  }

  authSubmit.disabled = true;
  authSubmit.textContent = state.authMode === "signUp" ? "Creating..." : "Logging in...";

  try {
    if (state.authMode === "signUp") {
      const { data, error } = await state.supabase.auth.signUp({ email, password });
      if (error) {
        throw error;
      }

      if (!data.session) {
        statusText.textContent =
          "Account created. Check your email if confirmation is enabled, then log in.";
        setAuthMode("signIn");
      } else {
        statusText.textContent = "Account created and signed in.";
      }
    } else {
      const { error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      statusText.textContent = "Logged in successfully.";
    }

    authForm.reset();
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "Authentication failed.";
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = state.authMode === "signUp" ? "Create account" : "Log in";
  }
}

async function handleLogout() {
  if (!state.supabase) {
    return;
  }

  const { error } = await state.supabase.auth.signOut();
  statusText.textContent = error ? error.message : "Logged out.";
}

function setActiveMode(mode) {
  state.activeMode = mode;
  const meta = modeMeta[mode] || modeMeta.brainstorm;

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }

  modeDescription.textContent = meta.description;
  promptInput.placeholder = meta.placeholder;
}

function updateCharacterCount() {
  const count = promptInput.value.length;
  charCount.textContent = `${count} character${count === 1 ? "" : "s"}`;
}

function applyHealthStatus(config) {
  if (config.nvidiaConfigured && config.supabaseConfigured) {
    statusPill.textContent = "Ready";
    statusPill.classList.add("ready");
    statusPill.classList.remove("warning");
    return;
  }

  statusPill.textContent = "Setup needed";
  statusPill.classList.add("warning");
  statusPill.classList.remove("ready");
}

async function loadChats() {
  if (!state.supabase || !state.user) {
    return;
  }

  const { data, error } = await state.supabase
    .from("chats")
    .select("id, title, created_at, updated_at")
    .eq("user_id", state.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    statusText.textContent =
      "Could not load chats. Run the SQL setup in supabase/schema.sql first.";
    return;
  }

  state.chats = data || [];
  renderChatList();

  if (!state.activeChatId && state.chats.length > 0) {
    await openChat(state.chats[0].id);
    return;
  }

  if (state.activeChatId && state.chats.some((chat) => chat.id === state.activeChatId)) {
    await loadMessages(state.activeChatId);
    return;
  }

  if (state.chats.length === 0) {
    startNewChat();
  }
}

function renderChatList() {
  if (!state.chats.length) {
    chatList.innerHTML = `<div class="sidebar-empty">No saved chats yet.</div>`;
    return;
  }

  chatList.innerHTML = state.chats
    .map((chat) => {
      const isActive = chat.id === state.activeChatId;
      return `
        <button class="chat-item ${isActive ? "active" : ""}" type="button" data-chat-id="${escapeHtml(chat.id)}">
          <span class="chat-item-title">${escapeHtml(chat.title || "Untitled chat")}</span>
          <span class="chat-time">${formatRelativeTime(chat.updated_at || chat.created_at)}</span>
        </button>
      `;
    })
    .join("");
}

function startNewChat() {
  if (!state.user) {
    statusText.textContent = "Sign in first to create a chat.";
    return;
  }

  state.activeChatId = null;
  state.messages = [];
  renderChatList();
  renderMessages();
  chatTitle.textContent = "New chat";
  promptInput.focus();
}

async function openChat(chatId) {
  state.activeChatId = chatId;
  renderChatList();
  await loadMessages(chatId);
}

async function loadMessages(chatId) {
  if (!state.supabase || !chatId) {
    state.messages = [];
    renderMessages();
    return;
  }

  const { data, error } = await state.supabase
    .from("messages")
    .select("id, role, content, mode, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    statusText.textContent = "Could not load messages for this chat.";
    return;
  }

  state.messages = data || [];
  const activeChat = state.chats.find((chat) => chat.id === chatId);
  chatTitle.textContent = activeChat?.title || "Chat";
  renderMessages();
}

function renderMessages(pendingAssistantText = "") {
  if (!state.messages.length && !pendingAssistantText) {
    messageList.innerHTML = `
      <div class="empty-thread">
        <h3>Start a new conversation</h3>
        <p>Ask something, then your messages and responses will be saved in your history.</p>
      </div>
    `;
    return;
  }

  const combinedMessages = [...state.messages];
  if (pendingAssistantText) {
    combinedMessages.push({
      id: "pending-assistant",
      role: "assistant",
      content: pendingAssistantText,
    });
  }

  messageList.innerHTML = combinedMessages
    .map((message) => renderMessageHtml(message))
    .join("");

  messageList.scrollTop = messageList.scrollHeight;
}

async function handleSendMessage(event) {
  event.preventDefault();

  if (!state.session || !state.user) {
    statusText.textContent = "Sign in first to send a message.";
    return;
  }

  if (!state.config?.nvidiaConfigured) {
    statusText.textContent = "NVIDIA_API_KEY is not configured on the server.";
    return;
  }

  const prompt = promptInput.value.trim();
  if (!prompt || state.isSending) {
    return;
  }

  state.isSending = true;
  runButton.disabled = true;
  runButton.textContent = "Sending...";

  const history = state.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const optimisticUserMessage = {
    id: `optimistic-user-${Date.now()}`,
    role: "user",
    content: prompt,
  };

  renderMessagesWithUserPrompt(optimisticUserMessage);
  promptInput.value = "";
  updateCharacterCount();

  try {
    let chatId = state.activeChatId;
    if (!chatId) {
      chatId = await createChat(prompt);
    }

    if (!chatId) {
      throw new Error("Could not create a chat.");
    }

    state.activeChatId = chatId;
    await insertMessage(chatId, "user", prompt, state.activeMode);
    renderMessages("Thinking...");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.session.access_token}`,
      },
      body: JSON.stringify({
        mode: state.activeMode,
        prompt,
        history,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Chat request failed.");
    }

    await insertMessage(chatId, "assistant", payload.text, state.activeMode);
    await touchChat(chatId);
    await refreshChatState(chatId);

    modelBadge.textContent = payload.model || state.config.model || "Unknown model";
    statusText.textContent = "Response saved to chat history.";
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "Could not send message.";
    await refreshChatState(state.activeChatId);
  } finally {
    state.isSending = false;
    runButton.disabled = false;
    runButton.textContent = "Send";
  }
}

function renderMessagesWithUserPrompt(promptMessage) {
  const previewMessages = [...state.messages, promptMessage];
  messageList.innerHTML = previewMessages.map((message) => renderMessageHtml(message)).join("");
  messageList.scrollTop = messageList.scrollHeight;
}

async function createChat(firstPrompt) {
  const title = makeChatTitle(firstPrompt);
  const { data, error } = await state.supabase
    .from("chats")
    .insert({
      user_id: state.user.id,
      title,
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) {
    statusText.textContent =
      "Could not create a chat. Make sure the Supabase SQL schema has been applied.";
    return null;
  }

  state.chats = [data, ...state.chats];
  state.activeChatId = data.id;
  chatTitle.textContent = data.title;
  renderChatList();
  return data.id;
}

async function insertMessage(chatId, role, content, mode) {
  const { error } = await state.supabase.from("messages").insert({
    chat_id: chatId,
    user_id: state.user.id,
    role,
    content,
    mode,
  });

  if (error) {
    throw error;
  }
}

async function touchChat(chatId) {
  const { error } = await state.supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", state.user.id);

  if (error) {
    throw error;
  }
}

async function refreshChatState(chatId) {
  await loadChats();

  if (chatId) {
    await openChat(chatId);
  } else {
    renderMessages();
  }
}

async function copyLastAssistantMessage() {
  const lastAssistant = [...state.messages].reverse().find((message) => message.role === "assistant");

  if (!lastAssistant?.content) {
    statusText.textContent = "There is no assistant response to copy yet.";
    return;
  }

  try {
    await navigator.clipboard.writeText(lastAssistant.content);
    statusText.textContent = "Last assistant response copied.";
  } catch {
    statusText.textContent = "Clipboard copy failed in this browser.";
  }
}

function renderMessageHtml(message) {
  const isAssistant = message.role === "assistant";
  return `
    <article class="message-row">
      <div class="message-avatar ${isAssistant ? "assistant" : ""}">${isAssistant ? "AI" : "You"}</div>
      <div class="message-card">
        <p class="chat-role">${isAssistant ? "Assistant" : "You"}</p>
        <div class="message-bubble ${isAssistant ? "assistant" : ""}">${escapeHtml(message.content || "")}</div>
      </div>
    </article>
  `;
}

function makeChatTitle(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 60) || "New chat";
}

function formatRelativeTime(value) {
  if (!value) {
    return "Just now";
  }

  const timestamp = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
