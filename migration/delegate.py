#!/usr/bin/env python3
"""
delegate.py — Delegate RDFExplorer migration stages to opencode.

Each stage's hand-off prompt is read from its stage-N-*.md file, the absolute
paths inside the prompt are rewritten to point at THIS repo, and `opencode run`
is invoked from the repo root with the prompt as argument. Each invocation
of `opencode run` starts a NEW session (no --attach), so every stage gets a
fresh chat — exactly what you want for clean, independent migrations.

Full output for each stage is streamed to stdout and saved under
migration/logs/stage-N-<timestamp>.log.

Usage:

  Initial setup (one-time, optional — Stage 0's agent can do this itself):
    python migration/delegate.py --prep

  Run a single stage:
    python migration/delegate.py --list
    python migration/delegate.py --stage 0
    python migration/delegate.py --stage 1 --model anthropic/claude-opus-4-5
    python migration/delegate.py --stage 2 --dry-run        # preview only

  Run all 6 stages sequentially (pause + verify between each):
    python migration/delegate.py --all
    python migration/delegate.py --all --start-from 2       # resume from stage 2
    python migration/delegate.py --all --auto-continue      # no pauses (unattended)
    python migration/delegate.py --all --auto-commit        # commit after each stage

  Other options:
    --no-confirm       Skip the initial "Proceed?" prompts.
    --agent NAME       Pass --agent NAME to opencode.
    --show             Alias for --dry-run.

Prerequisites:
  - opencode installed and on PATH (https://opencode.ai).
  - You are in a clean git working tree (the script will warn otherwise).
  - Python 3.8+.

By default the script never commits. Use --auto-commit if you want unattended
runs to commit after each successful stage. Failed stages (non-zero exit)
always stop --all so prerequisites for the next stage are not silently broken.
"""

from __future__ import annotations

import argparse
import datetime
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent          # <repo>/migration
REPO_ROOT = SCRIPT_DIR.parent                         # <repo>
LOGS_DIR = SCRIPT_DIR / "logs"

# Absolute path that appears hard-coded in the stage docs (the path I
# generated them with). The script rewrites it to REPO_ROOT before sending
# the prompt to opencode, so the migration docs are portable.
LEGACY_HARDCODED_REPO_PATH = "/home/mmventurino/Documents/RDFExplorer"

STAGES = [
    ("stage-0-bootstrap.md",      "Bootstrap Angular 17 + layout shell"),
    ("stage-1-services.md",       "Core services (settings / request / query / log)"),
    ("stage-2-property-graph.md", "Property graph domain model"),
    ("stage-3-canvas.md",         "Visual canvas with cytoscape.js"),
    ("stage-4-tools.md",          "Tool panels (search / describe / edit / sparql / settings / help / log)"),
    ("stage-5-polish.md",         "Polish: survey + modal + tutorial + backend trim"),
]

# Files / dirs at the repo root that should move into legacy/ on --prep.
# README.md, SPECS.md, migration/, .git, .gitignore, license.txt stay at root.
LEGACY_MOVE_CANDIDATES = [
    "server.js",
    "package.json",
    "package-lock.json",
    "public",
    "survey-results",
]

# ---------- helpers ---------------------------------------------------------

def colored(s: str, code: str) -> str:
    if not sys.stdout.isatty():
        return s
    return f"\033[{code}m{s}\033[0m"


def info(msg: str)  -> None: print(colored("• ", "36") + msg)
def warn(msg: str)  -> None: print(colored("! ", "33") + msg, file=sys.stderr)
def error(msg: str) -> None: print(colored("✗ ", "31") + msg, file=sys.stderr)
def ok(msg: str)    -> None: print(colored("✓ ", "32") + msg)


def check_opencode_installed() -> None:
    if shutil.which("opencode") is None:
        error("opencode CLI not found on PATH.")
        print(
            "\nInstall it from https://opencode.ai or with one of:\n"
            "    npm install -g opencode-ai\n"
            "    brew install sst/tap/opencode\n"
            "    curl -fsSL https://opencode.ai/install | bash\n",
            file=sys.stderr,
        )
        sys.exit(1)


