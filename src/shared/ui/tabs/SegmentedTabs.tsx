import clsx from "clsx";
import type { ComponentType, KeyboardEvent, ReactNode } from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }> | ReactNode;
  badge?: number | string;
  badgeColor?: "primary" | "neutral" | "success" | "warning" | "error";
  disabled?: boolean;
}

export type TabsVariant = "segmented" | "underline" | "pills";
export type TabsSize = "xs" | "sm" | "md";

export interface SegmentedTabsProps<T extends string = string> {
  value: T;
  onChange: (id: T) => void;
  items: TabItem<T>[];
  variant?: TabsVariant;
  size?: TabsSize;
  fullWidth?: boolean;
  className?: string;
  tabListAriaLabel?: string;
}

const SIZE_STYLES: Record<TabsVariant, Record<TabsSize, string>> = {
  segmented: {
    xs: "text-[10px] py-0.5 px-2 gap-1 rounded-[5px]",
    sm: "text-xs py-1 px-2.5 gap-1.5 rounded-md",
    md: "text-xs py-1.5 px-3 gap-2 rounded-md font-medium",
  },
  underline: {
    xs: "text-[10px] py-1 px-2 gap-1",
    sm: "text-xs py-1.5 px-3 gap-1.5",
    md: "text-sm py-2 px-4 gap-2",
  },
  pills: {
    xs: "text-[10px] py-0.5 px-2 gap-1 rounded-full",
    sm: "text-xs py-1 px-2.5 gap-1.5 rounded-full",
    md: "text-xs py-1.5 px-3 gap-2 rounded-full font-medium",
  },
};

const CONTAINER_STYLES: Record<TabsVariant, string> = {
  segmented: "inline-flex items-center bg-base-200/70 p-0.5 rounded-lg border border-base-300/40",
  underline: "flex border-b border-base-300",
  pills: "inline-flex flex-wrap items-center gap-1",
};

const BADGE_COLOR_MAP: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  neutral: "bg-base-content/10 text-base-content/70",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
};

export function SegmentedTabs<T extends string = string>({
  value,
  onChange,
  items,
  variant = "segmented",
  size = "sm",
  fullWidth = false,
  className,
  tabListAriaLabel,
}: SegmentedTabsProps<T>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    const enabledItems = items.filter((item) => !item.disabled);
    if (enabledItems.length === 0) {
      return;
    }

    const currentIndex = enabledItems.findIndex((item) => item.id === value);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % enabledItems.length;
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = enabledItems.length - 1;
    }

    const nextItem = enabledItems[nextIndex];
    if (nextItem && nextItem.id !== value) {
      onChange(nextItem.id);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={tabListAriaLabel}
      onKeyDown={handleKeyDown}
      className={clsx(CONTAINER_STYLES[variant], fullWidth && "w-full flex", className)}
    >
      {items.map((item) => {
        const isSelected = item.id === value;
        const sizeClass = SIZE_STYLES[variant][size];

        let stateClass = "";
        if (variant === "segmented") {
          stateClass = isSelected
            ? "bg-base-100 text-base-content shadow-xs font-semibold"
            : "text-base-content/60 hover:text-base-content hover:bg-base-200/50 font-medium";
        } else if (variant === "underline") {
          stateClass = isSelected
            ? "border-b-2 border-primary text-primary font-semibold -mb-[1px]"
            : "border-b-2 border-transparent text-base-content/55 hover:text-base-content font-medium";
        } else if (variant === "pills") {
          stateClass = isSelected
            ? "border border-primary bg-primary/10 text-primary font-semibold"
            : "border border-base-300 text-base-content/60 hover:bg-base-200 font-medium";
        }

        const renderIcon = () => {
          if (!item.icon) {
            return null;
          }
          const icon = item.icon;
          const isComponent =
            typeof icon === "function" ||
            (typeof icon === "object" && icon !== null && "$$typeof" in icon && "render" in icon);
          if (isComponent) {
            const IconComponent = icon as ComponentType<{ className?: string }>;
            return <IconComponent className={clsx(size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5", "shrink-0")} />;
          }
          return icon as ReactNode;
        };

        const badgeBg = item.badgeColor
          ? BADGE_COLOR_MAP[item.badgeColor]
          : isSelected
            ? "bg-primary/15 text-primary"
            : "bg-base-content/10 text-base-content/60";

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={item.disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={clsx(
              "transition-all flex items-center justify-center cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed",
              fullWidth && "flex-1 min-w-0",
              sizeClass,
              stateClass,
            )}
          >
            {renderIcon()}
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && (
              <span className={clsx("font-bold text-[9px] px-1.5 py-0.2 rounded-full tabular-nums shrink-0", badgeBg)}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
