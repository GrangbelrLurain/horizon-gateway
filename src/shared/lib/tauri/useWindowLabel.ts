import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function useWindowLabel() {
  const [label, setLabel] = useState("main");

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  return label;
}
