import { useState, useCallback } from "react";
import FileUploader from "./components/FileUploader";
import FileInfoCard from "./components/FileInfoCard";
import { extractCreationTime } from "./utils/extractCreationTime";
import type { ExtractionResult } from "./types";
import "./index.css";

interface FileEntry {
  id: string;
  result: ExtractionResult | null;
  file: File;
}

export default function App() {
  const [entries, setEntries] = useState<FileEntry[]>([]);

  const handleFiles = useCallback(async (files: File[]) => {
    // Add placeholders immediately (loading state)
    const newEntries: FileEntry[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      result: null,
      file,
    }));

    setEntries((prev) => [...newEntries, ...prev]);

    // Extract in parallel
    const results = await Promise.all(
      files.map((file) => extractCreationTime(file))
    );

    // Merge results
    setEntries((prev) =>
      prev.map((entry) => {
        const idx = newEntries.findIndex((ne) => ne.id === entry.id);
        if (idx !== -1 && results[idx]) {
          return { ...entry, result: results[idx] };
        }
        return entry;
      })
    );
  }, []);

  const clearAll = useCallback(() => {
    // Revoke object URLs to free memory
    entries.forEach((e) => {
      if (e.result?.previewUrl) URL.revokeObjectURL(e.result.previewUrl);
    });
    setEntries([]);
  }, [entries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            File Creation Time Extractor
          </h1>
          <p className="mt-2 text-gray-600">
            Upload images or videos to extract their original creation time from
            embedded metadata
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">How it works</p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>
              <strong>Images (JPEG, HEIC):</strong> Creation time is read from
              EXIF metadata (<code>DateTimeOriginal</code>)
            </li>
            <li>
              <strong>Videos (MP4, MOV):</strong> Creation time is read from the
              MP4 container's <code>mvhd</code> atom
            </li>
            <li>
              <strong>Other files:</strong> Browsers do not expose file system
              creation time — only <code>lastModified</code> is available via
              the File API
            </li>
          </ul>
        </div>

        {/* Uploader */}
        <FileUploader onFiles={handleFiles} />

        {/* Results */}
        {entries.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {entries.length} file{entries.length > 1 ? "s" : ""} uploaded
              </p>
              <button
                onClick={clearAll}
                className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <FileInfoCard
                  key={entry.id}
                  result={
                    entry.result ?? {
                      file: entry.file,
                      fileName: entry.file.name,
                      fileSize: entry.file.size,
                      fileType: entry.file.type,
                      lastModified: new Date(entry.file.lastModified),
                      creationTime: null,
                      source: "not-available",
                      previewUrl: null,
                    }
                  }
                  loading={entry.result === null}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
