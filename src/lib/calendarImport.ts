export type StudyCalendarEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

type CalendarProperty = { params: string[]; value: string };

function unescapeCalendarText(value: string) {
  return value
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function propertiesFromEvent(lines: string[]) {
  const properties = new Map<string, CalendarProperty>();
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const [name = "", ...params] = line.slice(0, separator).split(";");
    properties.set(name.toUpperCase(), {
      params,
      value: line.slice(separator + 1),
    });
  }
  return properties;
}

function parseCalendarDate(property: CalendarProperty | undefined) {
  if (!property) return null;
  const digits = property.value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/,
  );
  if (!digits) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0", utc] =
    digits;
  const isDate =
    property.params.some((param) => param.toUpperCase() === "VALUE=DATE") ||
    !property.value.includes("T");
  const date = utc
    ? new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
        ),
      )
    : new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      );
  return Number.isNaN(date.getTime()) ? null : { date, allDay: isDate };
}

function parseEvent(lines: string[]): StudyCalendarEvent | null {
  const properties = propertiesFromEvent(lines);
  if (properties.get("STATUS")?.value.toUpperCase() === "CANCELLED")
    return null;
  const start = parseCalendarDate(properties.get("DTSTART"));
  if (!start) return null;
  const end = parseCalendarDate(properties.get("DTEND"));
  const title = unescapeCalendarText(
    properties.get("SUMMARY")?.value ?? "School event",
  ).trim();
  const description = unescapeCalendarText(
    properties.get("DESCRIPTION")?.value ?? "",
  ).trim();
  const endDate =
    end?.date ??
    new Date(
      start.date.getTime() +
        (start.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000),
    );
  const uid = properties.get("UID")?.value.trim();
  return {
    id:
      uid ||
      `${start.date.toISOString()}-${title.toLowerCase().replace(/\W+/g, "-")}`,
    title,
    description,
    startsAt: start.date.toISOString(),
    endsAt: endDate.toISOString(),
    allDay: start.allDay,
  };
}

export function parseICalendar(source: string): StudyCalendarEvent[] {
  const lines = source.replace(/\r\n[ \t]|\n[ \t]/g, "").split(/\r?\n/);
  const events: StudyCalendarEvent[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.trim().toUpperCase() === "BEGIN:VEVENT") {
      current = [];
    } else if (line.trim().toUpperCase() === "END:VEVENT" && current) {
      const event = parseEvent(current);
      if (event) events.push(event);
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  const unique = new Map<string, StudyCalendarEvent>();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
}

export async function importCalendarFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".ics")) {
    throw new Error("Choose an iCalendar .ics file exported from Schoology.");
  }
  const events = parseICalendar(await file.text());
  if (!events.length)
    throw new Error("No calendar events were found in that file.");
  return events;
}
