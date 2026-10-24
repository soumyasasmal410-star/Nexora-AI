"""
ast3d.py - powers the "View 3D structure" button in the Nexora AI mentor.

It only PARSES the submitted Python (ast.parse). It never runs, imports or evaluates it.

app.py (after `limiter = Limiter(...)` and after the premium lines):
    from ast3d import init_ast3d
    init_ast3d(app, limiter)
"""
import ast

from flask import jsonify, request

MAX_CODE = 12000     # same cap as the mentor
MAX_NODES = 300      # keeps the 3D view readable and the response small
MAX_DEPTH = 14

_LOOPS = (ast.For, ast.AsyncFor, ast.While)


def _name(node):
    """Readable name for a call target / expression."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _name(node.value)
        return (base + "." if base else "") + node.attr
    return ""


def _describe(node):
    """(type_group, label) for nodes worth showing; None = skip but keep walking."""
    if isinstance(node, ast.Module):
        return "module", "module"
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return "def", f"def {node.name}()"
    if isinstance(node, ast.ClassDef):
        return "class", f"class {node.name}"
    if isinstance(node, ast.For) or isinstance(node, ast.AsyncFor):
        return "loop", "for loop"
    if isinstance(node, ast.While):
        return "loop", "while loop"
    if isinstance(node, ast.If):
        return "if", "if"
    if isinstance(node, ast.Try):
        return "try", "try / except"
    if isinstance(node, ast.With):
        return "with", "with"
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        names = ", ".join(a.name for a in node.names)[:30]
        return "import", f"import {names}"
    if isinstance(node, ast.Return):
        return "return", "return"
    if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        who = ", ".join(_name(t) for t in targets if _name(t))[:24]
        return "assign", f"{who or 'value'} ="
    if isinstance(node, ast.Call):
        return "call", f"{_name(node.func) or 'call'}()"
    if isinstance(node, (ast.Break, ast.Continue, ast.Pass, ast.Raise, ast.Assert)):
        return "flow", type(node).__name__.lower()
    return None


def build_tree(code):
    """Returns (nodes, truncated). Each node: id, p (parent id or -1), t (group), l (label), line."""
    tree = ast.parse(code, filename="<submitted-code>", mode="exec")
    nodes, truncated = [], False
    stack = [(tree, -1, 0)]                      # iterative walk: no recursion limit surprises
    while stack:
        node, parent, depth = stack.pop()
        info = _describe(node)
        my_parent = parent
        if info:
            if len(nodes) >= MAX_NODES or depth > MAX_DEPTH:
                truncated = True
                continue
            nid = len(nodes)
            nodes.append({"id": nid, "p": parent, "t": info[0], "l": info[1],
                          "line": getattr(node, "lineno", 0)})
            my_parent, depth = nid, depth + 1
        children = list(ast.iter_child_nodes(node))
        for child in reversed(children):         # reversed so the first child is processed first
            stack.append((child, my_parent, depth))
    return nodes, truncated


def _view():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code", ""))[:MAX_CODE]
    if not code.strip():
        return jsonify(ok=False, error="Paste some Python code first."), 400
    try:
        nodes, truncated = build_tree(code)
    except SyntaxError as exc:
        return jsonify(ok=False, error=f"Fix the syntax error first - line {exc.lineno or '?'}: {exc.msg}."), 400
    except (RecursionError, MemoryError, ValueError, OverflowError):
        return jsonify(ok=False, error="This code is too complex to draw. Try a smaller snippet."), 400
    return jsonify(ok=True, nodes=nodes, truncated=truncated)


def init_ast3d(app, limiter=None):
    view = limiter.limit("30 per minute")(_view) if limiter else _view
    app.add_url_rule("/api/ast", "ast3d", view, methods=["POST"])
