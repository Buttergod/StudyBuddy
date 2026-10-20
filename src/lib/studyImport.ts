import { parse as parseJavaScript } from "acorn";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";

export type ImportedCard = { front: string; back: string };
export type ImportedDeck = { title: string; cards: ImportedCard[] };

type RecordValue = Record<string, unknown>;
type AstNode = Record<string, unknown>;
type XmlNode = Record<string, unknown>;

const supportedExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "js",
  "mjs",
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "xlsm",
  "html",
  "htm",
]);

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function cleanTitle(value: string) {
  return (
    value
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Imported study material"
  );
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return (
    [...letters].reduce(
      (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: false,
});

function parseXml(source: string) {
  if (XMLValidator.validate(source) !== true) {
    throw new Error("This document contains unreadable XML.");
  }
  return xmlParser.parse(source) as XmlNode;
}

function xmlElements(parent: unknown, name: string): unknown[] {
  const found: unknown[] = [];
  function visit(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === name) {
        if (Array.isArray(value)) found.push(...value);
        else found.push(value);
      }
      visit(value);
    }
  }
  visit(parent);
  return found;
}

function xmlText(node: unknown) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isRecord(node) && typeof node["#text"] === "string") return node["#text"];
  return "";
}

function xmlParagraphs(
  source: string,
  paragraphName: string,
  textName: string,
) {
  const document = parseXml(source);
  const paragraphs = xmlElements(document, paragraphName);
  const extracted = paragraphs.map((paragraph) =>
    xmlElements(paragraph, textName).map(xmlText).join("").trim(),
  );
  return extracted.filter(Boolean);
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function zipText(files: Record<string, Uint8Array>, path: string) {
  const data = files[normalizeZipPath(path)];
  return data ? strFromU8(data) : "";
}

function parseCsvRows(source: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function cardsFromRows(rows: string[][]): ImportedCard[] {
  if (!rows.length) return [];
  const labels = rows[0].map((value) => value.toLowerCase().trim());
  const frontLabels = ["front", "term", "word", "question", "prompt", "root"];
  const backLabels = ["back", "definition", "meaning", "answer", "explanation"];
  const frontColumn = labels.findIndex((label) => frontLabels.includes(label));
  const backColumn = labels.findIndex((label) => backLabels.includes(label));
  const hasHeader = frontColumn >= 0 && backColumn >= 0;
  const left = hasHeader ? frontColumn : 0;
  const right = hasHeader ? backColumn : 1;
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((row) => ({ front: row[left] ?? "", back: row[right] ?? "" }))
    .filter((card) => card.front.length > 0 && card.back.length > 0);
}

function cardsFromText(source: string): ImportedCard[] {
  const paired = source
    .split(/\r?\n/)
    .map((line) => {
      const match = line
        .trim()
        .match(/^(?:[-*]\s*)?(.{1,90}?)\s*(?:\t+|[-–—:]\s+)\s*(.{3,})$/);
      return match
        ? {
            front: match[1].replace(/^#+\s*/, "").trim(),
            back: match[2].trim(),
          }
        : null;
    })
    .filter((card): card is ImportedCard => card !== null);
  if (paired.length > 0) return paired;

  const blocks: { heading: string; body: string[] }[] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    if (heading || body.length) blocks.push({ heading, body });
    heading = "";
    body = [];
  };

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (!trimmed) {
      flush();
    } else if (match) {
      flush();
      heading = match[1].replace(/[*_`]/g, "").trim();
    } else {
      body.push(trimmed.replace(/^[-*+]\s+/, "").replace(/[*_`]/g, ""));
    }
  }
  flush();

  return blocks.flatMap((block) => {
    const paragraph = block.body.join(" ").trim();
    if (block.heading && paragraph)
      return [{ front: block.heading, back: paragraph }];
    const text = block.heading || paragraph;
    if (!text) return [];
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      return [{ front: sentences[0], back: sentences.slice(1).join(" ") }];
    }
    const front =
      text.length > 76 ? `${text.slice(0, 73).trim()}…` : `Recall: ${text}`;
    return [{ front, back: text }];
  });
}

function literalValue(value: unknown): unknown {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error(
      "The JavaScript file must contain a plain lesson_data object.",
    );
  }
  if (value.type === "Literal") return value.value;
  if (value.type === "ArrayExpression") {
    const elements = value.elements;
    if (!Array.isArray(elements))
      throw new Error("Invalid array in lesson data.");
    return elements.map(literalValue);
  }
  if (value.type === "ObjectExpression") {
    if (!Array.isArray(value.properties))
      throw new Error("Invalid object in lesson data.");
    const result: RecordValue = {};
    for (const item of value.properties) {
      if (
        !isRecord(item) ||
        item.type !== "Property" ||
        item.kind !== "init" ||
        item.computed === true ||
        item.method === true
      ) {
        throw new Error("Only plain object values are allowed in lesson_data.");
      }
      const keyNode = item.key;
      if (!isRecord(keyNode)) throw new Error("Invalid lesson data key.");
      const key = keyNode.type === "Identifier" ? keyNode.name : keyNode.value;
      if (typeof key !== "string" && typeof key !== "number")
        throw new Error("Invalid lesson data key.");
      result[String(key)] = literalValue(item.value);
    }
    return result;
  }
  if (value.type === "UnaryExpression" && value.operator === "-") {
    const number = literalValue(value.argument);
    if (typeof number === "number") return -number;
  }
  throw new Error(
    "The JavaScript file contains code that cannot be imported as lesson data.",
  );
}

