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

export function normalizeCalendarFeedUrl(value: string) {
  const normalized = value.trim().replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Enter a valid Schoology calendar link.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Calendar feeds must use a secure HTTPS connection.");
  }
  if (
    url.hostname !== "schoology.com" &&
    !url.hostname.endsWith(".schoology.com")
  ) {
    throw new Error("Use a Schoology calendar feed link.");
  }
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error(
      "Use the original Schoology calendar link without added credentials or ports.",
    );
  }
  if (!url.pathname.toLowerCase().endsWith(".ics")) {
    throw new Error("The Schoology link must point to an .ics calendar feed.");
  }
  return url.toString();
}

export async function importCalendarUrl(value: string) {
  const url = normalizeCalendarFeedUrl(value);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "text/calendar, text/plain;q=0.9" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Schoology returned HTTP ${response.status}.`);
    }
    const source = await response.text();
    if (source.length > 2_000_000) {
      throw new Error(
        "This calendar feed is too large to import in the browser.",
      );
    }
    const events = parseICalendar(source);
    if (!events.length) {
      throw new Error("No calendar events were found in that feed.");
    }
    return events;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The calendar request timed out. Try importing a downloaded .ics file.",
        { cause: error },
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Schoology blocked the browser request (CORS). Download its .ics file and import that instead.",
        { cause: error },
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
