import type { ClassifierInput, NormalizedEvent } from "../supabase/functions/_shared/types.ts";

let n = 0;
export function ev(partial: Partial<NormalizedEvent> & { title: string }): NormalizedEvent {
  n++;
  return {
    id: partial.id ?? `ev_${n}`,
    ticker: "ENB",
    source: "mock",
    type: "news",
    summary: "",
    url: `https://example.com/story-${n}`,
    publisher: "Test Wire",
    publishedAt: "2026-10-20T14:00:00.000Z",
    ...partial,
  };
}

export function input(events: NormalizedEvent[], extra: Partial<ClassifierInput> = {}): ClassifierInput {
  return { ticker: events[0]?.ticker ?? "ENB", events, signals: [], ...extra };
}
