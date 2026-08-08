"""Minimal flask launcher for local Windows development.

Why this exists
---------------
api/app.py decides between the lightweight migrations app and the full app via:

    def is_db_command() -> bool:
        return len(sys.argv) > 1 and sys.argv[0].endswith("flask") and sys.argv[1] == "db"

On Windows sys.argv[0] is never bare "flask":
    flask.exe            -> "...\\Scripts\\flask.exe"   endswith("flask") = False
    python -m flask      -> "...\\flask\\__main__.py"   endswith("flask") = False

So `db upgrade` would load the FULL app (importing the whole controller tree)
instead of create_migrations_app(). Setting argv[0] explicitly restores the
intended behaviour. `run` is unaffected: argv[1] != "db", so it still takes
create_app().

Usage: python _flask.py db upgrade
       python _flask.py run --host 0.0.0.0 --port 5001 --debug
"""

from __future__ import annotations

import sys

# ---- Diagnostic-only hook -------------------------------------------------
# Reports the real path whenever source handed to compile() contains NUL
# bytes, and re-reads the file from disk to distinguish a genuinely bad file
# from a transient bad read. Pass-through: does not change import behaviour.
import importlib._bootstrap_external as _bext

_orig_source_to_code = _bext.SourceLoader.source_to_code


def _source_to_code(self, data, path, *, _optimize=-1):
    if b"\x00" in data:
        print(
            f"\n[diag] NUL bytes in source passed to compile()"
            f"\n[diag]   path      : {path}"
            f"\n[diag]   in-memory : size={len(data)} nul={data.count(b'\x00')}",
            file=sys.stderr,
        )
        try:
            with open(path, "rb") as fh:
                disk = fh.read()
            print(
                f"[diag]   disk re-read: size={len(disk)} nul={disk.count(b'\x00')}",
                file=sys.stderr,
            )
            if b"\x00" not in disk:
                print(
                    "[diag]   -> file on disk is CLEAN; the bad bytes came from"
                    " the read, not the file.",
                    file=sys.stderr,
                )
        except Exception as exc:
            print(f"[diag]   disk re-read failed: {exc}", file=sys.stderr)
    return _orig_source_to_code(self, data, path, _optimize=_optimize)


_bext.SourceLoader.source_to_code = _source_to_code
# ---- end diagnostic hook --------------------------------------------------

sys.argv[0] = "flask"

from flask.cli import main  # noqa: E402

sys.exit(main())
