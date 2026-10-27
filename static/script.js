const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
const aiOn = document.body.dataset.ai === "on";
const form = document.getElementById("mentorForm");
const submitBtn = document.getElementById("submitBtn");
const result = document.getElementById("result");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
}
function makeList(items) {
  return '<ul>' + items.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}
function codeBlock(code) {
  return '<div class="code-wrap"><button type="button" class="copy-btn" aria-label="Copy code">Copy</button><pre>' + escapeHtml(code) + '</pre></div>';
}
/* Chat text -> safe HTML: everything is escaped first, then only code fences, `code`, **bold** and line breaks are added. */
function formatReply(text) {
  return String(text).split("```").map((part, i) => {
    if (i % 2 === 1) return codeBlock(part.replace(/^[a-zA-Z0-9_+-]*\n/, "").trim());
    return escapeHtml(part.trim())
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .split(/\n{2,}/).filter(p => p.trim()).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
  }).join('');
}
function upgradeCard(message) {
  return '<div class="result-content upgrade-card"><h4>You have used today\'s free AI requests</h4><p>' + escapeHtml(message) +
    '</p><a class="btn primary" href="#premium">See Premium <span>→</span></a><p class="muted-small">Offline syntax checks and Python practice are still free. Your free requests reset tomorrow.</p></div>';
}
function loginCard(message) {
  return '<div class="result-content upgrade-card"><h4>Log in to use the AI Mentor</h4><p>' + escapeHtml(message) +
    '</p><a class="btn primary" href="/login">Log in <span>→</span></a> <a class="btn ghost" href="/signup">Create free account</a></div>';
}

document.addEventListener("click", event => {
  const btn = event.target.closest(".copy-btn");
  if (!btn) return;
  const pre = btn.parentElement.querySelector("pre");
  navigator.clipboard?.writeText(pre ? pre.textContent : "").then(() => {
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy"; }, 1400);
  }).catch(() => { btn.textContent = "Press Ctrl+C"; });
});

/* ---------- Browser-based Python runner ---------- */
const codeEditor = document.getElementById("code");
const lineNums = document.getElementById("lineNums");
let pyodidePromise = null;

function syncLineNumbers() {
  if (!codeEditor || !lineNums) return;
  const count = Math.max(50, codeEditor.value.split("\n").length);
  lineNums.innerHTML = Array.from({length: count}, (_, i) => String(i + 1)).join("<br>");
  lineNums.scrollTop = codeEditor.scrollTop;
}
function showRunResult(kind, title, text) {
  if (!result) return;
  result.innerHTML = '<div class="run-result ' + kind + '"><div class="run-result-head"><strong>' +
    escapeHtml(title) + '</strong><span>' + (kind === "run-error" ? "ERROR" : kind === "run-success" ? "SUCCESS" : "RUNNING") +
    '</span></div><pre></pre></div>';
  result.querySelector("pre").textContent = text || (kind === "run-success" ? "Program finished with no output." : "");
}
async function getPyodide() {
  if (!window.loadPyodide) throw new Error("Python runtime could not load. Check your internet connection and refresh the page.");
  if (!pyodidePromise) {
    showRunResult("run-loading", "Preparing Python", "Loading the browser-based Python runtime for the first run…");
    pyodidePromise = window.loadPyodide();
  }
  return pyodidePromise;
}
if (codeEditor) {
  codeEditor.addEventListener("input", syncLineNumbers);
  codeEditor.addEventListener("scroll", () => { if (lineNums) lineNums.scrollTop = codeEditor.scrollTop; });
  syncLineNumbers();
}
if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const code = codeEditor.value;
    if (!code.trim()) {
      codeEditor.focus();
      showRunResult("run-error", "Nothing to run", "Paste or type Python code in the editor first.");
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Running… <span>◌</span>';
    showRunResult("run-loading", "Running Python", "Your code is running in this browser tab. The first run may take a few seconds.");
    let stdout = "", stderr = "";
    try {
      const pyodide = await getPyodide();
      pyodide.setStdout({batched: text => { stdout += text + "\n"; }});
      pyodide.setStderr({batched: text => { stderr += text + "\n"; }});
      await pyodide.runPythonAsync(code);
      if (stderr.trim()) {
        showRunResult("run-error", "Program finished with errors", (stdout ? "OUTPUT:\n" + stdout : "") + "ERROR:\n" + stderr);
      } else {
        showRunResult("run-success", "Run completed", stdout.trimEnd());
      }
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      const combined = (stdout ? "OUTPUT:\n" + stdout + "\n" : "") + message;
      showRunResult("run-error", "Python error", combined);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Run <span>▶</span>';
    }
  });
}
/* ---------- Follow-up chat (history lives only in this page) ---------- */
function addBubble(role, html) {
  const div = document.createElement("div");
  div.className = "bubble " + role;
  div.innerHTML = html;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}
