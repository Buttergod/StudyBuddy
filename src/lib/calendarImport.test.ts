import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importCalendarUrl,
  normalizeCalendarFeedUrl,
  parseICalendar,
} from "./calendarImport";

afterEach(() => vi.unstubAllGlobals());

describe("Schoology calendar imports", () => {
  it("converts a Schoology webcal link to secure HTTPS", () => {
    expect(
      normalizeCalendarFeedUrl(
        "webcal://henrico.schoology.com/calendar/feed/ical/123/token/ical.ics",
      ),
    ).toBe(
      "https://henrico.schoology.com/calendar/feed/ical/123/token/ical.ics",
    );
  });

  it("rejects calendar URLs that are not Schoology HTTPS feeds", () => {
    expect(() =>
      normalizeCalendarFeedUrl("https://example.com/calendar.ics"),
    ).toThrow("Use a Schoology calendar feed link.");
  });

  it("fetches feeds without cookies or redirects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:quiz-1\nDTSTART;VALUE=DATE:20261022\nSUMMARY:Biology quiz\nEND:VEVENT\nEND:VCALENDAR",
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const events = await importCalendarUrl(
      "webcal://henrico.schoology.com/calendar/feed/ical/123/example/ical.ics",
    );

    expect(events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://henrico.schoology.com/calendar/feed/ical/123/example/ical.ics",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      }),
    );
  });

  it("explains when the browser blocks a feed request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(
      importCalendarUrl(
        "https://henrico.schoology.com/calendar/feed/ical/123/example/ical.ics",
      ),
    ).rejects.toThrow("CORS");
  });

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