def check_git_clean() -> bool:
    """Return True if the working tree has no uncommitted changes."""
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip()
    except subprocess.CalledProcessError:
        warn("Could not run `git status` — is this a git repo?")
        return False
    return out == ""


def extract_handoff_prompt(stage_file: Path) -> str:
    """Pull the hand-off prompt out of a stage markdown file.

    Convention: the prompt lives under the heading
    `## Hand-off prompt for the agent`, inside a fenced code block, delimited
    by lines of '=====' (≥20 equals signs).
    """
    text = stage_file.read_text(encoding="utf-8")
    idx = text.find("## Hand-off prompt for the agent")
    if idx == -1:
        raise ValueError(
            f"'## Hand-off prompt for the agent' section not found in {stage_file.name}"
        )
    section = text[idx:]
    matches = re.findall(
        r"={20,}\s*\n(.*?)\n={20,}",
        section,
        flags=re.DOTALL,
    )
    if not matches:
        raise ValueError(
            f"No '=====' delimited prompt block found in {stage_file.name}"
        )
    return matches[0].strip()


def rewrite_paths(prompt: str) -> str:
    """Replace the hard-coded repo path in the stage doc with the current
    repo root. Idempotent: if the paths already match, no change."""
    if LEGACY_HARDCODED_REPO_PATH in prompt:
        return prompt.replace(LEGACY_HARDCODED_REPO_PATH, str(REPO_ROOT))
    return prompt


# ---------- commands --------------------------------------------------------

def cmd_list() -> None:
    print()
    print(colored("RDFExplorer migration — stage index", "1"))
    print()
    for i, (fname, title) in enumerate(STAGES):
        path = SCRIPT_DIR / fname
        marker = colored("✓", "32") if path.exists() else colored("✗", "31")
        print(f"  Stage {i}  [{marker}]  {title}")
        print(f"             {fname}")
    print()
    print(f"  Repo root:  {REPO_ROOT}")
    print(f"  Logs dir:   {LOGS_DIR} (created on first run)")
    print()


def cmd_prep(no_confirm: bool) -> None:
    """Move legacy source into legacy/ via `git mv`, preserving history."""
    legacy = REPO_ROOT / "legacy"
    existing = [p for p in (LEGACY_MOVE_CANDIDATES) if (REPO_ROOT / p).exists()]
    if not existing:
        info("Nothing to move — legacy candidates already absent from repo root.")
        return
    if legacy.exists() and any(legacy.iterdir()):
        warn(f"{legacy} already exists and is non-empty. Aborting to avoid overwrites.")
        return

    print()
    print(colored("Will move the following into legacy/ via `git mv`:", "1"))
    for p in existing:
        print(f"  • {p}")
    print()
    print("Files preserved at repo root: README.md, SPECS.md, license.txt,")
    print(".gitignore, migration/, and .git/.")
    print()

    if not no_confirm:
        ans = input("Proceed? [y/N] ").strip().lower()
        if ans != "y":
            info("Aborted.")
            return

    legacy.mkdir(exist_ok=True)
    for p in existing:
        src = REPO_ROOT / p
        dst = legacy / p
        try:
            subprocess.run(
                ["git", "mv", str(src), str(dst)],
                cwd=REPO_ROOT, check=True, capture_output=True, text=True,
            )
            ok(f"moved: {p}")
        except subprocess.CalledProcessError as e:
            error(f"git mv {p} failed: {e.stderr.strip()}")
            sys.exit(1)

    print()
    ok(f"Done. Run `git status` to confirm renames; commit when ready.")


