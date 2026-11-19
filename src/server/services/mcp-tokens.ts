import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/factory";
import { mcp_tokens, type McpTokenRow } from "../db/schema";
import { normalizeScopes, type Scope } from "../mcp/scopes";
import { NotFoundError, newId, nowIso } from "./common";

const TOKEN_PREFIX = "ritm_";
/** last_used_at обновляем не чаще раза в минуту, чтобы не писать в БД на каждый вызов. */
const TOUCH_INTERVAL_MS = 60_000;

/** Публичное представление ключа — без хеша. */
export type McpToken = Omit<McpTokenRow, "token_hash" | "scopes"> & {
  scopes: Scope[];
  active: boolean;
};

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

function toPublic(row: McpTokenRow): McpToken {
  const { token_hash: _hash, scopes, ...rest } = row;
  void _hash;
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(scopes);
  } catch {
    parsed = [];
  }
  return {
    ...rest,
    scopes: normalizeScopes(Array.isArray(parsed) ? parsed : []),
    active: row.revoked_at === null,
  };
}

function validateName(name: string): string {
  const n = name.trim();
  if (!n) throw new RangeError("Название ключа не может быть пустым");
  if (n.length > 80) throw new RangeError("Название ключа длиннее 80 символов");
  return n;
}

/**
 * Создаёт ключ. Возвращает открытый ключ ОДИН раз — в БД остаётся только SHA-256.
 * Ключ: "ritm_" + 32 случайных байта в base64url (256 бит энтропии), поэтому
 * медленный хеш (bcrypt/argon) не нужен: перебор невозможен.
 */
export async function createMcpToken(
  db: Db,
  input: { name: string; scopes: readonly unknown[] },
  now: Date = new Date(),
): Promise<{ token: string; record: McpToken }> {
  const name = validateName(input.name);
  const scopes = normalizeScopes(input.scopes);
  const plain = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const ts = nowIso(now);
  const row: McpTokenRow = {
    id: newId(),
    name,
    token_hash: hashToken(plain),
    prefix: plain.slice(0, TOKEN_PREFIX.length + 6),
    scopes: JSON.stringify(scopes),
    last_used_at: null,
    revoked_at: null,
    created_at: ts,
    updated_at: ts,
  };
  await db.insert(mcp_tokens).values(row).run();
  return { token: plain, record: toPublic(row) };
}

export async function listMcpTokens(db: Db): Promise<McpToken[]> {
  const rows = await db.select().from(mcp_tokens).orderBy(desc(mcp_tokens.created_at)).all();
  return rows.map(toPublic);
}

async function getRow(db: Db, id: string): Promise<McpTokenRow> {
  const row = await db.select().from(mcp_tokens).where(eq(mcp_tokens.id, id)).get();
  if (!row) throw new NotFoundError("Ключ");
  return row;
}

export async function getMcpToken(db: Db, id: string): Promise<McpToken> {
  return toPublic(await getRow(db, id));
}

export async function updateMcpToken(
  db: Db,
  id: string,
  input: { name?: string; scopes?: readonly unknown[] },
  now: Date = new Date(),
): Promise<McpToken> {
  const row = await getRow(db, id);
  if (row.revoked_at) throw new RangeError("Ключ отозван — создайте новый");
  const patch: Partial<McpTokenRow> = { updated_at: nowIso(now) };
  if (input.name !== undefined) patch.name = validateName(input.name);
  if (input.scopes !== undefined) patch.scopes = JSON.stringify(normalizeScopes(input.scopes));
  await db.update(mcp_tokens).set(patch).where(eq(mcp_tokens.id, id)).run();
  return await getMcpToken(db, id);
}

/** Отзыв необратим: ключ перестаёт работать сразу. Запись остаётся для журнала. */
export async function revokeMcpToken(db: Db, id: string, now: Date = new Date()): Promise<McpToken> {
  const row = await getRow(db, id);
  if (!row.revoked_at) {
    const ts = nowIso(now);
    await db.update(mcp_tokens).set({ revoked_at: ts, updated_at: ts }).where(eq(mcp_tokens.id, id)).run();
  }
  return await getMcpToken(db, id);
}

/** Удаляет запись ключа полностью (только отозванные — активный сначала надо отозвать). */
export async function deleteMcpToken(db: Db, id: string): Promise<void> {
  const row = await getRow(db, id);
  if (!row.revoked_at) throw new RangeError("Сначала отзовите ключ");
  await db.delete(mcp_tokens).where(eq(mcp_tokens.id, id)).run();
}

/**
 * Проверяет открытый ключ. Возвращает активный ключ или null.
 * Ищем по хешу (индекс), затем сравниваем хеши за постоянное время.
 */
export async function verifyMcpToken(db: Db, plain: string, now: Date = new Date()): Promise<McpToken | null> {
  if (typeof plain !== "string" || !plain.startsWith(TOKEN_PREFIX) || plain.length > 200) return null;
  const hash = hashToken(plain);
  const row = await db.select().from(mcp_tokens).where(eq(mcp_tokens.token_hash, hash)).get();
  if (!row) return null;
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (row.revoked_at) return null;

  const last = row.last_used_at ? Date.parse(row.last_used_at) : 0;
  if (now.getTime() - last >= TOUCH_INTERVAL_MS) {
    const ts = nowIso(now);
    await db.update(mcp_tokens).set({ last_used_at: ts }).where(eq(mcp_tokens.id, row.id)).run();
    row.last_used_at = ts;
  }
  return toPublic(row);
}
