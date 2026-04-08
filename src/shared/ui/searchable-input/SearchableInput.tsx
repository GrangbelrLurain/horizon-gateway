import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Input } from "@/shared/ui/input/Input";

interface SearchableInputContextValue {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onSelect: (item: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSelect: (item: string) => void;
  itemRef: React.RefObject<HTMLButtonElement | null>;
}

const SearchableInputContext = createContext<SearchableInputContextValue | null>(null);

function useSearchableInputContext() {
  const ctx = useContext(SearchableInputContext);
  if (!ctx) {
    throw new Error("SearchableInput compound components must be used within SearchableInput");
  }
  return ctx;
}

export interface SearchableInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onSelect: (item: string) => void;
  children: ReactNode;
}

export function SearchableInput({ value, onChange, suggestions, onSelect, children }: SearchableInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRef = useRef<HTMLButtonElement | null>(null);

  const handleSelect = useCallback(
    (item: string) => {
      onChange(item);
      onSelect(item);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange, onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || suggestions.length === 0) {
        return;
      }
      const len = suggestions.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < len - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : len - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < len) {
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [open, suggestions, highlightedIndex, handleSelect],
  );

  useEffect(() => {
    if (open && suggestions.length > 0) {
      setHighlightedIndex((prev) => (prev < 0 || prev >= suggestions.length ? 0 : prev));
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, suggestions]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const ctx: SearchableInputContextValue = {
    value,
    onChange,
    suggestions,
    onSelect,
    open,
    setOpen,
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    handleSelect,
    itemRef,
  };

  return <SearchableInputContext.Provider value={ctx}>{children}</SearchableInputContext.Provider>;
}

export interface SearchableInputInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {}

function SearchableInputInput({ onFocus, onBlur, ...props }: SearchableInputInputProps) {
  const { value, onChange, setOpen, handleKeyDown } = useSearchableInputContext();

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setOpen(true);
      }}
      onFocus={(e) => {
        setOpen(true);
        onFocus?.(e);
      }}
      onBlur={() => {
        setTimeout(() => setOpen(false), 150);
      }}
      onKeyDown={(e) => {
        handleKeyDown(e);
      }}
    />
  );
}

export interface SearchableInputDropdownProps {
  className?: string;
  itemClassName?: string;
  itemHighlightedClassName?: string;
  renderItem?: (item: string, options: { highlighted: boolean; onSelect: () => void }) => ReactNode;
}

function SearchableInputDropdown({
  className = "absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-base-200 bg-base-100 shadow-lg py-1",
  itemClassName = "w-full text-left px-3 py-2 text-sm text-base-content/80 hover:bg-primary/10 hover:text-primary transition-colors",
  itemHighlightedClassName = "bg-primary/10 text-primary",
  renderItem,
}: SearchableInputDropdownProps) {
  const { open, suggestions, highlightedIndex, handleSelect, itemRef } = useSearchableInputContext();

  if (!open || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {suggestions.map((item, i) => {
        const highlighted = i === highlightedIndex;
        if (renderItem) {
          return (
            <div key={item}>
              {renderItem(item, {
                highlighted,
                onSelect: () => handleSelect(item),
              })}
            </div>
          );
        }
        return (
          <button
            key={item}
            ref={highlighted ? itemRef : null}
            type="button"
            className={`${itemClassName} ${highlighted ? itemHighlightedClassName : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(item);
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

SearchableInput.Input = SearchableInputInput;
SearchableInput.Dropdown = SearchableInputDropdown;