def cmd_stage(stage: int, model: Optional[str], agent: Optional[str],
              dry_run: bool, show_only: bool, no_confirm: bool) -> int:
    """Run a single stage. Returns opencode's exit code (0 on success).

    Each call invokes `opencode run` fresh — no --attach, no session reuse.
    """
    if not (0 <= stage < len(STAGES)):
        error(f"Stage must be 0..{len(STAGES) - 1}")
        return 2

    fname, title = STAGES[stage]
    stage_path = SCRIPT_DIR / fname
    if not stage_path.exists():
        error(f"Stage file not found: {stage_path}")
        return 2

    try:
        prompt = extract_handoff_prompt(stage_path)
    except ValueError as e:
        error(str(e))
        return 2
    prompt = rewrite_paths(prompt)

    # ── header ─────────────────────────────────────────────────────────────
    bar = "═" * 78
    print()
    print(colored(f"╔{bar}╗", "36"))
    line = f" Stage {stage}: {title}"
    print(colored(f"║{line.ljust(78)}║", "36"))
    line = f" Source:  migration/{fname}"
    print(colored(f"║{line.ljust(78)}║", "36"))
    line = f" Working: {REPO_ROOT}"
    print(colored(f"║{line.ljust(78)}║", "36"))
    if model:
        line = f" Model:   {model}"
        print(colored(f"║{line.ljust(78)}║", "36"))
    print(colored(f"╚{bar}╝", "36"))
    print()

    # ── show prompt ────────────────────────────────────────────────────────
    print(colored("───── prompt being sent to opencode ─────", "2"))
    print(prompt)
    print(colored("──────────────────────────────────────────", "2"))
    print()

    if show_only or dry_run:
        info("Dry-run only. Not invoking opencode.")
        return 0

    # ── pre-flight ─────────────────────────────────────────────────────────
    if not check_git_clean():
        warn("Working tree has uncommitted changes. opencode will modify files.")
        warn("Strongly recommended: commit or stash first so you can review the diff cleanly.")
        if not no_confirm:
            ans = input("Continue anyway? [y/N] ").strip().lower()
            if ans != "y":
                info("Aborted.")
                return 130

    if not no_confirm:
        print(f"Will run: opencode run --dir {REPO_ROOT} {'--model ' + model + ' ' if model else ''}<prompt>")
        ans = input("Proceed? [y/N] ").strip().lower()
        if ans != "y":
            info("Aborted.")
            return 130

    # ── invoke ─────────────────────────────────────────────────────────────
    LOGS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = LOGS_DIR / f"stage-{stage}-{timestamp}.log"

    cmd: list[str] = ["opencode", "run", "--dir", str(REPO_ROOT)]
    if model:
        cmd += ["--model", model]
    if agent:
        cmd += ["--agent", agent]
    cmd.append(prompt)

    info(f"Log: {log_path}")
    print()

    started = datetime.datetime.now()
    with open(log_path, "w", encoding="utf-8") as logf:
        logf.write(f"# Stage {stage}: {title}\n")
        logf.write(f"# Started:  {started.isoformat(timespec='seconds')}\n")
        logf.write(f"# Repo:     {REPO_ROOT}\n")
        logf.write(f"# Command:  opencode run --dir {REPO_ROOT}"
                   f"{' --model ' + model if model else ''}"
                   f"{' --agent ' + agent if agent else ''}"
                   f" <prompt>\n")
        logf.write("# Prompt:\n")
        for line in prompt.splitlines():
            logf.write(f"#   {line}\n")
        logf.write("\n# ─── opencode output ───\n\n")
        logf.flush()

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1,
                cwd=REPO_ROOT,
            )
        except FileNotFoundError:
            error("opencode binary disappeared between pre-check and exec.")
            return 1

        assert proc.stdout is not None
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            logf.write(line)
            logf.flush()
        proc.wait()

        logf.write(f"\n# ─── ended {datetime.datetime.now().isoformat(timespec='seconds')} "
                   f"(exit {proc.returncode}) ───\n")

    print()
    if proc.returncode == 0:
        ok(f"Stage {stage} completed (exit 0). Log: {log_path}")
        print()
        print(colored("Next steps:", "1"))
        print(f"  1. Review diff:           git status && git diff")
        print(f"  2. Verify acceptance:     migration/{fname} → ## Acceptance criteria")
        print(f"  3. Update status table:   migration/README.md → mark stage {stage} done")
        if stage + 1 < len(STAGES):
            print(f"  4. When satisfied, commit, then run:")
            print(f"        python migration/delegate.py --stage {stage + 1}")
        else:
            print(f"  4. Migration complete — celebrate.")
        print()
    else:
        error(f"Stage {stage} exited with code {proc.returncode}.")
        print(f"  See full output in: {log_path}", file=sys.stderr)
    return proc.returncode


