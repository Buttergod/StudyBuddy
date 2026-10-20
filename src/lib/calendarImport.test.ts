import { describe, expect, it } from "vitest";
import { parseICalendar } from "./calendarImport";

describe("Schoology calendar imports", () => {
  it("reads, unescapes, sorts, and deduplicates iCalendar events", () => {
    const source = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:assignment-1
DTSTART;VALUE=DATE:20261022
DTEND;VALUE=DATE:20261023
SUMMARY:Biology\\, cell quiz
DESCRIPTION:Review cells\\nand organelles
END:VEVENT
BEGIN:VEVENT
UID:assignment-1
DTSTART;VALUE=DATE:20261022
SUMMARY:duplicate
END:VEVENT
END:VCALENDAR`;

    const events = parseICalendar(source);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Biology, cell quiz");
    expect(events[0].description).toBe("Review cells\nand organelles");
    expect(events[0].allDay).toBe(true);
    expect(new Date(events[0].startsAt).getDate()).toBe(22);
  });

  it("ignores cancelled or undated events", () => {
    const source = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cancelled
DTSTART;VALUE=DATE:20261023
STATUS:CANCELLED
SUMMARY:Cancelled test
END:VEVENT
BEGIN:VEVENT
UID:no-date
SUMMARY:Missing date
END:VEVENT
END:VCALENDAR`;

    expect(parseICalendar(source)).toEqual([]);
  });
});
