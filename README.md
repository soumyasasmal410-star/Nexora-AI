# Nexora AI

**Build smarter. Learn faster.**

Nexora AI is a standalone AI-powered tools platform for students, developers, and creators. This first MVP focuses on a Python Code Mentor.

## Current MVP
- Responsive dark/neon landing page and tool dashboard.
- Python syntax validation and beginner-friendly guidance.
- Modes for hints, debugging, code explanation, and improvement suggestions.
- Free offline mode by default, with AST-based syntax checks, common-pattern diagnostics, worked examples, and a local Python practice quiz.
- Claude-powered AI Mentor (Anthropic API): structured reviews, suggested fixes, Hindi/Hinglish replies and a follow-up chat. Off unless explicitly enabled.
- Free users get the fast model; Premium gets the most capable model and unlimited requests.
- Local guidance never executes submitted code.
- Practice answers are checked locally against small fixed exercises; they do not execute user-provided code.
- Does not execute submitted code.
- Health endpoint at `/health`.

When the AI Mentor is enabled, submitted code, the optional question and (for follow-ups) the chat messages are sent to Anthropic's Claude API for that request. This app does not save submitted code or chat history to an account or database; the chat lives only in the browser tab. Review your provider settings and privacy needs before sharing sensitive code. Without an API key, the mentor uses local syntax checks and rule-based hints.

## Run locally
```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Visit http://127.0.0.1:5000

## Deploy to Render
Create a **new Web Service** from this repository, not the existing My Portfolio repository. Render can use `render.yaml`; otherwise set:
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Health check path: `/health`

For the default free/offline mode, no API key or paid API credits are needed. To switch on the Claude AI Mentor, add these environment variables in Render (never commit secrets):
- ENABLE_AI_MENTOR: set to true to enable model calls; default is false.
- ANTHROPIC_API_KEY: your key from console.anthropic.com.
- ANTHROPIC_MODEL_FREE / ANTHROPIC_MODEL_PREMIUM: optional model overrides (defaults: claude-haiku-5-5 and claude-sonnet-5-5).

The Anthropic API is billed separately from any claude.ai subscription and incurs usage charges. Set API spending limits/alerts in your provider dashboard and monitor usage before making the service public.

## Planned roadmap
1. Add a persistent rate limiter and usage visibility before public launch.
2. Test AI responses, failure fallback, and provider spend limits.
3. Add accounts and saved projects only after privacy/security decisions.
4. Integrate payment checkout after the core experience has real users.
5. Expand to resume tools, a safe code workspace, and study/productivity tools.

## Security notes
Never put provider API keys in frontend JavaScript or commit secrets. This app deliberately does not use `eval` or execute submitted Python. Keep input limits and add a persistent rate limiter before a public launch.

## Secure login and signup

The app includes password-based signup/login, a protected dashboard, CSRF checks on authentication forms, password hashing, secure session-cookie settings on Render, and basic per-IP rate limits for login/signup. Email verification and password reset are not implemented yet.

### Render production setup (required before relying on accounts)

1. In the Render dashboard, create a PostgreSQL database for this project. Check the current plan, price, and expiry/retention policy before choosing a plan.
2. Open the database page and copy its **Internal Database URL**. Do not publish it or commit it to GitHub.
3. Open the Nexora AI web service → **Environment** and add:
   - `DATABASE_URL`: the PostgreSQL Internal Database URL from Render.
   - `SECRET_KEY`: a strong random secret (for example, generate one locally with `python -c "import secrets; print(secrets.token_hex(32))"`). Never share it or commit it.
4. Save changes and wait for the service to deploy/restart. The app creates the user table automatically if it does not exist.
5. Visit `/signup`, create a test account with a unique email and a strong password, then confirm the dashboard opens. Log out and test `/login` and protected `/dashboard`.
6. Check that the app still loads at `/`, the Code Mentor works, and the Python Practice section works.

**Important:** If `DATABASE_URL` is absent, the app uses local SQLite as a development fallback. On a typical Render web service filesystem, that file is not a reliable persistent production database. Do not use fallback SQLite for real customer accounts. Set `DATABASE_URL` to Render PostgreSQL before inviting users. Keep the database URL and `SECRET_KEY` private.

Passwords are stored as Werkzeug scrypt hashes, never as plaintext. Signup requires 12–128 characters. Login/signup are rate-limited in-process; for a high-traffic public launch, move rate limiting to shared persistent storage (such as Redis) and add email verification, password reset, monitoring, and a database migration workflow.

## Premium AI Mentor and Razorpay

The optional Premium plan costs ₹199 for 30 days and removes the 10-request daily AI Mentor limit for an authenticated account. Offline syntax checks and Python Practice Mode remain free.

### Required Render environment variables

Set these in the Nexora AI web service's Environment settings (do not commit them to GitHub):

- `RAZORPAY_KEY_ID`: Razorpay API key ID.
- `RAZORPAY_KEY_SECRET`: Razorpay API key secret; server-side only.
- `RAZORPAY_WEBHOOK_SECRET`: a separate secret configured for the Razorpay webhook.
- `ENABLE_AI_MENTOR=true` and `ANTHROPIC_API_KEY`: required for AI-powered requests; otherwise the app stays in offline mode.

After deployment, configure a Razorpay webhook to:
`https://nexora-ai-tzgc.onrender.com/razorpay/webhook`
Subscribe to the `payment.captured` event and use the same webhook secret in Render. Test with Razorpay Test Mode first. Do not accept real payments until checkout, signature verification, webhook retries, database persistence, and refunds/support procedures have been tested.

The app verifies checkout signatures server-side and checks that the payment is captured before activating a plan. The daily limit is per authenticated user and uses the server's calendar date. Premium features require a working persistent PostgreSQL database; do not rely on ephemeral SQLite storage in production.


## What changed in this version
- **Claude behind the mentor** (`claude_mentor.py`): grounded in the offline parser, structured replies, prompt-injection hygiene, free/premium model routing.
- **Follow-up chat** (`/api/mentor/chat`): ask "explain line by line", "give me a practice problem", etc. History stays in the browser.
- **Fair usage**: if the AI service fails, the learner's free request is refunded automatically.
- **Better premium story**: honest Free vs Premium comparison, clear "pay once for 30 days, no auto-renewal", upgrade card when the daily limit is reached, and a dashboard with plan status and usage.
- **Stronger CSRF**: mentor, chat, resume, theme and community POST routes now require the CSRF token.
- **Legal pages**: `/terms`, `/privacy`, `/refund` are templates. Fill in the [brackets] and have them reviewed before taking real payments.
- If you mention that the mentor is powered by Claude, follow Anthropic's brand guidelines and do not imply endorsement or affiliation.
