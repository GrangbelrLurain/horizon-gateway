#!/usr/bin/env node
/**
 * Reads a feedback row (JSON) from stdin and prints a ready-to-run `gh issue create`
 * command. Does NOT call the GitHub API itself — this is intentionally a manual,
 * developer-reviewed step (see supabase/scripts/feedback-to-issue.md).
 *
 * Usage:
 *   echo '{"title":"Proxy crashes on start","body":"...","category":"bug"}' \
 *     | node tools/feedback-to-github-issue.mjs
 *
 *   node tools/feedback-to-github-issue.mjs < feedback.json
 *
 * Input fields:
 *   - title    (string, required)  Issue title.
 *   - body     (string, required)  Issue body (markdown). Strip any sensitive info first.
 *   - category (string, optional)  "bug" | "feature" | "question" — mapped to a GitHub label.
 *
 * The printed command is safe to copy/paste or pipe to a shell:
 *   node tools/feedback-to-github-issue.mjs < feedback.json | pbcopy
 *   node tools/feedback-to-github-issue.mjs < feedback.json | sh
 */

const CATEGORY_LABELS = {
	bug: "bug",
	feature: "enhancement",
	question: "question",
};

const REPO = process.env.HG_GITHUB_REPO || "GrangbelrLurain/horizon-gateway";

function readStdin() {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

function shellQuote(value) {
	// Single-quote for POSIX shells; escape embedded single quotes.
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

async function main() {
	const raw = await readStdin();
	if (!raw.trim()) {
		console.error("No input received. Pipe feedback JSON via stdin, e.g.:");
		console.error(
			'  echo \'{"title":"...","body":"...","category":"bug"}\' | node tools/feedback-to-github-issue.mjs',
		);
		process.exit(1);
	}

	let feedback;
	try {
		feedback = JSON.parse(raw);
	} catch (e) {
		console.error("Failed to parse stdin as JSON:", e.message);
		process.exit(1);
	}

	const { title, body, category } = feedback;
	if (!title || !body) {
		console.error("Both 'title' and 'body' fields are required in the input JSON.");
		process.exit(1);
	}

	const label = CATEGORY_LABELS[category] || null;
	const parts = ["gh", "issue", "create", "--repo", REPO, "--title", shellQuote(title), "--body", shellQuote(body)];
	if (label) {
		parts.push("--label", shellQuote(label));
	}

	console.log(parts.join(" "));
}

main();
