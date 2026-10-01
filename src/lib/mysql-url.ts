export function parseMysqlUrl(raw: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  iamCleartext: boolean;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "mysql:") return null;

  const host = url.hostname;
  const user = decodeUserInfo(url.username);
  const password = decodeUserInfo(url.password);
  const database = decodeUserInfo(url.pathname.replace(/^\//, ""));
  const port = url.port ? Number(url.port) : 3306;
  if (!host || !user || !password || !database) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
  const ssl = sslmode !== "disable" && sslmode !== "disabled" && sslmode !== "false";
  const iamCleartext =
    password.includes("Action=connect") || password.includes("X-Amz-Algorithm");

  return { host, port, user, password, database, ssl, iamCleartext };
}

function decodeUserInfo(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
