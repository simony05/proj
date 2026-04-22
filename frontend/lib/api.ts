const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Workspace {
  workspace_id: string;
  workspace_name: string;
  created_at: string;
}

export interface DocumentMeta {
  document_id: string;
  workspace_id: string;
  file_path: string;
  status: "processing" | "ready" | "error";
  created_at: string;
}

export interface QueryResponse {
  answer: string;
  sources: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const getWorkspaces = (): Promise<Workspace[]> =>
  request("/workspaces");

export const createWorkspace = (name: string): Promise<Workspace> =>
  request("/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteWorkspace = (workspaceId: string): Promise<void> =>
  request(`/workspaces/${workspaceId}`, { method: "DELETE" });

export const uploadDocument = (workspaceId: string, file: File): Promise<DocumentMeta> => {
  const body = new FormData();
  body.append("file", file);
  return request(`/workspaces/${workspaceId}/upload`, { method: "POST", body });
};

export const queryWorkspace = (workspaceId: string, query: string): Promise<QueryResponse> =>
  request(`/workspaces/${workspaceId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
