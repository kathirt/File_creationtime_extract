import exifr from "exifr";
import type { ExtractionResult } from "../types";

// ── Image: extract EXIF / XMP DateTimeOriginal / CreateDate ──────────────────

async function extractFromImage(file: File): Promise<Date | null> {
  try {
    // Parse with XMP + IPTC + EXIF enabled — covers JPEG, HEIC, PNG, TIFF, AVIF
    const tags = await exifr.parse(file, {
      tiff: true,
      xmp: true,
      iptc: true,
      icc: false,
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "DateTimeDigitized",
        // XMP variants (common in PNGs and edited images)
        "xmp:CreateDate",
        "xmp:MetadataDate",
        "photoshop:DateCreated",
      ],
    });
    if (!tags) return null;

    const candidates: Date[] = [];
    for (const key of [
      "DateTimeOriginal",
      "CreateDate",
      "DateTimeDigitized",
      "xmp:CreateDate",
      "photoshop:DateCreated",
      "xmp:MetadataDate",
    ]) {
      const val = tags[key];
      if (!val) continue;
      const d = val instanceof Date ? val : new Date(val);
      if (!isNaN(d.getTime())) {
        candidates.push(d);
      }
    }
    if (candidates.length === 0) return null;
    return new Date(Math.min(...candidates.map((d) => d.getTime())));
  } catch {
    return null;
  }
}

// ── PNG: parse tIME chunk (last modification of image data) ──────────────────

async function extractFromPngTime(file: File): Promise<Date | null> {
  try {
    const buf = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
    const view = new DataView(buf);

    // Verify PNG signature: 0x89504E47
    if (view.getUint32(0) !== 0x89504e47) return null;

    let offset = 8; // skip 8-byte PNG signature
    while (offset + 12 <= view.byteLength) {
      const chunkLen = view.getUint32(offset);
      const chunkType = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (chunkType === "tIME" && chunkLen === 7) {
        // tIME chunk: year(2) month(1) day(1) hour(1) minute(1) second(1)
        const dataStart = offset + 8;
        const year = view.getUint16(dataStart);
        const month = view.getUint8(dataStart + 2) - 1; // 0-indexed
        const day = view.getUint8(dataStart + 3);
        const hour = view.getUint8(dataStart + 4);
        const minute = view.getUint8(dataStart + 5);
        const second = view.getUint8(dataStart + 6);
        const date = new Date(Date.UTC(year, month, day, hour, minute, second));
        if (!isNaN(date.getTime()) && date.getFullYear() > 1970) return date;
      }

      // Skip to next chunk: 4 (length) + 4 (type) + data + 4 (CRC)
      offset += 12 + chunkLen;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Video: parse MP4/MOV mvhd atom for creation_time ─────────────────────────

// MP4 epoch starts on 1904-01-01T00:00:00Z
const MP4_EPOCH_OFFSET = Date.UTC(1904, 0, 1, 0, 0, 0);

/** Read `length` bytes from `file` starting at `fileOffset`. */
async function readBytes(
  file: File,
  fileOffset: number,
  length: number
): Promise<DataView> {
  const slice = file.slice(fileOffset, fileOffset + length);
  const buf = await slice.arrayBuffer();
  return new DataView(buf);
}

/** Read 4-char atom type from a DataView at given offset. */
function readAtomType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

async function extractFromMp4(file: File): Promise<Date | null> {
  try {
    // Walk top-level atoms using random-access reads.
    // In many MP4 files the moov atom is at the END after the large mdat atom,
    // so we can't just read the first 64KB.
    let offset = 0;

    while (offset + 8 <= file.size) {
      // Read atom header (8 bytes: 4 size + 4 type)
      const header = await readBytes(file, offset, 8);
      let atomSize = header.getUint32(0);
      const atomType = readAtomType(header, 4);

      // Handle extended size (size == 1 → next 8 bytes are 64-bit size)
      if (atomSize === 1 && offset + 16 <= file.size) {
        const extHeader = await readBytes(file, offset + 8, 8);
        atomSize =
          extHeader.getUint32(0) * 0x100000000 + extHeader.getUint32(4);
      }

      // size 0 means atom extends to end of file
      if (atomSize === 0) atomSize = file.size - offset;

      if (atomSize < 8) break; // corrupt

      if (atomType === "moov") {
        // Read the entire moov atom (usually small, a few hundred KB)
        const moovSize = Math.min(atomSize, 4 * 1024 * 1024); // cap at 4MB safety
        const moovView = await readBytes(file, offset, moovSize);
        return findMvhdCreationTime(moovView, 8, moovSize);
      }

      offset += atomSize;
    }
    return null;
  } catch {
    return null;
  }
}

function findMvhdCreationTime(
  view: DataView,
  start: number,
  end: number
): Date | null {
  let offset = start;
  while (offset + 8 <= end && offset + 8 <= view.byteLength) {
    const size = view.getUint32(offset);
    const type = readAtomType(view, offset + 4);

    if (size < 8) break;

    if (type === "mvhd") {
      // mvhd: version (1 byte) + flags (3 bytes) + creation_time
      const dataStart = offset + 8;
      if (dataStart + 8 > view.byteLength) return null;

      const version = view.getUint8(dataStart);
      let creationTimeSec: number;

      if (version === 0) {
        // 32-bit creation_time at offset +4
        creationTimeSec = view.getUint32(dataStart + 4);
      } else {
        // 64-bit creation_time at offset +4
        if (dataStart + 12 > view.byteLength) return null;
        creationTimeSec =
          view.getUint32(dataStart + 4) * 0x100000000 +
          view.getUint32(dataStart + 8);
      }

      if (creationTimeSec === 0) return null;
      const ms = MP4_EPOCH_OFFSET + creationTimeSec * 1000;
      const date = new Date(ms);
      // Sanity: reject dates before 1970 or after 2100
      if (date.getFullYear() < 1970 || date.getFullYear() > 2100) return null;
      return date;
    }

    offset += size;
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function extractCreationTime(file: File): Promise<ExtractionResult> {
  const base: Omit<ExtractionResult, "creationTime" | "source" | "previewUrl"> = {
    file,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    lastModified: new Date(file.lastModified),
  };

  let previewUrl: string | null = null;
  if (file.type.startsWith("image/")) {
    previewUrl = URL.createObjectURL(file);
  } else if (file.type.startsWith("video/")) {
    previewUrl = URL.createObjectURL(file);
  }

  // Try image EXIF / XMP
  if (file.type.startsWith("image/")) {
    const dt = await extractFromImage(file);
    if (dt) {
      return { ...base, creationTime: dt, source: "exif", previewUrl };
    }

    // Fallback: PNG tIME chunk
    if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
      const dt2 = await extractFromPngTime(file);
      if (dt2) {
        return { ...base, creationTime: dt2, source: "png-time", previewUrl };
      }
    }
  }

  // Try MP4/MOV metadata
  if (
    file.type.startsWith("video/") ||
    file.name.toLowerCase().endsWith(".mp4") ||
    file.name.toLowerCase().endsWith(".mov")
  ) {
    const dt = await extractFromMp4(file);
    if (dt) {
      return { ...base, creationTime: dt, source: "mp4-metadata", previewUrl };
    }
  }

  return { ...base, creationTime: null, source: "not-available", previewUrl };
}
