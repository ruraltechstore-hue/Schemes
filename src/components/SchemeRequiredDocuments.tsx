import { Link } from "react-router-dom";
import { FileCheck2, FileX2, FileText } from "lucide-react";
import { splitRequiredDocuments } from "@/lib/document-helpers";

export interface SchemeRequiredDocumentsProps {
  documents: string[] | string | null | undefined;
  missingDocs?: string[];
  showUploadLink?: boolean;
  className?: string;
  title?: string;
}

/**
 * Shared component for displaying Required Documents on scheme details pages.
 * Displays every document on a separate line as a bullet point / list item.
 */
export function SchemeRequiredDocuments({
  documents,
  missingDocs,
  showUploadLink = true,
  className = "",
  title = "Required documents",
}: SchemeRequiredDocumentsProps) {
  const docs = splitRequiredDocuments(documents);

  const missingLowerSet = new Set((missingDocs ?? []).map((d) => d.trim().toLowerCase()));

  return (
    <div className={`rounded-lg border bg-card p-6 shadow-card ${className}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {docs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No specific documents required.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm" data-testid="required-documents-list">
          {docs.map((d, index) => {
            const isMissing =
              missingDocs !== undefined &&
              (missingDocs.includes(d) || missingLowerSet.has(d.trim().toLowerCase()));
            const has = missingDocs !== undefined ? !isMissing : true;

            return (
              <li
                key={`${d}-${index}`}
                className="flex items-center gap-2 py-0.5"
                data-testid="required-document-item"
              >
                {missingDocs !== undefined ? (
                  has ? (
                    <FileCheck2 className="h-4 w-4 shrink-0 text-success" aria-label="Document uploaded" />
                  ) : (
                    <FileX2 className="h-4 w-4 shrink-0 text-destructive" aria-label="Document missing" />
                  )
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground">{d}</span>
                {missingDocs !== undefined && !has && showUploadLink && (
                  <Link
                    to="/documents"
                    className="ml-auto text-xs text-primary underline hover:text-primary/80 transition-colors"
                  >
                    Upload
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
