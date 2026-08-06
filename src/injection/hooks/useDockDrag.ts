import type React from "react";
import { useEffect, useRef, useState } from "react";

export function useDockDrag() {
  const [dragOffset, setDragOffset] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 400);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsDocked(false);
    hasMoved.current = false;
    setDragStart({
      x: e.clientX + dragOffset.x,
      y: window.innerHeight - e.clientY - dragOffset.y,
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging) {
        return;
      }
      const newX = dragStart.x - e.clientX;
      const newY = window.innerHeight - e.clientY - dragStart.y;

      if (Math.abs(newX - dragOffset.x) > 3 || Math.abs(newY - dragOffset.y) > 3) {
        hasMoved.current = true;
      }

      setDragOffset({
        x: Math.max(0, Math.min(window.innerWidth - 50, newX)),
        y: Math.max(10, Math.min(window.innerHeight - 50, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (dragOffset.x <= 20) {
        setIsDocked(true);
        setDragOffset((prev) => ({ ...prev, x: 0 }));
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, dragOffset]);

  return {
    dragOffset,
    setDragOffset,
    isDragging,
    hasMoved,
    isDocked,
    setIsDocked,
    isCompact,
    setIsCompact,
    isHovered,
    handleMouseEnter,
    handleMouseLeave,
    handleDragStart,
  };
}
