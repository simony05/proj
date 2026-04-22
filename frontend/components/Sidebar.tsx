"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createWorkspace, deleteWorkspace, getWorkspaces, type Workspace } from "@/lib/api";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(console.error);
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const currentId = pathname.startsWith("/workspace/")
    ? pathname.split("/workspace/")[1]
    : null;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const ws = await createWorkspace(name);
      setWorkspaces((prev) => [ws, ...prev]);
      setNewName("");
      setCreating(false);
      router.push(`/workspace/${ws.workspace_id}`);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.workspace_id !== id));
      if (currentId === id) router.push("/");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <aside className="w-64 shrink-0 bg-gray-900 text-white flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-700">
        <span className="font-semibold text-sm tracking-wide">PDF RAG</span>
      </div>

      {/* New workspace */}
      <div className="px-3 py-3 border-b border-gray-700">
        {creating ? (
          <div className="flex gap-1">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Workspace name"
              className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded bg-gray-800 border border-gray-600 text-white placeholder-gray-500 outline-none focus:border-gray-400"
            />
            <button
              onClick={handleCreate}
              className="shrink-0 text-sm px-2 py-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full text-left text-sm px-3 py-2 rounded border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            + New Workspace
          </button>
        )}
      </div>

      {/* Workspace list */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {workspaces.length === 0 && (
          <p className="text-xs text-gray-600 px-3 py-2">No workspaces yet.</p>
        )}
        {workspaces.map((ws) => (
          <div
            key={ws.workspace_id}
            onClick={() => router.push(`/workspace/${ws.workspace_id}`)}
            className={`group flex items-center justify-between px-3 py-2 rounded-md mb-0.5 cursor-pointer text-sm ${
              ws.workspace_id === currentId
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span className="truncate">{ws.workspace_name}</span>
            <button
              onClick={(e) => handleDelete(e, ws.workspace_id)}
              className="shrink-0 ml-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-1 transition-opacity"
              title="Delete workspace"
            >
              ✕
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
