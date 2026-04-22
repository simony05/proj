"use client";

import { useEffect, useRef, useState } from "react";
import { queryWorkspace, uploadDocument } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  workspaceId: string;
}

export default function WorkspaceView({ workspaceId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages, querying]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const doc = await uploadDocument(workspaceId, file);
      setUploadStatus({ ok: true, text: `"${file.name}" uploaded (${doc.status})` });
    } catch (err) {
      setUploadStatus({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || querying) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");
    setQuerying(true);

    try {
      const res = await queryWorkspace(workspaceId, q);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${text}` }]);
    } finally {
      setQuerying(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Upload bar */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Upload PDF</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer disabled:opacity-50"
        />
        {uploading && <span className="text-sm text-gray-400">Uploading…</span>}
        {!uploading && uploadStatus && (
          <span className={`text-sm ${uploadStatus.ok ? "text-green-600" : "text-red-500"}`}>
            {uploadStatus.text}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !querying && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Upload a PDF, then ask a question.
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {querying && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                Thinking…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Query input */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={handleQuery} className="max-w-3xl mx-auto flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents…"
            disabled={querying}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={querying || !query.trim()}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
