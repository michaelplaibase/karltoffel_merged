export const DEFAULT_CALENDAR_TASK_DURATION_MIN = 60;

export function effectiveCalendarTaskDuration(value: number | null | undefined): number {
  return value == null || value === 0 ? DEFAULT_CALENDAR_TASK_DURATION_MIN : value;
}
