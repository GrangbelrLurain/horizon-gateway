import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { HUB_DATA_CHANGED, type HubDataChangedReason } from "@/shared/lib/tauri/hubEvents";

let subscriberCount = 0;
let unlistenHub: (() => void) | null = null;

export function useHubDataSubscription(onDataChanged: (reason?: HubDataChangedReason) => Promise<void>) {
  useEffect(() => {
    subscriberCount++;
    if (subscriberCount === 1) {
      void onDataChanged();
      void listen(HUB_DATA_CHANGED, (event) => {
        const reason = (event.payload as { reason?: HubDataChangedReason } | undefined)?.reason;
        void onDataChanged(reason);
      }).then((fn) => {
        unlistenHub = fn;
      });
    }

    return () => {
      subscriberCount--;
      if (subscriberCount === 0 && unlistenHub) {
        unlistenHub();
        unlistenHub = null;
      }
    };
  }, [onDataChanged]);
}
