import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { importStudyFiles, importStudyText } from "./studyImport";

describe("study material imports", () => {
  it("creates a separate deck per lesson and includes roots and definitions", async () => {
    const source = `var lesson_data = {
      "1": {
        "words": { "paucity": { "ps": "noun", "def": "a scarcity, lack", "ex": "A paucity of rain." } },
        "rps": { "roots": { "mater": "mother" }, "prefixes": {}, "suffixes": {} }
      },
      "2": {
        "words": { "amalgamate": { "ps": "verb", "def": "to combine" } },
        "rps": { "roots": {}, "prefixes": {}, "suffixes": {} }
      }
    };`;

    const decks = await importStudyText(source, "Biology I Honors");

    expect(decks).toHaveLength(2);
    expect(decks[0].title).toBe("Lesson 1");
    expect(decks[0].cards).toEqual([
      {
        front: "paucity",
        back: "noun: a scarcity, lack\n\nExample: A paucity of rain.",
      },
      { front: "Root: mater", back: "mother" },
    ]);
    expect(decks[1].cards[0]).toEqual({
      front: "amalgamate",
      back: "verb: to combine",
    });
  });

  it("reads the lesson object without executing surrounding JavaScript", async () => {
    const source = `var lesson_data = { "1": { words: { "gird": { ps: "verb", def: "to prepare" } } } }; throw new Error("must not run");`;
    const file = new File([source], "lessondata.js", {
      type: "text/javascript",
    });

    const decks = await importStudyFiles([file], "English 9 Honors");

    expect(decks[0].cards[0].front).toBe("gird");
  });

  it("imports quoted CSV term and definition columns", async () => {
    const file = new File(
      [
        'term,definition\n"cell membrane","Controls what enters, and leaves the cell"',
      ],
      "biology.csv",
      { type: "text/csv" },
    );

    const decks = await importStudyFiles([file], "Biology I Honors");

    expect(decks[0].cards).toEqual([
      {
        front: "cell membrane",
        back: "Controls what enters, and leaves the cell",
      },
    ]);
  });

  it("turns colon-separated text pairs into cards", async () => {
    const file = new File(
      ["osmosis: water moving across a membrane\nmitosis: cell division"],
      "biology.txt",
      { type: "text/plain" },
    );

    const decks = await importStudyFiles([file], "Biology I Honors");

    expect(decks[0].cards).toEqual([
      { front: "osmosis", back: "water moving across a membrane" },
      { front: "mitosis", back: "cell division" },
    ]);
  });

  it("imports a single term-definition line", async () => {
    const file = new File(
      ["osmosis: water moving through a membrane"],
      "one.txt",
    );
    const decks = await importStudyFiles([file], "Biology I Honors");

    expect(decks[0].cards).toEqual([
      { front: "osmosis", back: "water moving through a membrane" },
    ]);
  });

  it("reads the first worksheet from an XLSX workbook", async () => {
    const workbook = zipSync({
      "xl/workbook.xml": strToU8(
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Biology" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>term</t></is></c><c r="B1" t="inlineStr"><is><t>definition</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>osmosis</t></is></c><c r="B2" t="inlineStr"><is><t>water moving across a membrane</t></is></c></row></sheetData></worksheet>',
      ),
    });
    const file = new File([workbook as unknown as BlobPart], "biology.xlsx");

    const decks = await importStudyFiles([file], "Biology I Honors");

    expect(decks[0].cards).toEqual([
      { front: "osmosis", back: "water moving across a membrane" },
    ]);
  });

  it("reports unsupported files rather than silently ignoring them", async () => {
    const file = new File(["image"], "diagram.png", { type: "image/png" });

    await expect(importStudyFiles([file], "Biology I Honors")).rejects.toThrow(
      ".png is not supported",
    );
  });
});
