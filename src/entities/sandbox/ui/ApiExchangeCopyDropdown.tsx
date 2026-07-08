import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import type { ApiExchangeCopyInput } from "../lib/copyApiExchange";
import { copyApiExchangeAsCardHtml, copyApiExchangeAsMarkdown } from "../lib/copyApiExchange";

export interface ApiExchangeCopyDropdownLabels {
  btnCopy: string;
  copied: string;
  copyHtml: string;
  copyMarkdown: string;
}

interface ApiExchangeCopyDropdownProps {
  getInput: () => ApiExchangeCopyInput | null;
  labels: ApiExchangeCopyDropdownLabels;
  onCopied?: () => void;
}

export function ApiExchangeCopyDropdown({ getInput, labels, onCopied }: ApiExchangeCopyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markCopied = () => {
    setCopied(true);
    setIsOpen(false);
    onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = async () => {
    const input = getInput();
    if (!input) {
      return;
    }
    try {
      await copyApiExchangeAsCardHtml(input);
      markCopied();
    } catch (e) {
      console.error("Copy HTML failed:", e);
    }
  };

  const handleCopyMarkdown = async () => {
    const input = getInput();
    if (!input) {
      return;
    }
    try {
      await copyApiExchangeAsMarkdown(input);
      markCopied();
    } catch (e) {
      console.error("Copy Markdown failed:", e);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-8 font-bold"
        type="button"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-success" />
            <span className="text-success">{labels.copied}</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>{labels.btnCopy}</span>
            <ChevronDown className="w-3 h-3 text-base-content/40" />
          </>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 py-1 overflow-hidden backdrop-blur-md bg-base-100/95">
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-xs hover:bg-base-200 text-base-content font-bold transition-colors cursor-pointer"
            onClick={() => void handleCopyHtml()}
          >
            {labels.copyHtml}
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-xs hover:bg-base-200 border-t border-base-200 text-base-content font-bold transition-colors cursor-pointer"
            onClick={() => void handleCopyMarkdown()}
          >
            {labels.copyMarkdown}
          </button>
        </div>
      )}
    </div>
  );
}
