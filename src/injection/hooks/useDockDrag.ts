import type React from "react";
import { useEffect, useRef, useState } from "react";

function getClientPos(
  e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
): { x: number; y: number } | null {
  if ("touches" in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if ("clientX" in e && typeof e.clientX === "number") {
    return { x: e.clientX, y: e.clientY };
  }
  return null;
}

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

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getClientPos(e);
    if (!pos) {
      return;
    }

    setIsDragging(true);
    setIsDocked(false);
    hasMoved.current = false;
    setDragStart({
      x: pos.x + dragOffset.x,
      y: window.innerHeight - pos.y - dragOffset.y,
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) {
        return;
      }

      const pos = getClientPos(e);
      if (!pos) {
        return;
      }

      if ("cancelable" in e && e.cancelable) {
        e.preventDefault();
      }

      const newX = dragStart.x - pos.x;
      const newY = window.innerHeight - pos.y - dragStart.y;

      if (Math.abs(newX - dragOffset.x) > 3 || Math.abs(newY - dragOffset.y) > 3) {
        hasMoved.current = true;
      }

      setDragOffset({
        x: Math.max(0, Math.min(window.innerWidth - 50, newX)),
        y: Math.max(10, Math.min(window.innerHeight - 50, newY)),
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      if (dragOffset.x <= 20) {
        setIsDocked(true);
        setDragOffset((prev) => ({ ...prev, x: 0 }));
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
      window.addEventListener("touchcancel", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("touchcancel", handleDragEnd);
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
