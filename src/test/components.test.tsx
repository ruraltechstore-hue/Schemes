import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SchemeVideoPlayer } from "@/components/SchemeVideoPlayer";

describe("SchemeVideoPlayer Component", () => {
  it("renders empty state when no video is available", () => {
    render(
      <SchemeVideoPlayer
        schemeName="Pradhan Mantri Awas Yojana"
        videoUrl={null}
        videoType={null}
        applyUrl="https://pmaymis.gov.in"
      />
    );

    expect(screen.getByText("How to Apply — Video Guide")).toBeInTheDocument();
    expect(
      screen.getByText("Application tutorial video coming soon")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Pradhan Mantri Awas Yojana/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Visit Official Application Portal")).toBeInTheDocument();
  });

  it("renders responsive iframe when YouTube video is provided", () => {
    const { container } = render(
      <SchemeVideoPlayer
        schemeName="PM-KISAN Samman Nidhi"
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        videoType="youtube"
        applyUrl="https://pmkisan.gov.in"
      />
    );

    expect(screen.getByText("How to Apply — Video Guide")).toBeInTheDocument();
    expect(screen.getByText("YouTube Guide")).toBeInTheDocument();
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("renders HTML5 video player with controls when uploaded video is provided", () => {
    const { container } = render(
      <SchemeVideoPlayer
        schemeName="Ayushman Bharat"
        videoUrl="https://example.supabase.co/storage/v1/object/public/scheme-videos/tutorial.mp4"
        videoType="uploaded"
        applyUrl="https://pmjay.gov.in"
      />
    );

    expect(screen.getByText("How to Apply — Video Guide")).toBeInTheDocument();
    expect(screen.getByText("Official Video Tutorial")).toBeInTheDocument();
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe(
      "https://example.supabase.co/storage/v1/object/public/scheme-videos/tutorial.mp4"
    );
    expect(video?.hasAttribute("controls")).toBe(true);
  });
});
