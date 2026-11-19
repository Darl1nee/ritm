import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import {
  createMcpToken,
  deleteMcpToken,
  hashToken,
  listMcpTokens,
  revokeMcpToken,
  updateMcpToken,
  verifyMcpToken,
} from "./mcp-tokens";
import { authenticateMcpRequest } from "../mcp/auth";
import { requireScopes, ScopeError, normalizeScopes } from "../mcp/scopes";
import { hostnameOf, isAllowedHost, isAllowedOrigin } from "@/shared/hosts";
import { mcp_tokens } from "../db/schema";

describe("mcp tokens", () => {
  it("создаёт ключ, хранит только хеш и находит его по открытому ключу", async () => {
    const db = await createTestDb();
    const { token, record } = await createMcpToken(db, { name: " Claude Code ", scopes: ["tasks:read", "tasks:read", "bogus"] });
    expect(token).toMatch(/^ritm_[A-Za-z0-9_-]{43}$/);
    expect(record.name).toBe("Claude Code");
    expect(record.scopes).toEqual(["tasks:read"]);
    expect(record.prefix).toBe(token.slice(0, 11));
    expect(record).not.toHaveProperty("token_hash");

    const row = (await db.select().from(mcp_tokens).get())!;
    expect(row.token_hash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);

    expect((await verifyMcpToken(db, token))?.id).toBe(record.id);
  });

  it("отклоняет чужие, битые и отозванные ключи", async () => {
    const db = await createTestDb();
    const { token, record } = await createMcpToken(db, { name: "a", scopes: [] });
    expect(await verifyMcpToken(db, token + "x")).toBeNull();
    expect(await verifyMcpToken(db, "not-a-token")).toBeNull();
    expect(await verifyMcpToken(db, "ritm_" + "a".repeat(300))).toBeNull();
    await revokeMcpToken(db, record.id);
    expect(await verifyMcpToken(db, token)).toBeNull();
    expect((await listMcpTokens(db))[0].active).toBe(false);
  });

  it("обновляет last_used_at не чаще раза в минуту", async () => {
    const db = await createTestDb();
    const { token } = await createMcpToken(db, { name: "a", scopes: [] });
    const t0 = new Date("2026-11-19T10:00:00Z");
    expect((await verifyMcpToken(db, token, t0))?.last_used_at).toBe(t0.toISOString());
    const t1 = new Date("2026-11-19T10:00:30Z");
    expect((await verifyMcpToken(db, token, t1))?.last_used_at).toBe(t0.toISOString());
    const t2 = new Date("2026-11-19T10:01:01Z");
    expect((await verifyMcpToken(db, token, t2))?.last_used_at).toBe(t2.toISOString());
  });

  it("меняет права, запрещает правку отозванного и удаление активного", async () => {
    const db = await createTestDb();
    const { record } = await createMcpToken(db, { name: "a", scopes: ["tasks:read"] });
    expect((await updateMcpToken(db, record.id, { scopes: ["notes:write", "tasks:read"] })).scopes).toEqual([
      "tasks:read",
      "notes:write",
    ]);
    await expect(deleteMcpToken(db, record.id)).rejects.toThrow(RangeError);
    await revokeMcpToken(db, record.id);
    await expect(updateMcpToken(db, record.id, { name: "b" })).rejects.toThrow(RangeError);
    await deleteMcpToken(db, record.id);
    expect(await listMcpTokens(db)).toHaveLength(0);
  });

  it("не принимает пустое имя", async () => {
    const db = await createTestDb();
    await expect(createMcpToken(db, { name: "  ", scopes: [] })).rejects.toThrow(RangeError);
  });
});

describe("scopes", () => {
  it("нормализует порядок и отбрасывает неизвестные", () => {
    expect(normalizeScopes(["goals:write", "tasks:read", "x:read", 5])).toEqual(["tasks:read", "goals:write"]);
  });
  it("requireScopes называет недостающие права", () => {
    try {
      requireScopes(["tasks:read"], ["tasks:read", "tasks:write", "projects:write"]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ScopeError);
      expect((e as ScopeError).missing).toEqual(["tasks:write", "projects:write"]);
    }
  });
});

describe("hosts", () => {
  it("разбирает Host с портом и IPv6", () => {
    expect(hostnameOf("localhost:3000")).toBe("localhost");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
    expect(hostnameOf("127.0.0.1")).toBe("127.0.0.1");
  });
  it("пускает только локальные хосты и origin", () => {
    expect(isAllowedHost("localhost:3000")).toBe(true);
    expect(isAllowedHost("127.0.0.1:3000")).toBe(true);
    expect(isAllowedHost("evil.example:3000")).toBe(false);
    expect(isAllowedHost(null)).toBe(false);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("file://x")).toBe(false);
    expect(isAllowedOrigin("null")).toBe(false);
  });
});

describe("authenticateMcpRequest", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { host: "localhost:3000", ...headers } });

  it("пускает с валидным ключом", async () => {
    const db = await createTestDb();
    const { token } = await createMcpToken(db, { name: "a", scopes: ["tasks:read"] });
    const r = await authenticateMcpRequest(db, req({ authorization: `Bearer ${token}` }));
    expect(r.ok).toBe(true);
  });

  it("401 без ключа и с неверным ключом, 403 при чужом Origin/Host", async () => {
    const db = await createTestDb();
    const { token } = await createMcpToken(db, { name: "a", scopes: [] });
    const noKey = await authenticateMcpRequest(db, req({}));
    expect(noKey.ok || noKey.response.status).toBe(401);
    if (!noKey.ok) expect(noKey.response.headers.get("www-authenticate")).toContain("Bearer");
    const bad = await authenticateMcpRequest(db, req({ authorization: "Bearer ritm_nope" }));
    expect(bad.ok || bad.response.status).toBe(401);
    const origin = await authenticateMcpRequest(db, req({ authorization: `Bearer ${token}`, origin: "https://evil.example" }));
    expect(origin.ok || origin.response.status).toBe(403);
    const host = await authenticateMcpRequest(db, req({ authorization: `Bearer ${token}`, host: "evil.example:3000" }));
    expect(host.ok || host.response.status).toBe(403);
  });
});