function lessonDataValue(source: string) {
  const program = parseJavaScript(source, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as AstNode;
  if (!Array.isArray(program.body))
    throw new Error("Could not read JavaScript lesson data.");
  for (const statement of program.body) {
    if (!isRecord(statement)) continue;
    if (
      statement.type === "VariableDeclaration" &&
      Array.isArray(statement.declarations)
    ) {
      for (const declaration of statement.declarations) {
        if (!isRecord(declaration) || !isRecord(declaration.id)) continue;
        if (
          ["lesson_data", "lessonData"].includes(String(declaration.id.name))
        ) {
          return literalValue(declaration.init);
        }
      }
    }
    if (
      statement.type === "ExpressionStatement" &&
      isRecord(statement.expression)
    ) {
      const expression = statement.expression;
      if (
        expression.type === "AssignmentExpression" &&
        isRecord(expression.left) &&
        expression.left.type === "Identifier" &&
        ["lesson_data", "lessonData"].includes(String(expression.left.name))
      ) {
        return literalValue(expression.right);
      }
    }
  }
  throw new Error(
    "No lesson_data object was found. Use a JSON file or a JavaScript lesson_data assignment.",
  );
}

function objectCards(value: unknown): ImportedCard[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([front, rawBack]) => {
    if (typeof rawBack === "string" || typeof rawBack === "number") {
      return String(rawBack).trim()
        ? [{ front, back: String(rawBack).trim() }]
        : [];
    }
    if (!isRecord(rawBack)) return [];
    const definition =
      typeof rawBack.def === "string"
        ? rawBack.def
        : typeof rawBack.definition === "string"
          ? rawBack.definition
          : typeof rawBack.meaning === "string"
            ? rawBack.meaning
            : "";
    const partOfSpeech =
      typeof rawBack.ps === "string" ? `${rawBack.ps}: ` : "";
    const example =
      typeof rawBack.ex === "string" && rawBack.ex.trim()
        ? `\n\nExample: ${rawBack.ex.trim()}`
        : "";
    return definition.trim()
      ? [{ front, back: `${partOfSpeech}${definition.trim()}${example}` }]
      : [];
  });
}

function decksFromLessonValue(
  value: unknown,
  fallbackTitle: string,
): ImportedDeck[] {
  if (!isRecord(value)) return [];
  const lessons =
    "words" in value
      ? [[fallbackTitle, value] as const]
      : Object.entries(value).filter(
          ([, lesson]) => isRecord(lesson) && "words" in lesson,
        );
  if (!lessons.length) {
    const cards = objectCards(value);
    return cards.length ? [{ title: fallbackTitle, cards }] : [];
  }

  return lessons.flatMap(([lessonNumber, lesson]) => {
    if (!isRecord(lesson)) return [];
    const title =
      typeof lesson.title === "string"
        ? lesson.title
        : `Lesson ${lessonNumber}`;
    const cards = objectCards(lesson.words);
    if (isRecord(lesson.rps)) {
      for (const [key, label] of [
        ["roots", "Root"],
        ["prefixes", "Prefix"],
        ["suffixes", "Suffix"],
      ]) {
        cards.push(
          ...objectCards(lesson.rps[key]).map((card) => ({
            ...card,
            front: `${label}: ${card.front}`,
          })),
        );
      }
    }
    return cards.length ? [{ title, cards }] : [];
  });
}

function spreadsheetRows(files: Record<string, Uint8Array>) {
  const workbookText = zipText(files, "xl/workbook.xml");
  const relationshipsText = zipText(files, "xl/_rels/workbook.xml.rels");
  if (!workbookText || !relationshipsText)
    throw new Error("This spreadsheet is missing its workbook index.");
  const workbook = parseXml(workbookText);
  const sheet = xmlElements(workbook, "sheet")[0];
  if (!sheet) throw new Error("This spreadsheet has no worksheets.");
  const relationshipId = isRecord(sheet) ? sheet["@id"] : undefined;
  const relationships = parseXml(relationshipsText);
  const relation = xmlElements(relationships, "Relationship").find(
    (item) => isRecord(item) && item["@Id"] === relationshipId,
  );
  const target = isRecord(relation) ? relation["@Target"] : undefined;
  if (typeof target !== "string")
    throw new Error("Could not locate the first worksheet.");
  const sheetPath = normalizeZipPath(
    target.startsWith("/") ? target.slice(1) : `xl/${target}`,
  );
  const sheetXml = zipText(files, sheetPath);
  if (!sheetXml) throw new Error("The first worksheet could not be opened.");

  const sharedStringXml = zipText(files, "xl/sharedStrings.xml");
  const sharedStrings = sharedStringXml
    ? xmlElements(parseXml(sharedStringXml), "si").map((item) =>
        xmlElements(item, "t").map(xmlText).join(""),
      )
    : [];
  return xmlElements(parseXml(sheetXml), "row").map((row) => {
    const cells: string[] = [];
    for (const cell of xmlElements(row, "c")) {
      const reference =
        isRecord(cell) && typeof cell["@r"] === "string" ? cell["@r"] : "A1";
      const type = isRecord(cell) ? cell["@t"] : undefined;
      const value = xmlElements(cell, type === "inlineStr" ? "t" : "v")
        .map(xmlText)
        .join("");
      cells[columnIndex(reference)] =
        type === "s" ? (sharedStrings[Number(value)] ?? "") : value;
    }
    return cells.map((cell) => cell ?? "");
  });
}

