import os
import re
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # 64 KB request limit

MAX_FREE_REQUESTS_PER_SESSION = 8
MAX_TEXT_LENGTH = 12000


def analyze_locally(code: str, question: str, mode: str) -> dict:
    """Useful offline fallback; never executes submitted code."""
    hints = []
    try:
        compile(code, "<submitted-code>", "exec")
        syntax_note = "Python syntax check passed. This does not guarantee the program will run correctly."
    except SyntaxError as exc:
        syntax_note = (
            f"Syntax error on line {exc.lineno or '?'}: {exc.msg}. "
            "Check the indicated line and the line immediately before it for missing punctuation, "
            "indentation, quotes, or brackets."
        )
        if exc.text:
            hints.append(f"Problem line: {exc.text.strip()}")

    patterns = [
        (r"\bprint\s*\(", "print(...) displays a value. Check that the opening and closing parentheses match."),
        (r"\binput\s*\(", "input() returns text. Convert it with int() or float() before numeric calculations."),
        (r"\bwhile\s+True\b", "A while True loop needs a clear exit condition or break to avoid running forever."),
        (r"\bif\b.*(?<!:)$", "An if statement should end with a colon, and its body must be indented."),
        (r"\bfor\b.*\bin\b", "Check the for-loop variable and the sequence after in."),
        (r"==", "Use == to compare values; a single = assigns a value."),
        (r"\bexcept\b", "Catch only exceptions you can handle meaningfully; avoid silently swallowing every error."),
        (r"\bopen\s*\(", "For files, consider a with open(...) block so the file closes automatically."),
    ]
    for pattern, hint in patterns:
        if re.search(pattern, code):
            hints.append(hint)

    if not hints:
        hints.append("Try one small test input, inspect the expected result, and compare it with the actual output.")

    if mode == "debug":
        headline = "Debugging guide"
        next_steps = [
            "Reproduce the problem with the smallest possible input.",
            "Read the exact traceback from the last line upward.",
            "Check variable values near the line where the result first becomes incorrect.",
        ]
    elif mode == "explain":
        headline = "Code explanation"
        next_steps = [
            "Read the code from top to bottom and note the inputs, transformations, and outputs.",
            "Trace one example by hand and write down how each important variable changes.",
        ]
    elif mode == "improve":
        headline = "Code improvement ideas"
        next_steps = [
            "Give variables clear names and split large tasks into small functions.",
            "Add tests for a normal case, an edge case, and invalid input.",
            "Only optimize after you know the program is correct.",
        ]
    else:
        headline = "Learning hints"
        next_steps = [
            "Try to predict what each line does before running the program.",
            "Change one thing at a time and observe the result.",
            "Write down why the fix works so you can recognize the pattern again.",
        ]

    return {
        "headline": headline,
        "syntax": syntax_note,
        "hints": hints[:5],
        "next_steps": next_steps,
        "question": question.strip() or "No extra question supplied.",
        "offline": True,
    }


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(status="ok", app="Nexora AI")


@app.post("/api/mentor")
def mentor():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code", ""))[:MAX_TEXT_LENGTH]
    question = str(payload.get("question", ""))[:2000]
    mode = str(payload.get("mode", "hint"))
    if not code.strip():
        return jsonify(error="Paste some Python code first."), 400
    if mode not in {"hint", "debug", "explain", "improve"}:
        mode = "hint"

    result = analyze_locally(code, question, mode)
    result["message"] = (
        "This first version works without an AI API key and never runs the code you submit. "
        "It performs a Python syntax check and gives rule-based learning hints. "
        "Connect an AI provider later for conversational, model-generated answers."
    )
    return jsonify(result)


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Request is too large. Please keep the submitted code under 12,000 characters."), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
