# Nexora AI

**Build smarter. Learn faster.**

Nexora AI is a standalone AI-powered tools platform for students, developers, and creators. This first MVP focuses on a Python Code Mentor.

## Current MVP
- Responsive dark/neon landing page and tool dashboard.
- Python syntax validation and beginner-friendly guidance.
- Modes for hints, debugging, code explanation, and improvement suggestions.
- Free offline mode by default, with AST-based syntax checks, common-pattern diagnostics, worked examples, and a local Python practice quiz.
- Optional server-side OpenAI Responses API integration, disabled unless explicitly enabled.
- Local guidance never executes submitted code.
- Practice answers are checked locally against small fixed exercises; they do not execute user-provided code.
- Does not execute submitted code.
- Health endpoint at `/health`.

When OPENAI_API_KEY is configured, submitted code and the optional question are sent to OpenAI for processing. This app does not save submitted code to an account or database. Review your provider settings and privacy needs before sharing sensitive code. Without the key, the mentor uses local syntax checks and rule-based hints.

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

For the default free/offline mode, no API key or paid API credits are needed. To opt into AI mode later, add these environment variables in Render (never commit secrets):
- ENABLE_AI_MENTOR: set to true to enable model calls; default is false.
- OPENAI_API_KEY: your OpenAI API key.
- OPENAI_MODEL: optional model override; defaults to gpt-5-mini.

The OpenAI API may incur usage charges. Set API spending limits/alerts in your provider dashboard and monitor usage before making the service public.

## Planned roadmap
1. Add a persistent rate limiter and usage visibility before public launch.
2. Test AI responses, failure fallback, and provider spend limits.
3. Add accounts and saved projects only after privacy/security decisions.
4. Integrate payment checkout after the core experience has real users.
5. Expand to resume tools, a safe code workspace, and study/productivity tools.

## Security notes
Never put provider API keys in frontend JavaScript or commit secrets. This app deliberately does not use `eval` or execute submitted Python. Keep input limits and add a persistent rate limiter before a public launch.
