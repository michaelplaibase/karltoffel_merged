type PreviewSuggestion = {
  sourceWeek: string;
  previewWeek: string;
  sourceWeekdayOverridden: boolean;
  reason: "invalid_source_weekday_reassigned" | "capacity_overflow_rebalanced" | "capacity_deferred_to_next_week" | null;
};

export function previewSuggestionText(input: PreviewSuggestion): string | null {
  const weekMoved = input.sourceWeek !== input.previewWeek || input.reason === "capacity_deferred_to_next_week";
  if (!weekMoved && !input.sourceWeekdayOverridden) return null;
  const movement = weekMoved && input.sourceWeekdayOverridden ? "uge og ugedag flyttet" : weekMoved ? "uge flyttet" : "ugedag flyttet";
  return `Automatisk forslag · kilde ${input.sourceWeek} · preview ${input.previewWeek} · ${movement}`;
}
