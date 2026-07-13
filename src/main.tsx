import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./global.css";
import "./routes/hub/registerRouteSurfaces";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Safe Mode: Reset experimental settings if Shift key is pressed during startup
const handleSafeMode = (e: KeyboardEvent) => {
  if (e.shiftKey) {
    console.warn("Safe Mode detected via Shift key. Resetting experimental features.");
    localStorage.removeItem("horizon-experimental-ai-autocomplete");
    localStorage.removeItem("horizon-experimental-custom-theme");
    alert("Safe Mode Activated: Experimental features have been reset to prevent crashes.");
    window.removeEventListener("keydown", handleSafeMode);
  }
};
window.addEventListener("keydown", handleSafeMode);
setTimeout(() => {
  window.removeEventListener("keydown", handleSafeMode);
}, 3000);

// Render the app
const rootElement = document.getElementById("root");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
