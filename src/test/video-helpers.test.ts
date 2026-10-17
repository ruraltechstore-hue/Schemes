import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  getYouTubeEmbedUrl,
  isYouTubeUrl,
  isValidVideoFile,
  formatFileSize,
  extractStoragePath,
  getSchemeVideo,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/video-helpers";

describe("Video Helpers", () => {
  describe("YouTube URL parsing", () => {
    it("extracts ID from standard watch URL", () => {
      expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from youtu.be short URL", () => {
      expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abcdef12345")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from embed URL", () => {
      expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from shorts URL", () => {
      expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("returns null for non-YouTube URLs", () => {
      expect(extractYouTubeId("https://example.com/video.mp4")).toBeNull();
      expect(extractYouTubeId("")).toBeNull();
    });

    it("generates correct embed URL", () => {
      expect(getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
      );
      expect(getYouTubeEmbedUrl("invalid")).toBeNull();
    });

    it("correctly identifies YouTube URLs", () => {
      expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
      expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false);
    });
  });

  describe("File validation & formatting", () => {
    it("formats file sizes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1024 * 1024 * 15)).toBe("15 MB");
    });

    it("validates MP4, WebM, MOV formats", () => {
      const validMp4 = new File(["dummy"], "guide.mp4", { type: "video/mp4" });
      const validWebm = new File(["dummy"], "guide.webm", { type: "video/webm" });
      const validMov = new File(["dummy"], "guide.mov", { type: "video/quicktime" });
      const invalidAvi = new File(["dummy"], "guide.avi", { type: "video/x-msvideo" });

      expect(isValidVideoFile(validMp4).valid).toBe(true);
      expect(isValidVideoFile(validWebm).valid).toBe(true);
      expect(isValidVideoFile(validMov).valid).toBe(true);
      expect(isValidVideoFile(invalidAvi).valid).toBe(false);
      expect(isValidVideoFile(invalidAvi).error).toContain("Unsupported file format");
    });

    it("validates file size limit", () => {
      // Mock large file
      const largeFile = new File(["dummy"], "large.mp4", { type: "video/mp4" });
      Object.defineProperty(largeFile, "size", { value: MAX_VIDEO_SIZE_BYTES + 1024 });

      const res = isValidVideoFile(largeFile);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds maximum limit");
    });
  });

  describe("extractStoragePath", () => {
    it("extracts path from full public Supabase storage URL", () => {
      const url = "https://example.supabase.co/storage/v1/object/public/scheme-videos/scheme_123/12345_tutorial.mp4";
      expect(extractStoragePath(url, "scheme-videos")).toBe("scheme_123/12345_tutorial.mp4");
    });
  });

  describe("getSchemeVideo", () => {
    it("reads direct root columns when present", () => {
      const scheme = {
        application_video_url: "https://example.supabase.co/video.mp4",
        video_type: "uploaded",
        eligibility: {},
      };
      expect(getSchemeVideo(scheme)).toEqual({
        url: "https://example.supabase.co/video.mp4",
        type: "uploaded",
      });
    });

    it("reads from eligibility fallback when root column is null", () => {
      const scheme = {
        application_video_url: null,
        video_type: null,
        eligibility: {
          application_video_url: "https://youtu.be/dQw4w9WgXcQ",
          video_type: "youtube",
        },
      };
      expect(getSchemeVideo(scheme)).toEqual({
        url: "https://youtu.be/dQw4w9WgXcQ",
        type: "youtube",
      });
    });

    it("returns null if no video attached", () => {
      const scheme = {
        application_video_url: null,
        eligibility: {},
      };
      expect(getSchemeVideo(scheme)).toEqual({
        url: null,
        type: null,
      });
    });
  });
});
