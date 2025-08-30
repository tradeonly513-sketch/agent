export interface SupabaseUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

export interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  created_at: string;
  status: string;
  database?: {
    host: string;
    version: string;
    postgres_engine: string;
    release_channel: string;
  };
  stats?: ProjectStats;
}

export interface ProjectStats {
  database: {
    tables: number;
    views: number;
    functions: number;
    size_bytes: number;
    size_mb: number;
  };
  storage: {
    buckets: number;
    files: number;
    used_bytes: number;
    used_gb: number;
    available_bytes: number;
    available_gb: number;
  };
  functions: {
    deployed: number;
    invocations: number;
  };
  auth?: {
    users: number;
    sessions: number;
    providers: string[];
  };
}

export interface SupabaseStats {
  projects: SupabaseProject[];
  totalProjects: number;
}

export interface SupabaseApiKey {
  name: string;
  api_key: string;
}

export interface SupabaseCredentials {
  anonKey?: string;
  supabaseUrl?: string;
}
