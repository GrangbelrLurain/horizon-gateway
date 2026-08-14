import React from "react";
import { hgLinkAlias } from "./guideFeatureLinks";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  codeStyle?: React.CSSProperties;
  /** Called for `hg://` feature aliases. External https links stay target=_blank. */
  onHgLink?: (alias: string) => void;
}

/**
 * Helper to format code text so long paths break cleanly after slashes or dots
 * without breaking normal words awkwardly in the middle.
 */
function formatCodePathText(text: string): string {
  // Insert zero-width space (\u200B) after slashes and dots to allow smart line breaks
  return text.replace(/([/._])/g, "$1\u200B");
}

/** App sets --hg-md-* from DaisyUI tokens; injection falls back to currentColor mixes. */
const ACCENT = "var(--hg-md-accent, color-mix(in oklab, currentColor 30%, #2563eb))";
const NESTED = "color-mix(in oklab, currentColor 85%, transparent)";
const CODE_FG = "var(--hg-md-code-fg, color-mix(in oklab, currentColor 22%, #4338ca))";
const CODE_BG = "var(--hg-md-code-bg, color-mix(in oklab, currentColor 10%, transparent))";
const CODE_BORDER = "var(--hg-md-code-border, color-mix(in oklab, currentColor 16%, transparent))";
const OL_BG = "var(--hg-md-ol-bg, color-mix(in oklab, currentColor 12%, transparent))";
const OL_BORDER = "var(--hg-md-ol-border, color-mix(in oklab, currentColor 22%, #2563eb))";
const PRE_BG = "var(--hg-md-pre-bg, color-mix(in oklab, currentColor 8%, transparent))";
const PRE_BORDER = "var(--hg-md-pre-border, color-mix(in oklab, currentColor 14%, transparent))";
const PRE_FG = "var(--hg-md-pre-fg, currentColor)";

const HEADING_STYLE: Record<number, React.CSSProperties> = {
  1: { fontSize: "1.28em", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.28, color: "currentColor" },
  2: { fontSize: "1.14em", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.32, color: "currentColor" },
  3: { fontSize: "1.05em", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.38, color: "currentColor" },
  4: { fontSize: "0.95em", fontWeight: 600, lineHeight: 1.42, color: NESTED },
};

