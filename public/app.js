const promptInput = document.querySelector("#prompt");
const resultOutput = document.querySelector("#result");
const statusText = document.querySelector("#status");
const modelBadge = document.querySelector("#modelBadge");
const runButton = document.querySelector("#runButton");
const sampleButton = document.querySelector("#sampleButton");
const modeButtons = [...document.querySelectorAll(".mode-chip")];

let activeMode = "brainstorm";

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

setActiveMode("brainstorm");
checkHealth();

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveMode(button.dataset.mode || "brainstorm"));
});

sampleButton.addEventListener("click", () => {
  promptInput.value = samples[activeMode];
  promptInput.focus();
});

runButton.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    statusText.textContent = "Add a prompt first.";
    promptInput.focus();
    return;
  }

  runButton.disabled = true;
  runButton.textContent = "Working...";
  statusText.textContent = "Sending your prompt to the local server...";
  resultOutput.textContent = "Thinking...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: activeMode, prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    resultOutput.textContent = data.text;
    modelBadge.textContent = data.model || "Unknown model";
    statusText.textContent = "Response generated successfully.";
  } catch (error) {
    resultOutput.textContent = "No response.";
    statusText.textContent = error instanceof Error ? error.message : "Something went wrong.";
  } finally {
    runButton.disabled = false;
    runButton.textContent = "Generate";
  }
});

function setActiveMode(mode) {
  activeMode = mode;
  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }

  const placeholderMap = {
    brainstorm: "Describe an app, tool, or business idea you want help shaping.",
    summarize: "Paste an article, meeting notes, or any long text you want compressed.",
    email: "Explain who the email is for, what it should say, and what tone you want.",
    code: "Ask for code, debugging help, or an explanation of what you want to build.",
  };

  promptInput.placeholder = placeholderMap[mode];
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    modelBadge.textContent = data.model || "Unknown model";
    statusText.textContent = data.configured
      ? "Server is ready. Your NVIDIA API key is configured."
      : "Server is running, but NVIDIA_API_KEY is missing in .env.";
  } catch {
    statusText.textContent = "Server is not running yet. Start it with node server.mjs.";
  }
}
