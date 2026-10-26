import React from "react";
import { Check } from "lucide-react";
import { splitIntoPoints, isPointWise } from "@/lib/point-helpers";

export interface PointWiseListProps {
  text?: string | string[] | null | undefined;
  className?: string;
  itemClassName?: string;
  bulletClassName?: string;
  icon?: "bullet" | "check" | "none";
  maxItems?: number;
  inlineIfSingle?: boolean;
  emptyFallback?: React.ReactNode;
}

/**
 * Renders point-wise text as a structured list when multiple points or bullet markers exist,
 * or as a clean paragraph when it's a single continuous statement.
 */
export function PointWiseList({
  text,
  className = "",
  itemClassName = "",
  bulletClassName = "",
  icon = "bullet",
  maxItems,
  inlineIfSingle = false,
  emptyFallback = null,
}: PointWiseListProps) {
  if (
    text === null ||
    text === undefined ||
    (typeof text === "string" && !text.trim()) ||
    (Array.isArray(text) && text.length === 0)
  ) {
    return <>{emptyFallback}</>;
  }

  const rawTrimmed = typeof text === "string" ? text.trim() : "";
  const points = splitIntoPoints(text);

  if (points.length === 0) {
    return <>{emptyFallback}</>;
  }

  const shouldRenderList = points.length > 1 || (rawTrimmed ? isPointWise(rawTrimmed) : true);

  // If only a single point and inlineIfSingle is requested, return inline
  if (!shouldRenderList && inlineIfSingle) {
    return <span className={itemClassName}>{points[0]}</span>;
  }

  // Single plain paragraph
  if (!shouldRenderList) {
    return (
      <p className={`whitespace-pre-line leading-relaxed ${itemClassName || "text-sm text-foreground/90"} ${className}`}>
        {points[0]}
      </p>
    );
  }

  // Render as point-wise list
  const displayPoints = maxItems && maxItems > 0 ? points.slice(0, maxItems) : points;
  const remainingCount = maxItems && maxItems > 0 ? points.length - maxItems : 0;

  return (
    <div className={className}>
      <ul className="space-y-1.5 list-none p-0 m-0">
        {displayPoints.map((point, index) => (
          <li
            key={index}
            className={`flex items-start gap-2 text-sm leading-relaxed ${itemClassName || "text-foreground/90"}`}
          >
            {icon === "bullet" && (
              <span
                className={`mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0 ${bulletClassName}`}
                aria-hidden="true"
              />
            )}
            {icon === "check" && (
              <Check
                className={`h-4 w-4 text-primary shrink-0 mt-0.5 ${bulletClassName}`}
                aria-hidden="true"
              />
            )}
            <span className="flex-1">{point}</span>
          </li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <p className="mt-1 text-xs text-muted-foreground italic">
          +{remainingCount} more
        </p>
      )}
    </div>
  );
}
