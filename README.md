# Nexora AI

**Build smarter. Learn faster.**

Nexora AI is a standalone AI-powered tools platform for students, developers, and creators. This first MVP focuses on a Python Code Mentor.

## Current MVP
- Responsive dark/neon landing page and tool dashboard.
- Python syntax validation and beginner-friendly rule-based hints.
- Modes for hints, debugging, code explanation, and improvement suggestions.
- Does not execute submitted code.
- Does not save submitted code or require an API key.
- Health endpoint at `/health`.

> Note: This version does not yet call an AI model. Model-powered conversational explanations, accounts, usage quotas, payments, and other tools are planned later. The current hints are rule-based and may not identify every bug.

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

## Planned roadmap
1. Connect a server-side AI provider through an environment secret.
2. Add per-session rate limits and usage visibility.
3. Test with beginner Python examples and error cases.
4. Add accounts and saved projects only after privacy/security decisions.
5. Integrate payment checkout after the core experience has real users.
6. Expand to resume tools, a safe code workspace, and study/productivity tools.

## Security notes
Never put provider API keys in frontend JavaScript or commit secrets. This app deliberately does not use `eval` or execute submitted Python. Keep input limits and add a persistent rate limiter before a public launch.
