export const PRESETS = {
  objectId: { label: "ObjectId", pattern: "[a-fA-F0-9]{24}" },
  numeric: { label: "Numérico", pattern: "[0-9]{1,20}" },
  numericOpen: { label: "Numérico aberto", pattern: "[0-9]{1,}" },
  alnum: { label: "Alfanumérico", pattern: "[A-Za-z0-9]{1,100}" },
  slug: { label: "Slug", pattern: "[a-z0-9-]{1,80}" },
  segment: { label: "Qualquer segmento", pattern: "[^/]+" },
} as const;

export type PresetId = keyof typeof PRESETS;

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REGEX_META = /[.+*?^${}()|[\]\\]/g;
const LINE_PATTERN =
  /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)(?:\s*\|\s*(.*))?$/i;

export interface RouteParam {
  name: string;
}

export interface ParsedLine {
  line: number;
  method: string;
  expressPath: string;
  observacao: string;
  params: RouteParam[];
  error?: string;
}

export function parseBulk(text: string): ParsedLine[] {
  const parsed: ParsedLine[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(LINE_PATTERN);
    if (!match) {
      parsed.push({
        line: index + 1,
        method: "",
        expressPath: trimmed,
        observacao: "",
        params: [],
        error: "Use METHOD /caminho ou METHOD /caminho | observação",
      });
      return;
    }
    const method = match[1].toUpperCase();
    if (!METHODS.has(method)) {
      parsed.push({
        line: index + 1,
        method,
        expressPath: match[2],
        observacao: "",
        params: [],
        error: "Método inválido",
      });
      return;
    }
    const expressPath = cleanExpressPath(match[2]);
    const paramError = validateParams(expressPath);
    parsed.push({
      line: index + 1,
      method,
      expressPath,
      observacao: (match[3] ?? "").trim(),
      params: paramError ? [] : extractParams(expressPath),
      error: paramError,
    });
  });
  return parsed;
}

export function buildStoredPath(
  expressPath: string,
  presets: PresetId[],
): string {
  let paramIndex = 0;
  const segments = cleanExpressPath(expressPath).split("/");
  const built = segments.map((segment) => {
    if (!segment.startsWith(":")) return escapeStatic(segment);
    const preset = presets[paramIndex] ?? "objectId";
    paramIndex += 1;
    return PRESETS[preset].pattern;
  });
  const joined = built.join("/");
  const withSlash = joined.startsWith("/") ? joined : `/${joined}`;
  return withSlash.endsWith("$") ? withSlash : `${withSlash}$`;
}

export function sampleConcretePath(
  expressPath: string,
  presets: PresetId[],
): string {
  let paramIndex = 0;
  const segments = cleanExpressPath(expressPath).split("/");
  const built = segments.map((segment) => {
    if (!segment.startsWith(":")) return segment.toLowerCase();
    const preset = presets[paramIndex] ?? "objectId";
    paramIndex += 1;
    return sampleForPreset(preset);
  });
  return normalizeRequestPath(built.join("/"));
}

export function normalizeRequestPath(path: string): string {
  return path.toLowerCase().split("?")[0].replace(/\/$/, "");
}

export function escapeStatic(segment: string): string {
  return segment.toLowerCase().replace(REGEX_META, (char) => `\\${char}`);
}

export function defaultObservacao(expressPath: string): string {
  return expressPath.slice(0, 100);
}

function cleanExpressPath(path: string): string {
  const withoutQuery = path.split("?")[0];
  const withoutTrailing = withoutQuery.replace(/\/+$/, "");
  if (!withoutTrailing) return "/";
  return withoutTrailing.startsWith("/")
    ? withoutTrailing
    : `/${withoutTrailing}`;
}

function extractParams(path: string): RouteParam[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => ({ name: segment.slice(1) }));
}

function validateParams(path: string): string | undefined {
  for (const segment of path.split("/")) {
    if (!segment.startsWith(":")) continue;
    const name = segment.slice(1);
    if (!PARAM_NAME.test(name)) {
      return `Parâmetro inválido: ${segment}`;
    }
  }
  return undefined;
}

function sampleForPreset(preset: PresetId): string {
  switch (preset) {
    case "objectId":
      return "aaaaaaaaaaaaaaaaaaaaaaaa";
    case "numeric":
    case "numericOpen":
      return "1";
    case "alnum":
    case "slug":
      return "a";
    case "segment":
      return "x";
  }
}