const LINK_STYLE: React.CSSProperties = {
  color: ACCENT,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

function isBulletLine(trimmed: string): boolean {
  return trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ");
}

function bulletBody(trimmed: string): string {
  return trimmed.replace(/^[-*\u2022]\s*/, "").replace(/^[-*\u2022]\s*/, "");
}

/**
 * Lightweight, safe Markdown renderer component for description fields.
 * Supports headings, inline/fenced code, bold, italic, links, lists, line breaks,
 * and smart path overflow protection.
 *
 * Colors follow `currentColor` from the parent (DaisyUI `text-base-content` on cards,
 * overlay styles in injection) so light and dark both stay readable.
 */
export function MarkdownRenderer({ content, className = "", style = {}, codeStyle, onHgLink }: MarkdownRendererProps) {
  if (!content) {
    return null;
  }

  const lines = content.split("\n");

  const renderFormattedInlineText = (text: string): React.ReactNode[] => {
    // Regex for inline code: `code`
    const codeRegex = /`([^`]+)`/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null = codeRegex.exec(text);

    while (match !== null) {
      if (match.index > lastIdx) {
        parts.push(renderFormatting(text.slice(lastIdx, match.index), `txt-${lastIdx}`));
      }

      const codeContent = match[1];
      const formattedContent = formatCodePathText(codeContent);

      parts.push(
        <code
          key={`code-${match.index}`}
          style={{
            display: "inline",
            padding: "1px 5px",
            margin: "0 1px",
            fontSize: "0.86em",
            fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
            backgroundColor: CODE_BG,
            color: CODE_FG,
            borderRadius: "5px",
            border: `1px solid ${CODE_BORDER}`,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
            maxWidth: "100%",
            verticalAlign: "baseline",
            ...codeStyle,
          }}
        >
          {formattedContent}
        </code>,
      );

      lastIdx = codeRegex.lastIndex;
      match = codeRegex.exec(text);
    }

    if (lastIdx < text.length) {
      parts.push(renderFormatting(text.slice(lastIdx), `txt-${lastIdx}`));
    }

    return parts;
  };

  const renderFormatting = (subText: string, keyPrefix: string): React.ReactNode => {
    // Process markdown links [text](url), bold **text**, and italic *text*
    const tokens: React.ReactNode[] = [];
    const current = subText;
    let idx = 0;

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch: RegExpExecArray | null = linkRegex.exec(current);
    let lastLinkIdx = 0;

    while (linkMatch !== null) {
      if (linkMatch.index > lastLinkIdx) {
        tokens.push(parseBoldItalic(current.slice(lastLinkIdx, linkMatch.index), `${keyPrefix}-l-${idx++}`));
      }

      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      const hgAlias = hgLinkAlias(linkUrl);
      if (hgAlias !== null) {
        tokens.push(
          <a
            key={`${keyPrefix}-link-${linkMatch.index}`}
            href={linkUrl}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHgLink?.(hgAlias);
            }}
            style={{ ...LINK_STYLE, cursor: "pointer" }}
          >
            {linkText}
          </a>,
        );
      } else {
        tokens.push(
          <a
            key={`${keyPrefix}-link-${linkMatch.index}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            {linkText}
          </a>,
        );
      }

      lastLinkIdx = linkRegex.lastIndex;
      linkMatch = linkRegex.exec(current);
    }

    if (lastLinkIdx < current.length) {
      tokens.push(parseBoldItalic(current.slice(lastLinkIdx), `${keyPrefix}-l-${idx++}`));
    }

    return <React.Fragment key={keyPrefix}>{tokens}</React.Fragment>;
  };

  const parseBoldItalic = (str: string, key: string): React.ReactNode => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
            return (
              <strong key={`b-${i}`} className="font-bold" style={{ fontWeight: 700, color: "currentColor" }}>
                {p.slice(2, -2)}
              </strong>
            );
          }
          const italicParts = p.split(/(\*.*?\*)/g);
          return (
            <React.Fragment key={`p-${i}`}>
              {italicParts.map((ip, j) => {
                if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 2) {
                  return (
                    <em key={`i-${j}`} style={{ fontStyle: "italic", opacity: 0.92 }}>
                      {ip.slice(1, -1)}
                    </em>
                  );
                }
                return ip;
              })}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  };

  const renderListRow = (key: number, indentLevel: number, marker: React.ReactNode, body: React.ReactNode) => {
    const paddingLeft = `${8 + indentLevel * 16}px`;
    return (
      <div
        key={`line-${key}`}
        className="hg-md-li"
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
          paddingLeft,
          marginTop: indentLevel > 0 ? "1px" : "3px",
          marginBottom: indentLevel > 0 ? "1px" : "3px",
        }}
      >
        {marker}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            color: indentLevel > 0 ? NESTED : "inherit",
            fontSize: indentLevel > 0 ? "0.97em" : undefined,
          }}
        >
          {body}
        </div>
      </div>
    );
  };

  const nodes: React.ReactNode[] = [];
  let lineIdx = 0;
  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const fenceStart = lineIdx;
      const codeLines: string[] = [];
      lineIdx += 1;
      while (lineIdx < lines.length && !lines[lineIdx].trim().startsWith("```")) {
        codeLines.push(lines[lineIdx]);
        lineIdx += 1;
      }
      if (lineIdx < lines.length) {
        lineIdx += 1;
      }
      nodes.push(
        <pre
          key={`fence-${fenceStart}`}
          style={{
            margin: "4px 0",
            padding: "8px 10px",
            borderRadius: "8px",
            fontSize: "0.86em",
            lineHeight: 1.5,
            fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
            backgroundColor: PRE_BG,
            color: PRE_FG,
            border: `1px solid ${PRE_BORDER}`,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code style={{ fontFamily: "inherit" }}>{codeLines.join("\n") || " "}</code>
        </pre>,
      );
      continue;
    }

    if (!trimmed) {
      nodes.push(<div key={`line-${lineIdx}`} style={{ height: "6px" }} />);
      lineIdx += 1;
      continue;
    }

    const leadingWhitespaceMatch = line.match(/^[\s\t]+/);
    const leadingSpaces = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].replace(/\t/g, "  ").length : 0;
    const indentLevel = Math.max(0, Math.floor(leadingSpaces / 2));

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push(
        <div
          key={`line-${lineIdx}`}
          className={`hg-md-h${level}`}
          style={{
            minWidth: 0,
            marginTop: lineIdx === 0 ? 0 : "8px",
            marginBottom: "2px",
            ...HEADING_STYLE[level],
          }}
        >
          {renderFormattedInlineText(headingMatch[2])}
        </div>,
      );
      lineIdx += 1;
      continue;
    }

    if (isBulletLine(trimmed)) {
      nodes.push(
        renderListRow(
          lineIdx,
          indentLevel,
          <span style={{ color: ACCENT, fontSize: "1.05em", lineHeight: "1.45", flexShrink: 0 }}>•</span>,
          renderFormattedInlineText(bulletBody(trimmed)),
        ),
      );
      lineIdx += 1;
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const rest = numMatch[2];
      nodes.push(
        renderListRow(
          lineIdx,
          indentLevel,
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "6px",
              backgroundColor: OL_BG,
              border: `1px solid ${OL_BORDER}`,
              color: ACCENT,
              fontSize: "10px",
              fontWeight: 800,
              fontFamily: "monospace",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {num}
          </span>,
          renderFormattedInlineText(rest),
        ),
      );
      lineIdx += 1;
      continue;
    }

    const paddingLeft = indentLevel > 0 ? `${14 + indentLevel * 14}px` : "0px";
    nodes.push(
      <div
        key={`line-${lineIdx}`}
        style={{
          minWidth: 0,
          paddingLeft,
          color: indentLevel > 0 ? NESTED : "inherit",
        }}
      >
        {renderFormattedInlineText(line)}
      </div>,
    );
    lineIdx += 1;
  }

  return (
    <div
      className={className ? `hg-markdown ${className}` : "hg-markdown"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        maxWidth: "100%",
        lineHeight: "1.6",
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {nodes}
    </div>
  );
}
