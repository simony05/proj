"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDocument,
  getDocumentDownloadUrl,
  getDocuments,
  uploadDocuments,
  type DocumentMeta,
} from "@/lib/api";

interface Props {
  workspaceId: string;
}

const STATUS_STYLES: Record<DocumentMeta["status"], string> = {
  uploaded: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function DocumentPanel({ workspaceId }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshDocuments(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const nextDocuments = await getDocuments(workspaceId);
      setDocuments(nextDocuments);
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Failed to load documents.",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    setMessage(null);
    refreshDocuments(true);
  }, [workspaceId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshDocuments();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [workspaceId]);

  const hasPendingDocuments = useMemo(
    () => documents.some((document) => document.status === "uploaded" || document.status === "processing"),
    [documents]
  );

  useEffect(() => {
    if (!hasPendingDocuments) return;

    const timeoutId = window.setTimeout(() => {
      refreshDocuments();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [documents, hasPendingDocuments]);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    if (files.length === 0) {
      setMessage({ ok: false, text: "Please upload PDF files only." });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const created = await uploadDocuments(workspaceId, files);
      setMessage({
        ok: true,
        text: `${created.length} document${created.length === 1 ? "" : "s"} queued for processing.`,
      });
      await refreshDocuments();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    setMessage(null);

    try {
      await deleteDocument(workspaceId, documentId);
      setDocuments((prev) => prev.filter((document) => document.document_id !== documentId));
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Delete failed.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="shrink-0 border-b border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
              <p className="text-sm text-gray-500">Upload, review, open, or remove PDFs in this workspace.</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload PDFs"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) {
                  handleFiles(event.target.files);
                }
              }}
              className="hidden"
            />
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (event.dataTransfer.files?.length) {
                handleFiles(event.dataTransfer.files);
              }
            }}
            className={`rounded-lg border border-dashed px-4 py-5 text-sm transition-colors ${
              dragActive
                ? "border-gray-900 bg-white text-gray-900"
                : "border-gray-300 bg-white text-gray-500"
            }`}
          >
            Drag PDFs here or use the upload button.
          </div>

          {message && (
            <div className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</div>
          )}

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="grid grid-cols-[minmax(0,1.5fr)_auto_auto_auto] gap-3 border-b border-gray-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <span>Name</span>
              <span>Status</span>
              <span>Created</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm text-gray-500">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No documents uploaded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map((document) => (
                  <div
                    key={document.document_id}
                    className="grid grid-cols-[minmax(0,1.5fr)_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm"
                  >
                    <a
                      href={getDocumentDownloadUrl(workspaceId, document.document_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-gray-900 hover:text-gray-700"
                    >
                      {document.file_name}
                    </a>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLES[document.status]}`}
                    >
                      {document.status}
                    </span>
                    <span className="whitespace-nowrap text-gray-500">{formatDate(document.created_at)}</span>
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={getDocumentDownloadUrl(workspaceId, document.document_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-600 hover:text-gray-900"
                      >
                        View
                      </a>
                      <a
                        href={getDocumentDownloadUrl(workspaceId, document.document_id)}
                        download={document.file_name}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(document.document_id)}
                        disabled={deletingId === document.document_id}
                        className="text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === document.document_id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
