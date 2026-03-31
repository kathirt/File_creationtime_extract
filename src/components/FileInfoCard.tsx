import type { ExtractionResult } from "../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SourceBadge({ source }: { source: ExtractionResult["source"] }) {
  if (source === "exif") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        From EXIF
      </span>
    );
  }
  if (source === "mp4-metadata") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        From MP4 Metadata
      </span>
    );
  }
  if (source === "png-time") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
        From PNG Metadata
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
      Not Available
    </span>
  );
}

interface Props {
  result: ExtractionResult;
  loading?: boolean;
}

export default function FileInfoCard({ result, loading }: Props) {
  const isImage = result.fileType.startsWith("image/");
  const isVideo = result.fileType.startsWith("video/");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Preview */}
      {result.previewUrl && (
        <div className="relative h-40 bg-gray-100">
          {isImage && (
            <img
              src={result.previewUrl}
              alt={result.fileName}
              className="h-full w-full object-cover"
            />
          )}
          {isVideo && (
            <video
              src={result.previewUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
              onMouseOut={(e) => {
                const v = e.target as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
            />
          )}
          <div className="absolute top-2 right-2">
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
              {isImage ? "Image" : "Video"}
            </span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        ) : (
          <>
            <h3
              className="truncate text-sm font-semibold text-gray-900"
              title={result.fileName}
            >
              {result.fileName}
            </h3>

            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span>{formatBytes(result.fileSize)}</span>
              <span className="text-gray-300">|</span>
              <span>{result.fileType || "unknown"}</span>
            </div>

            {/* Creation Time — the star of the show */}
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Creation Time
                </span>
                <SourceBadge source={result.source} />
              </div>
              {result.creationTime ? (
                <p className="text-sm font-medium text-blue-900">
                  {formatDate(result.creationTime)}
                </p>
              ) : (
                <p className="text-xs text-yellow-700">
                  Creation time not embedded in this file's metadata.
                  <br />
                  Supported: JPEG/HEIC (EXIF), PNG (tIME chunk/XMP), MP4/MOV.
                </p>
              )}
            </div>

            {/* Last Modified */}
            <div className="text-xs text-gray-500">
              <span className="font-medium">Last Modified:</span>{" "}
              {formatDate(result.lastModified)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
