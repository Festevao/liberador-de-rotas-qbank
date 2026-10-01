export interface DbConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  iamCleartext: boolean;
}

export interface PerfilOption {
  id: number;
  nome: string;
  ativo: number;
}

export interface EscopoOption {
  id: number;
  nome: string;
  status: number;
}

export interface EscopoRow {
  id: number;
  nome: string;
  status: number;
}

export interface PerfilVinculo {
  id: number;
  nome: string;
}

export interface RotaRow {
  id: number;
  observacao: string;
  path: string;
  method: string;
  applicationId: number;
  escopoId: number;
  escopoNome: string;
  status: number;
  perfis: PerfilVinculo[];
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Collision {
  id: number;
  path: string;
  method: string;
  observacao: string;
}

export interface LiberarItemResult {
  method: string;
  path: string;
  observacao: string;
  action: "criar" | "vincular";
  id: number | null;
  collisions: Collision[];
}

export interface LiberarResponse {
  dryRun: boolean;
  host: string;
  database: string;
  items: LiberarItemResult[];
}

export const APPLICATIONS = [
  { id: 1, nome: "Qbank" },
  { id: 2, nome: "Apollo" },
  { id: 3, nome: "Carbon Free" },
  { id: 4, nome: "Mentoria Singular" },
] as const;

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HttpMethod = (typeof METHODS)[number];
