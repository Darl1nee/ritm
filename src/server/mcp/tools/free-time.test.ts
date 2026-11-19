import { describe, expect, it } from "vitest";
import { busyOfEvent, freeWindowsForDay, localMs, type BusyInterval } from "./free-time";

const at = (h: number, m = 0, day = 19) => new Date(2026, 10, day, h, m).getTime();
const iso = (h: number, m = 0, day = 19) => new Date(2026, 10, day, h, m).toISOString();
const PAST = new Date(2026, 10, 1, 8, 0); // давно прошло
const base = { date: "2026-11-19", dayStart: "09:00", dayEnd: "21:00", minMinutes: 30, now: PAST };

describe("freeWindowsForDay", () => {
  it("весь день свободен, если событий нет", () => {
    expect(freeWindowsForDay({ ...base, busy: [] })).toEqual([{ start: "09:00", end: "21:00", minutes: 720 }]);
  });

  it("вычитает события и сливает пересекающиеся", () => {
    const busy: BusyInterval[] = [
      { start: at(10), end: at(11) },
      { start: at(10, 30), end: at(12) }, // пересекается с первым
      { start: at(12), end: at(13) }, // стык
      { start: at(15), end: at(16) },
    ];
    expect(freeWindowsForDay({ ...base, busy })).toEqual([
      { start: "09:00", end: "10:00", minutes: 60 },
      { start: "13:00", end: "15:00", minutes: 120 },
      { start: "16:00", end: "21:00", minutes: 300 },
    ]);
  });

  it("обрезает события по границам дня и отбрасывает короткие окна", () => {
    const busy: BusyInterval[] = [
      { start: at(7), end: at(9, 20) }, // залезает на начало
      { start: at(9, 40), end: at(20, 50) }, // между ними 20 минут < 30
      { start: at(20, 40), end: at(23) }, // залезает на конец
    ];
    expect(freeWindowsForDay({ ...base, busy })).toEqual([]);
    expect(freeWindowsForDay({ ...base, minMinutes: 15, busy })).toEqual([{ start: "09:20", end: "09:40", minutes: 20 }]);
  });

  it("событие на весь день занимает весь день", () => {
    const busy = [busyOfEvent({ start_at: iso(0), end_at: iso(0), all_day: true })];
    expect(freeWindowsForDay({ ...base, busy })).toEqual([]);
    // многодневное: следующий день тоже занят, а день после конца — свободен
    const multi = [busyOfEvent({ start_at: iso(0, 0, 18), end_at: iso(23, 59, 19), all_day: true })];
    expect(freeWindowsForDay({ ...base, busy: multi })).toEqual([]);
    expect(freeWindowsForDay({ ...base, date: "2026-11-20", busy: multi })).toHaveLength(1);
  });

  it("для сегодняшнего дня не предлагает прошлое", () => {
    const now = new Date(2026, 10, 19, 14, 10, 20);
    expect(freeWindowsForDay({ ...base, now, busy: [{ start: at(15), end: at(16) }] })).toEqual([
      { start: "14:11", end: "15:00", minutes: 49 },
      { start: "16:00", end: "21:00", minutes: 300 },
    ]);
    expect(freeWindowsForDay({ ...base, now: new Date(2026, 10, 19, 21, 5), busy: [] })).toEqual([]);
    // прошедший день — пусто
    expect(freeWindowsForDay({ ...base, now: new Date(2026, 10, 20, 8, 0), busy: [] })).toEqual([]);
  });

  it("свой диапазон часов и 24:00", () => {
    expect(freeWindowsForDay({ ...base, dayStart: "08:30", dayEnd: "24:00", busy: [] })).toEqual([
      { start: "08:30", end: "00:00", minutes: 930 },
    ]);
    expect(localMs("2026-11-19", "24:00")).toBe(at(0, 0, 20));
  });
});
