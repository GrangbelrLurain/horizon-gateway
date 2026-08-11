import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  codeStyle?: React.CSSProperties;
}

/**
 * Helper to format code text so long paths break cleanly after slashes or dots
 * without breaking normal words awkwardly in the middle.
 */
function formatCodePathText(text: string): string {
  // Insert zero-width space (\u200B) after slashes and dots to allow smart line breaks
  return text.replace(/([/._])/g, "$1\u200B");
}

/**
 * Lightweight, safe Markdown renderer component for description fields.
 * Supports inline code, bold, italic, links, lists, line breaks, and smart path overflow protection.
 */
export function MarkdownRenderer({ content, className = "", style = {}, codeStyle }: MarkdownRendererProps) {
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
            padding: "2px 6px",
            margin: "0 2px",
            fontSize: "0.85em",
            fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
            backgroundColor: "rgba(99, 102, 241, 0.12)",
            color: "#a5b4fc",
            borderRadius: "6px",
            border: "1px solid rgba(165, 180, 252, 0.22)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
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
      tokens.push(
        <a
          key={`${keyPrefix}-link-${linkMatch.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#60a5fa", textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
          {linkText}
        </a>,
      );

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
              <strong key={`b-${i}`} style={{ fontWeight: 700, color: "#f8fafc" }}>
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
                    <em key={`i-${j}`} style={{ fontStyle: "italic", opacity: 0.9 }}>
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

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        maxWidth: "100%",
        lineHeight: "1.6",
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={`line-${lineIdx}`} style={{ height: "4px" }} />;
        }

        const leadingWhitespaceMatch = line.match(/^[\s\t]+/);
        const leadingSpaces = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].replace(/\t/g, "  ").length : 0;
        const indentLevel = Math.max(0, Math.floor(leadingSpaces / 2));

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const paddingLeft = indentLevel > 0 ? `${14 + indentLevel * 14}px` : "6px";
          return (
            <div
              key={`line-${lineIdx}`}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
                paddingLeft,
                marginTop: "2px",
                marginBottom: "2px",
              }}
            >
              <span style={{ color: "#60a5fa", opacity: 0.85, fontSize: "1.1em", lineHeight: "1.4" }}>•</span>
              <div style={{ flex: 1, minWidth: 0, color: indentLevel > 0 ? "rgba(241, 245, 249, 0.88)" : "inherit" }}>
                {renderFormattedInlineText(trimmed.replace(/^[-*\u2022]\s*/, "").replace(/^[-*\u2022]\s*/, ""))}
              </div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const rest = numMatch[2];
          const paddingLeft = indentLevel > 0 ? `${14 + indentLevel * 14}px` : "2px";
          return (
            <div
              key={`line-${lineIdx}`}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
                paddingLeft,
                marginTop: "4px",
                marginBottom: "3px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(59, 130, 246, 0.18)",
                  border: "1px solid rgba(96, 165, 250, 0.35)",
                  color: "#93c5fd",
                  fontSize: "10px",
                  fontWeight: "800",
                  fontFamily: "monospace",
                  flexShrink: 0,
                  marginTop: "3px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                {num}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>{renderFormattedInlineText(rest)}</div>
            </div>
          );
        }

        const paddingLeft = indentLevel > 0 ? `${14 + indentLevel * 14}px` : "0px";
        return (
          <div key={`line-${lineIdx}`} style={{ minWidth: 0, paddingLeft }}>
            {renderFormattedInlineText(line)}
          </div>
        );
      })}
    </div>
  );
}
