# Feedback → GitHub Issue (manual)

Feedback submitted in-app is stored in Supabase's `feedbacks` table with metadata
(`category`, `app_version`, `os`, `context`) but is **not** automatically posted to
GitHub. This is intentional (see `docs/planning/monetization-and-polish.md` G3): a human
should review feedback before it becomes a public issue, since some feedback may contain
sensitive details (e.g. B2B requests, security reports) that shouldn't be public.

This doc describes the manual conversion flow a developer follows today. A future
Edge Function could automate parts of this (see open question in the planning doc).

## 1. Find the feedback row

In the Supabase dashboard, open **Table Editor → `feedbacks`**, or query via SQL editor:

```sql
select id, content, category, app_version, os, context, profile_id, created_at
from feedbacks
order by created_at desc
limit 20;
```

Filter by category (`bug` / `feature` / `question`) to triage.

## 2. Decide: public issue vs. private follow-up

- `bug` / `feature` → usually fine to convert into a public GitHub issue.
- `question` → often better answered directly (email/Discord) unless it's a genuine
  feature gap.
- Anything that looks like a B2B inquiry, security report, or contains personal data →
  **do not** post publicly. Respond privately instead.

## 3. Build the issue title/body

Use this template when copying feedback content into an issue:

```text
Title: [<category>] <one-line summary written by you>

Body:
### Original feedback

> <feedback.content, lightly edited to remove anything sensitive>

### Metadata
- App version: <feedback.app_version>
- OS: <feedback.os>
- Context: <feedback.context>
- Submitted: <feedback.created_at>

### Notes
<your triage notes / repro steps / priority>
```

## 4. Generate the `gh issue create` command

Pipe a small JSON object with `title`, `body`, and `category` into the helper script,
which prints (but does not execute) a `gh issue create` command:

```bash
echo '{
  "title": "[bug] Proxy crashes when starting on port 443",
  "body": "### Original feedback\n\n> Proxy crashes when I try 443...\n\n### Metadata\n- App version: 2.5.4\n- OS: windows\n- Context: /proxy\n",
  "category": "bug"
}' | node tools/feedback-to-github-issue.mjs
```

This prints something like:

```bash
gh issue create --repo GrangbelrLurain/horizon-gateway --title '[bug] Proxy crashes when starting on port 443' --body '...' --label bug
```

Review the printed command, then either:

- Copy/paste it into your terminal and run it, or
- Pipe it directly: `... | node tools/feedback-to-github-issue.mjs | sh` (only do this once
  you've reviewed the body for sensitive content).

Requires the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and
authenticated (`gh auth login`).

## 5. Mark the feedback as triaged (optional)

There's no `triaged` column yet. Until one exists, developers can track conversion
status by adding a comment linking back to the issue in a shared doc, or by adding a
`triaged_at` / `github_issue_url` column via a follow-up migration if this becomes a
frequent workflow.
