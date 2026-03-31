export interface ExtractionResult {
  file: File;
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: Date;
  creationTime: Date | null;
  source: "exif" | "mp4-metadata" | "png-time" | "not-available";
  previewUrl: string | null;
}
