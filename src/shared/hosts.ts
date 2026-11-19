/**
 * Разрешённые хосты приложения. Без этого сайт с чужим доменом, указывающим на 127.0.0.1
 * (DNS-rebinding), мог бы обращаться к локальному API из браузера.
 * Для будущего деплоя: RITM_ALLOWED_HOSTS="ritm.example.com,другой.хост".
 * Модуль без Node-зависимостей — используется и в middleware (edge).
 */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

function extraHosts(): string[] {
  return (process.env.RITM_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Имя хоста без порта: "localhost:3000" → "localhost", "[::1]:3000" → "[::1]". */
export function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end === -1 ? h : h.slice(0, end + 1);
  }
  const colon = h.lastIndexOf(":");
  return colon === -1 ? h : h.slice(0, colon);
}

export function isAllowedHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const name = hostnameOf(hostHeader);
  return LOCAL_HOSTS.includes(name) || extraHosts().includes(name);
}

export function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return isAllowedHost(url.host);
  } catch {
    return false;
  }
}
