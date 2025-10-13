import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type CalendarView = "month" | "week" | "day";

export function getViewRange(view: CalendarView, reference: Date) {
  switch (view) {
    case "day": {
      const start = startOfDay(reference);
      const end = endOfDay(reference);
      return { from: start, to: end };
    }
    case "week": {
      const start = startOfWeek(reference, { weekStartsOn: 1 });
      const end = endOfWeek(reference, { weekStartsOn: 1 });
      return { from: start, to: end };
    }
    case "month":
    default: {
      const start = startOfWeek(startOfMonth(reference), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(reference), { weekStartsOn: 1 });
      return { from: start, to: end };
    }
  }
}

export function moveByView(view: CalendarView, current: Date, direction: 1 | -1) {
  if (view === "day") {
    return addDays(current, direction);
  }
  if (view === "week") {
    return addWeeks(current, direction);
  }
  return addMonths(current, direction);
}