async function fileText(file: File, extension: string) {
  if (
    ["txt", "md", "markdown", "csv", "tsv", "json", "js", "mjs"].includes(
      extension,
    )
  )
    return file.text();
  if (["html", "htm"].includes(extension)) {
    const document = new DOMParser().parseFromString(
      await file.text(),
      "text/html",
    );
    document
      .querySelectorAll("script, style, noscript")
      .forEach((node) => node.remove());
    return document.body.innerText || document.body.textContent || "";
  }
  const data = new Uint8Array(await file.arrayBuffer());
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
      .default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
    }
    return pages.join("\n\n");
  }

  const files = unzipSync(data);
  if (extension === "docx") {
    const document = zipText(files, "word/document.xml");
    if (!document)
      throw new Error("This Word document has no readable document body.");
    return xmlParagraphs(document, "p", "t").join("\n\n");
  }
  if (extension === "pptx") {
    const slides = Object.keys(files)
      .map((path) => ({
        path,
        number: path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1],
      }))
      .filter((item): item is { path: string; number: string } =>
        Boolean(item.number),
      )
      .sort((left, right) => Number(left.number) - Number(right.number));
    return slides
      .map(({ path }) =>
        xmlParagraphs(zipText(files, path), "p", "t").join("\n"),
      )
      .join("\n\n");
  }
  if (extension === "xlsx" || extension === "xlsm") {
    return spreadsheetRows(files)
      .map((row) => row.join("\t"))
      .join("\n");
  }
  throw new Error(`.${extension} files are not supported yet.`);
}

function decksFromJson(source: string, title: string): ImportedDeck[] {
  const value: unknown = JSON.parse(source);
  const lessonDecks = decksFromLessonValue(value, title);
  if (lessonDecks.length) return lessonDecks;
  if (Array.isArray(value)) {
    const cards = value.flatMap((item) => {
      if (!isRecord(item)) return [];
      const front = item.front ?? item.term ?? item.word ?? item.question;
      const back = item.back ?? item.definition ?? item.meaning ?? item.answer;
      return typeof front === "string" && typeof back === "string"
        ? [{ front, back }]
        : [];
    });
    return cards.length ? [{ title, cards }] : [];
  }
  return [];
}

async function parseFile(
  file: File,
  defaultTitle: string,
): Promise<ImportedDeck[]> {
  const extension = fileExtension(file.name);
  if (!supportedExtensions.has(extension)) {
    throw new Error(
      `.${extension || "unknown"} is not supported. Try PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, HTML, JSON, or lessondata.js.`,
    );
  }
  const title = cleanTitle(file.name) || defaultTitle;
  if (extension === "json") return decksFromJson(await file.text(), title);
  if (extension === "js" || extension === "mjs")
    return decksFromLessonValue(lessonDataValue(await file.text()), title);

  const text = await fileText(file, extension);
  const rows =
    extension === "csv"
      ? parseCsvRows(text, ",")
      : extension === "tsv" || ["xlsx", "xlsm"].includes(extension)
        ? parseCsvRows(text, "\t")
        : [];
  const cards = cardsFromRows(rows);
  const parsedCards = cards.length ? cards : cardsFromText(text);
  return parsedCards.length ? [{ title, cards: parsedCards }] : [];
}

export async function importStudyFiles(
  files: File[],
  course: string,
): Promise<ImportedDeck[]> {
  const decks: ImportedDeck[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const parsed = await parseFile(file, course);
      if (!parsed.length) {
        errors.push(`${file.name}: no study cards could be found.`);
        continue;
      }
      decks.push(...parsed);
    } catch (error) {
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : "could not be read."}`,
      );
    }
  }
  if (!decks.length)
    throw new Error(
      errors.join(" ") || "No study cards could be created from those files.",
    );
  return decks;
}

export async function importStudyText(
  text: string,
  course: string,
): Promise<ImportedDeck[]> {
  const isLessonData =
    /\b(?:const|let|var)\s+lesson_data\b|\blesson_data\s*=/.test(text);
  const name = isLessonData ? "pasted-lessondata.js" : "pasted-study-notes.txt";
  return importStudyFiles(
    [new File([text], name, { type: "text/plain" })],
    course,
  );
}
