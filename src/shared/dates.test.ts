import { describe, expect, it } from "vitest";
import { bucketOf, isOverdue, todayStr, weekDays, weekRange, type BucketInput } from "./dates";

// Среда, 18 ноября 2026. Неделя: пн 16 – вс 22.
const NOW = new Date(2026, 10, 18, 12, 0, 0);

const task = (over: Partial<BucketInput> = {}): BucketInput => ({
  done: false,
  bucket: "later",
  due_date: null,
  project_id: null,
  ...over,
});

describe("todayStr / weekRange", () => {
  it("форматирует локальную дату", () => {
    expect(todayStr(NOW)).toBe("2026-11-18");
  });

  it("неделя идёт с понедельника по воскресенье", () => {
    expect(weekRange(NOW)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(weekDays(NOW)).toHaveLength(7);
    expect(weekDays(NOW)[0]).toBe("2026-11-16");
    expect(weekDays(NOW)[6]).toBe("2026-11-22");
  });

  it("воскресенье относится к текущей неделе, понедельник — уже к новой", () => {
    expect(weekRange(new Date(2026, 10, 22, 23, 30))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(weekRange(new Date(2026, 10, 23, 0, 5))).toEqual({ from: "2026-11-23", to: "2026-11-29" });
  });
});

describe("bucketOf", () => {
  it("сегодня: bucket=today", () => {
    expect(bucketOf(task({ bucket: "today" }), NOW)).toBe("today");
  });

  it("сегодня: due_date = сегодня", () => {
    expect(bucketOf(task({ due_date: "2026-11-18" }), NOW)).toBe("today");
  });

  it("просрочено попадает в «Сегодня»", () => {
    const t = task({ bucket: "week", due_date: "2026-11-10" });
    expect(bucketOf(t, NOW)).toBe("today");
    expect(isOverdue(t, NOW)).toBe(true);
    expect(isOverdue(task({ due_date: "2026-11-18" }), NOW)).toBe(false);
  });

  it("неделя: bucket=week без даты", () => {
    expect(bucketOf(task({ bucket: "week" }), NOW)).toBe("week");
  });

  it("неделя: due_date внутри текущей недели при bucket=later", () => {
    expect(bucketOf(task({ due_date: "2026-11-19" }), NOW)).toBe("week");
  });

  it("граница: воскресенье ещё неделя, понедельник — уже «Потом»", () => {
    expect(bucketOf(task({ due_date: "2026-11-22" }), NOW)).toBe("week");
    expect(bucketOf(task({ due_date: "2026-11-23" }), NOW)).toBe("later");
  });

  it("потом: всё остальное", () => {
    expect(bucketOf(task({ bucket: "later" }), NOW)).toBe("later");
    expect(bucketOf(task({ bucket: "later", due_date: "2026-12-31" }), NOW)).toBe("later");
  });

  it("входящие: bucket=inbox без даты и проекта", () => {
    expect(bucketOf(task({ bucket: "inbox" }), NOW)).toBe("inbox");
  });

  it("inbox с проектом или с датой — не входящие", () => {
    expect(bucketOf(task({ bucket: "inbox", project_id: "p1" }), NOW)).toBe("later");
    expect(bucketOf(task({ bucket: "inbox", due_date: "2026-12-31" }), NOW)).toBe("later");
    expect(bucketOf(task({ bucket: "inbox", due_date: "2026-11-20" }), NOW)).toBe("week");
  });

  it("выполненные задачи вне бакетов", () => {
    expect(bucketOf(task({ done: true, bucket: "today" }), NOW)).toBeNull();
  });
});