def cmd_all(start_from: int, model: Optional[str], agent: Optional[str],
            auto_continue: bool, auto_commit: bool, no_confirm: bool) -> int:
    """Run stages start_from..5 in sequence.

    Each stage is a fresh `opencode run` invocation (= new chat).
    Between stages the script pauses to let you verify the diff, unless
    --auto-continue is set. On any non-zero stage exit, the loop stops —
    fixing a failed stage manually before continuing prevents broken
    prerequisites from cascading into later stages.
    """
    if not (0 <= start_from < len(STAGES)):
        error(f"--start-from must be 0..{len(STAGES) - 1}")
        return 2

    total = len(STAGES) - start_from
    print()
    print(colored(f"Running {total} stage(s) sequentially: {start_from}..{len(STAGES) - 1}", "1"))
    if auto_continue: info("--auto-continue: will not pause between stages.")
    if auto_commit:   info("--auto-commit:   will `git add -A && git commit` after each successful stage.")
    if model:         info(f"Model override:  {model}")
    if agent:         info(f"Agent override:  {agent}")
    print()

    if not no_confirm:
        ans = input("Start the sequential run? [y/N] ").strip().lower()
        if ans != "y":
            info("Aborted.")
            return 130

    for stage in range(start_from, len(STAGES)):
        fname, title = STAGES[stage]
        print()
        print(colored("━" * 80, "36"))
        print(colored(f"▶ Sequential run — Stage {stage} of {len(STAGES) - 1}: {title}", "1;36"))
        print(colored("━" * 80, "36"))

        rc = cmd_stage(
            stage=stage, model=model, agent=agent,
            dry_run=False, show_only=False,
            no_confirm=True,           # already confirmed at the top of --all
        )

        if rc != 0:
            error(f"Stage {stage} failed (exit {rc}). Stopping sequential run.")
            print(file=sys.stderr)
            print("To resume after fixing manually:", file=sys.stderr)
            print(f"  python migration/delegate.py --all --start-from {stage}", file=sys.stderr)
            return rc

        # ── post-stage: optional auto-commit ──────────────────────────────
        if auto_commit:
            try:
                subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True)
                msg = f"Stage {stage}: {title}\n\nGenerated by migration/delegate.py via opencode."
                result = subprocess.run(
                    ["git", "commit", "-m", msg],
                    cwd=REPO_ROOT, capture_output=True, text=True,
                )
                if result.returncode == 0:
                    ok(f"Auto-committed stage {stage} changes.")
                elif "nothing to commit" in result.stdout.lower():
                    info("No changes to commit (stage may have been a no-op).")
                else:
                    warn(f"git commit failed: {result.stderr.strip()}")
            except subprocess.CalledProcessError as e:
                warn(f"Auto-commit error: {e}")

        # ── post-stage: pause for verification ────────────────────────────
        is_last = (stage == len(STAGES) - 1)
        if is_last:
            print()
            ok("All stages complete.")
            print()
            print(colored("Final checks:", "1"))
            print("  • Review the full diff history: git log --oneline")
            print("  • Run the production build: cd app && ng build")
            print("  • Smoke-test the SPA: cd server && npm start, then visit http://localhost:8081")
            print()
            break

        if auto_continue:
            info(f"Auto-continuing to stage {stage + 1}…")
            continue

        # Interactive pause
        print()
        try:
            diff = subprocess.run(
                ["git", "diff", "--stat", "HEAD"],
                cwd=REPO_ROOT, capture_output=True, text=True, check=False,
            ).stdout.strip()
            if diff:
                print(colored("Changes since HEAD:", "1"))
                for line in diff.splitlines()[-10:]:
                    print(f"  {line}")
                print()
        except subprocess.CalledProcessError:
            pass

        print(colored(f"Stage {stage} done. Next up: Stage {stage + 1} — {STAGES[stage + 1][1]}", "1"))
        print()
        print("Options:")
        print(f"  [Enter]  continue to stage {stage + 1}")
        print(f"  s        skip stage {stage + 1} (advance counter without running)")
        print(f"  q        quit (resume later with --start-from {stage + 1})")
        print()
        choice = input("Your choice: ").strip().lower()
        if choice == "q":
            info(f"Stopping after stage {stage}. Resume with:")
            info(f"  python migration/delegate.py --all --start-from {stage + 1}")
            return 0
        if choice == "s":
            warn(f"Skipping stage {stage + 1}. Prerequisites for later stages may break.")
            # Loop will simply advance; next iteration's cmd_stage will run normally
            # but the user has been warned.
            continue
        # any other input (including empty) → continue

    return 0


