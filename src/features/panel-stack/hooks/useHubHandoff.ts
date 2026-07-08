import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import type { ApiExchangeHandoff, HubHandoff, HubHandoffKind } from "../lib/hubHandoff";
import { hubHandoffAtom, hubHandoffConsumedIdAtom } from "../store";

export function useHubHandoffValue(): HubHandoff | null {
  return useAtomValue(hubHandoffAtom);
}

export function useConsumeHubHandoff<K extends HubHandoffKind>(kind: K): Extract<HubHandoff, { kind: K }> | null {
  const handoff = useAtomValue(hubHandoffAtom);
  const [consumedId, setConsumedId] = useAtom(hubHandoffConsumedIdAtom);
  const appliedRef = useRef<string | null>(null);

  const matched =
    handoff && handoff.kind === kind && consumedId !== handoff.id
      ? (handoff as Extract<HubHandoff, { kind: K }>)
      : null;

  useEffect(() => {
    if (matched && appliedRef.current !== matched.id) {
      appliedRef.current = matched.id;
      setConsumedId(matched.id);
    }
  }, [matched, setConsumedId]);

  return matched;
}

/** Runs apply once per handoff id when an api-exchange handoff arrives. */
export function useApiExchangeHandoffEffect(apply: (handoff: ApiExchangeHandoff) => void): void {
  const handoff = useConsumeHubHandoff("api-exchange");
  const appliedRef = useRef<string | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!handoff || appliedRef.current === handoff.id) {
      return;
    }
    appliedRef.current = handoff.id;
    applyRef.current(handoff);
  }, [handoff]);
}

export function useClearHubHandoff() {
  const [, setHandoff] = useAtom(hubHandoffAtom);
  const [, setConsumedId] = useAtom(hubHandoffConsumedIdAtom);

  return () => {
    setHandoff(null);
    setConsumedId(null);
  };
}
