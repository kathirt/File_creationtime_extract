# File Creation Time Extractor

A React demo that extracts **file creation time** from uploaded images and videos by reading embedded binary metadata — not the filesystem `lastModified` property.

## Why?

Browsers only expose `File.lastModified`. There is no `File.creationTime` API. This demo solves that by parsing metadata embedded inside the file itself:

| File Type | Metadata Source | Tags Used |
|---|---|---|
| JPEG / HEIC / TIFF | EXIF + XMP | `DateTimeOriginal`, `CreateDate`, `xmp:CreateDate` |
| PNG | XMP or `tIME` chunk | XMP dates, then PNG binary `tIME` fallback |
| MP4 / MOV | `moov` → `mvhd` atom | `creation_time` (seconds since 1904-01-01) |

## How It Works

1. User drops or selects files in the browser
2. **Images** — parsed with [`exifr`](https://github.com/nicecatch/exifr) for EXIF/XMP/IPTC date tags; PNGs fall back to a custom `tIME` chunk parser
3. **Videos** — a custom MP4 parser walks top-level atoms via `File.slice()` (random-access reads), finds the `moov` atom (often at the end of multi-GB files), then reads `mvhd.creation_time`
4. Results are displayed with color-coded badges indicating the metadata source

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- `exifr` for EXIF/XMP parsing
- Custom binary parsers for PNG `tIME` and MP4 `mvhd` (no heavy dependencies)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 and upload an image or video.

## Build

```bash
npm run build
npm run preview
```

## Limitations

- **No server required** — all extraction happens client-side in the browser
- Files without embedded metadata (e.g., screenshots, screen recordings without `moov`, plain text) will show "Not Available"
- `lastModified` (from the filesystem) is always shown as a fallback