# ---------- main ------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="delegate.py",
        description=(
            "Delegate RDFExplorer migration stages to opencode. Each stage is a "
            "fresh `opencode run` invocation (new chat — no session reuse). "
            "Reads each stage's hand-off prompt from migration/stage-N-*.md."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python migration/delegate.py --list\n"
            "  python migration/delegate.py --prep\n"
            "  python migration/delegate.py --stage 0\n"
            "  python migration/delegate.py --stage 1 --model anthropic/claude-opus-4-5\n"
            "  python migration/delegate.py --stage 2 --dry-run\n"
            "  python migration/delegate.py --all\n"
            "  python migration/delegate.py --all --start-from 3 --auto-commit\n"
        ),
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", action="store_true",
                       help="List the 6 stages and exit.")
    group.add_argument("--prep", action="store_true",
                       help="Move legacy code into legacy/ via `git mv` (preserves history). "
                            "Optional: Stage 0's agent can do this itself if you skip --prep.")
    group.add_argument("--stage", type=int, metavar="N",
                       help="Run a single stage (0–5).")
    group.add_argument("--all", action="store_true",
                       help="Run stages 0 through 5 sequentially, pausing between each "
                            "for verification (each stage = new opencode chat).")

    parser.add_argument("--start-from", type=int, metavar="N", default=0,
                        help="With --all: start from this stage (default 0). "
                             "Use to resume after a failed/skipped stage.")
    parser.add_argument("--auto-continue", action="store_true",
                        help="With --all: do not pause between stages. "
                             "Useful for unattended runs but skips manual verification.")
    parser.add_argument("--auto-commit", action="store_true",
                        help="With --all: `git add -A && git commit` after each successful "
                             "stage. Off by default — review and commit yourself.")
    parser.add_argument("--model", metavar="PROVIDER/MODEL",
                        help="Override opencode model (e.g. anthropic/claude-opus-4-5).")
    parser.add_argument("--agent", metavar="NAME",
                        help="Pass --agent NAME to opencode.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the prompt and command, but do not invoke opencode.")
    parser.add_argument("--show", action="store_true",
                        help="Alias for --dry-run.")
    parser.add_argument("--no-confirm", action="store_true",
                        help="Skip the initial 'Proceed?' confirmation prompts.")

    args = parser.parse_args()

    if args.list:
        cmd_list()
        return

    if args.prep:
        cmd_prep(no_confirm=args.no_confirm)
        return

    if args.stage is not None:
        check_opencode_installed()
        rc = cmd_stage(
            stage=args.stage,
            model=args.model,
            agent=args.agent,
            dry_run=args.dry_run,
            show_only=args.show,
            no_confirm=args.no_confirm,
        )
        sys.exit(rc)

    if args.all:
        check_opencode_installed()
        rc = cmd_all(
            start_from=args.start_from,
            model=args.model,
            agent=args.agent,
            auto_continue=args.auto_continue,
            auto_commit=args.auto_commit,
            no_confirm=args.no_confirm,
        )
        sys.exit(rc)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
