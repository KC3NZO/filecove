---
name: commit
description: Stage and commit the current changes in this repo's commit message style.
argument-hint: "[optional hint about scope or wording]"
disable-model-invocation: true
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git add *)
---

# Commit

Stage and commit the working tree's changes. If arguments were given, treat them as a hint about what to include or how to word the message: $ARGUMENTS

## 1. Look at what changed

Run `git status`, `git diff` and `git diff --staged`, and read them against what was done in this conversation. Run `git log -5` if you need a reminder of the style.

- Untracked files belong in the commit only if they are part of the change. Leave stray files (scratch output, local env files, editor leftovers) alone and mention them.
- If a feature changed but its notes in `.claude/rules/` or `CLAUDE.md` weren't updated, say so before committing. Don't edit them as part of this skill.

## 2. Group into commits

One logical change per commit. If the tree holds unrelated changes, split them, and say the plan in one line before starting:

- Feature or fix code first.
- Then documentation for it (`CLAUDE.md`, `.claude/rules/`) as its own commit, e.g. "CLAUDE.md updated for marquee selection." or "Rules updated for sorting."

Stage by path (`git add <files>`), never `git add -A` or `git add .`.

## 3. Write the message

- **Subject:** one sentence describing the result, ending with a period. Phrase it as what now is, not as a command:
  - "Content sorting added, from the header's view options menu and the list view's column headers."
  - "Navigating no longer expands the sidebar tree; only its chevrons do."
  - "Path bar moved to its own row below the header buttons on narrow screens."

  No `feat:` style prefixes and no hard length limit, but keep it to one line.
- **Body:** only when the subject can't carry the change. Write prose paragraphs about behaviour (what the user sees, the rules it follows, what was deliberately left out), not a list of files touched. Identifiers go in backticks.
- **Trailer:** end with the Co-Authored-By line from the session's attribution instructions, after a blank line.

Pass the message through a heredoc so the formatting survives:

```sh
git commit -F - <<'EOF'
Subject sentence.

Optional body.

Co-Authored-By: ...
EOF
```

## 4. Rules

- Commit on the current branch. This repo commits straight to `main`; don't create a branch.
- Never push (it's denied in `.claude/settings.json` anyway), never amend an existing commit, and never use `--no-verify`, unless the user asks.
- Don't run build or lint before committing unless asked.

## 5. Report

Finish with `git log --oneline` for the new commits and a final `git status`. Mention anything left uncommitted and why.