async function sendChat(message) {
  if (!message.trim() || !lastCode) return;
  chatInput.value = ""; chatSend.disabled = true; chatInput.disabled = true;
  addBubble("user", '<p>' + escapeHtml(message) + '</p>');
  const thinking = addBubble("assistant", '<p class="thinking">Thinking…</p>');
  try {
    const response = await fetch("/api/mentor/chat", {
      method: "POST", credentials: "same-origin",
      headers: {"Content-Type": "application/json", "X-CSRF-Token": csrfToken},
      body: JSON.stringify({code: lastCode, mode: lastMode, history: chatHistory, message})
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429 && data.limit_reached) { thinking.innerHTML = upgradeCard(data.error || "Free limit reached."); return; }
    if (response.status === 401 && data.login_required) { thinking.innerHTML = loginCard(data.error || "Please log in."); return; }
    if (!response.ok) throw new Error(data.error || "Could not get an answer.");
    thinking.innerHTML = formatReply(data.reply);
    chatHistory.push({role: "user", content: message}, {role: "assistant", content: data.reply});
    chatHistory = chatHistory.slice(-10);
    chatNote.innerHTML = remainingNote(data.premium ? null : data.remaining_today);
  } catch (error) {
    thinking.innerHTML = '<p class="chat-error">' + escapeHtml(error.message) + '</p>';
  } finally {
    chatSend.disabled = false; chatInput.disabled = false; chatInput.focus();
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}
if (chatForm) {
  chatForm.addEventListener("submit", event => { event.preventDefault(); sendChat(chatInput.value); });
  document.getElementById("chatChips").addEventListener("click", event => {
    const chip = event.target.closest("button[data-q]");
    if (chip) sendChat(chip.dataset.q);
  });
}

const practiceData = {
  output: {
    prompt: "What does this code display?",
    code: "number = 2 + 3\nprint(number)",
    hint: "Work out the arithmetic on the right side of = before print() runs.",
    answers: ["5"],
    correct: "It displays 5. Python calculates 2 + 3, stores 5 in number, then print() displays it.",
  },
  input: {
    prompt: "Which function converts the text \"18\" into an integer?",
    code: 'age_text = "18"\nage = int(age_text)',
    hint: "Look for the built-in type-conversion function used around age_text.",
    answers: ["int", "int()", "int(age_text)"],
    correct: "int() converts a value to an integer, so int(\"18\") becomes 18.",
  },
  index: {
    prompt: "What expression gets the last item from a list named fruits?",
    code: 'fruits = ["apple", "mango", "grape"]',
    hint: "Python supports negative indexes; -1 refers to the last item.",
    answers: ["fruits[-1]", "[-1]", "fruits[-1]"],
    correct: "fruits[-1] returns the last item, which is grape in this example.",
  },
  loop: {
    prompt: "How many times does this loop print a number?",
    code: "for number in range(4):\n    print(number)",
    hint: "range(4) produces four values: 0, 1, 2, and 3.",
    answers: ["4", "four", "4 times", "4 times."],
    correct: "It prints 4 times, once for each value in range(4): 0, 1, 2, and 3.",
  },
};
const challengeSelect = document.getElementById("practiceChallenge");
const practicePrompt = document.getElementById("practicePrompt");
const practiceCode = document.getElementById("practiceCode");
const practiceHint = document.getElementById("practiceHint");
const practiceAnswer = document.getElementById("practiceAnswer");
const practiceFeedback = document.getElementById("practiceFeedback");
function loadPracticeChallenge() {
  if (!challengeSelect) return;
  const challenge = practiceData[challengeSelect.value];
  practicePrompt.textContent = challenge.prompt;
  practiceCode.textContent = challenge.code;
  practiceHint.textContent = "Hint: " + challenge.hint;
  practiceHint.hidden = true;
  practiceAnswer.value = "";
  practiceFeedback.textContent = "Try it, then check your answer.";
  practiceFeedback.className = "practice-feedback";
}
if (challengeSelect) {
  challengeSelect.addEventListener("change", loadPracticeChallenge);
  document.getElementById("practiceHintBtn").addEventListener("click", () => {
    practiceHint.hidden = !practiceHint.hidden;
  });
  document.getElementById("practiceCheckBtn").addEventListener("click", () => {
    const challenge = practiceData[challengeSelect.value];
    const answer = practiceAnswer.value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!answer) {
      practiceFeedback.textContent = "Type an answer first, then check it.";
      practiceFeedback.className = "practice-feedback";
      practiceAnswer.focus();
      return;
    }
    const accepted = challenge.answers.some(item => answer === item.toLowerCase());
    practiceFeedback.textContent = (accepted ? "Correct! " : "Not quite. ") + challenge.correct;
    practiceFeedback.className = "practice-feedback " + (accepted ? "is-correct" : "is-try-again");
  });
  document.getElementById("practiceNextBtn").addEventListener("click", () => {
    const values = Object.keys(practiceData);
    const current = values.indexOf(challengeSelect.value);
    challengeSelect.value = values[(current + 1) % values.length];
    loadPracticeChallenge();
  });
  loadPracticeChallenge();
}

/* Premium status and Razorpay checkout */
(async function setupPremiumCheckout() {
  const buyButton = document.getElementById("premiumBuyBtn");
  const statusText = document.getElementById("premiumStatus");
  const message = document.getElementById("premiumMessage");
  if (!buyButton) return;

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
  const say = (text, isError = false) => {
    if (message) {
      message.textContent = text;
      message.className = "premium-message" + (isError ? " is-error" : "");
    }
  };

  async function refreshStatus() {
    try {
      const response = await fetch("/premium/status", { credentials: "same-origin" });
      if (!response.ok) throw new Error("Could not load plan status.");
      const data = await response.json();
      statusText.textContent = data.premium
        ? "Premium active — your AI Mentor plan is ready."
        : `Free plan: ${data.used_today}/${data.daily_limit} AI requests used today.`;
      if (data.premium) buyButton.textContent = "Premium active";
      buyButton.disabled = Boolean(data.premium);
    } catch (_error) {
      statusText.textContent = "Plan status is temporarily unavailable.";
    }
  }

  await refreshStatus();

  buyButton.addEventListener("click", async () => {
    buyButton.disabled = true;
    say("Starting secure checkout…");
    try {
      const response = await fetch("/premium/create-order", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: "{}"
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Could not create a payment order.");
      if (typeof window.Razorpay !== "function") throw new Error("Razorpay checkout could not load. Please disable blockers or try again.");

      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.order_id,
        handler: async function (result) {
          say("Payment received. Verifying securely…");
          try {
            const verifyResponse = await fetch("/premium/verify", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
              body: JSON.stringify(result)
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok || !verified.ok) throw new Error(verified.error || "Payment verification failed.");
            say("Payment verified. Premium is active!");
            await refreshStatus();
          } catch (error) {
            say(error.message + " If money was deducted, keep your Razorpay payment ID and contact support.", true);
          } finally {
            buyButton.disabled = false;
          }
        },
        modal: { ondismiss: () => { say("Checkout closed. No plan was activated."); buyButton.disabled = false; } },
        theme: { color: "#8e6dff" }
      });
      checkout.on("payment.failed", event => {
        say(event.error?.description || "Payment failed. Please try again.", true);
        buyButton.disabled = false;
      });
      checkout.open();
    } catch (error) {
      say(error.message || "Checkout failed. Please try again.", true);
      buyButton.disabled = false;
    }
  });
})();