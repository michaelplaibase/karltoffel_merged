export const DEFAULT_CALENDAR_TASK_DURATION_MIN = 60;

export function effectiveCalendarTaskDuration(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_CALENDAR_TASK_DURATION_MIN;
}