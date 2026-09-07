import { describe, expect, test } from "bun:test";
import { parseCues, parseSimple, parseSrt, printSimple } from "@shared/subtitles";

describe("subtitles", () => {
  test("простой формат: секунды и мм:сс, сортировка, пропуск мусора", () => {
    const cues = parseSimple("2 4 Второй\n0:00.5 1.5 Первый\\nстрока\nмусор\n5 4 неверно");
    expect(cues.map((c) => c.text)).toEqual(["Первый\nстрока", "Второй"]);
    expect(cues[0]?.start).toBe(0.5);
  });
  test("SRT: сортировка и отбраковка перевёрнутых интервалов", () => {
    const cues = parseSrt("2\n00:00:03,000 --> 00:00:04,000\nПока\n\n1\n00:00:01,000 --> 00:00:02,500\nПривет\nмир\n\n3\n00:00:09,000 --> 00:00:08,000\nНеверно\n");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 2.5, text: "Привет\nмир" });
  });
  test("parseCues выбирает формат по строке со временем, а не по стрелке в тексте", () => {
    expect(printSimple(parseCues("1 2 Один"))).toBe("1.00 2.00 Один");
    expect(parseCues("1 2 Идём --> туда")).toHaveLength(1);
    expect(parseCues("00:00:01,000 --> 00:00:02,000\nX")).toHaveLength(1);
  });
});
