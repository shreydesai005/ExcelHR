import {
  NextRequest,
  NextResponse,
} from "next/server";

import { randomUUID } from "crypto";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getExtension(
  mimeType: string,
) {
  if (
    mimeType ===
    "application/pdf"
  ) {
    return "pdf";
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  return null;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: candidateId } =
      await context.params;

    const formData =
      await request.formData();

    const jobId = String(
      formData.get("jobId") ?? "",
    ).trim();

    const file =
      formData.get("cv");

    if (!jobId) {
      return NextResponse.json(
        {
          error:
            "Job ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !(file instanceof File) ||
      file.size === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please select a CV.",
        },
        {
          status: 400,
        },
      );
    }

    const extension =
      getExtension(
        file.type,
      );

    if (!extension) {
      return NextResponse.json(
        {
          error:
            "Only PDF and DOCX CVs are supported.",
        },
        {
          status: 400,
        },
      );
    }

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error:
            "CV must be 10 MB or smaller.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      createSupabaseServerClient();

    /*
     * Confirm candidate belongs
     * to this recruitment and was
     * selected in Stage 2.
     */

    const {
      data: jobCandidate,
      error:
        jobCandidateError,
    } = await supabase
      .from("job_candidates")
      .select(`
        id,
        candidate_id,
        initial_selected
      `)
      .eq(
        "job_id",
        jobId,
      )
      .eq(
        "candidate_id",
        candidateId,
      )
      .eq(
        "initial_selected",
        true,
      )
      .single();

    if (
      jobCandidateError ||
      !jobCandidate
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate is not selected for CV screening.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Check whether this candidate
     * already has a CV for this job.
     */

    const {
      data: existingDocuments,
      error: existingError,
    } = await supabase
      .from(
        "candidate_documents",
      )
      .select(
        "id, storage_bucket, storage_path",
      )
      .eq(
        "candidate_id",
        candidateId,
      )
      .eq(
        "job_id",
        jobId,
      )
      .in(
        "document_type",
        [
          "cv_pdf",
          "cv_docx",
          "scanned_cv",
        ],
      );

    if (existingError) {
      console.error(
        "EXISTING CV CHECK ERROR:",
        existingError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing CV.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Safe generated filename.
     * Never trust the original
     * filename as a storage path.
     */

    const storagePath =
      `${jobId}/${candidateId}/cv-${randomUUID()}.${extension}`;

    const arrayBuffer =
      await file.arrayBuffer();

    /*
     * Upload to private Supabase
     * Storage bucket.
     */

    const {
      error: uploadError,
    } = await supabase.storage
      .from(
        "candidate-documents",
      )
      .upload(
        storagePath,
        arrayBuffer,
        {
          contentType:
            file.type,
          upsert: false,
        },
      );

    if (uploadError) {
      console.error(
        "CV STORAGE ERROR:",
        uploadError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to upload CV.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Create database document
     * record.
     */

    const documentType =
      extension === "pdf"
        ? "cv_pdf"
        : "cv_docx";

    const {
      data: document,
      error: documentError,
    } = await supabase
      .from(
        "candidate_documents",
      )
      .insert({
        candidate_id:
          candidateId,

        job_id:
          jobId,

        document_type:
          documentType,

        storage_bucket:
          "candidate-documents",

        storage_path:
          storagePath,

        original_file_name:
          file.name,

        mime_type:
          file.type,

        file_size_bytes:
          file.size,

        parsing_status:
          "pending",

        extracted_data: {},
      })
      .select()
      .single();

    if (
      documentError ||
      !document
    ) {
      /*
       * Roll back uploaded file if
       * DB record fails.
       */

      await supabase.storage
        .from(
          "candidate-documents",
        )
        .remove([
          storagePath,
        ]);

      console.error(
        "CV DOCUMENT ERROR:",
        documentError?.message,
      );

      return NextResponse.json(
        {
          error:
            documentError?.message ||
            "Unable to save CV record.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Remove older CVs only AFTER
     * the new upload succeeded.
     */

    if (
      existingDocuments &&
      existingDocuments.length > 0
    ) {
      const oldPaths =
        existingDocuments
          .filter(
            (item) =>
              item.storage_bucket ===
              "candidate-documents",
          )
          .map(
            (item) =>
              item.storage_path,
          )
          .filter(
            (path) =>
              path !==
              storagePath,
          );

      if (
        oldPaths.length > 0
      ) {
        const {
          error: removalError,
        } =
          await supabase.storage
            .from(
              "candidate-documents",
            )
            .remove(
              oldPaths,
            );

        if (removalError) {
          console.error(
            "OLD CV STORAGE CLEANUP ERROR:",
            removalError.message,
          );
        }
      }

      const oldIds =
        existingDocuments.map(
          (item) =>
            item.id,
        );

      if (
        oldIds.length > 0
      ) {
        const {
          error:
            oldDocumentDeleteError,
        } = await supabase
          .from(
            "candidate_documents",
          )
          .delete()
          .in(
            "id",
            oldIds,
          );

        if (
          oldDocumentDeleteError
        ) {
          console.error(
            "OLD CV DB CLEANUP ERROR:",
            oldDocumentDeleteError.message,
          );
        }
      }
    }

    /*
     * Candidate is now ready
     * for parsing/model screening.
     */

    const {
      error: statusError,
    } = await supabase
      .from(
        "job_candidates",
      )
      .update({
        workflow_status:
          "cv_screening",
      })
      .eq(
        "id",
        jobCandidate.id,
      );

    if (statusError) {
      console.error(
        "CV STATUS ERROR:",
        statusError.message,
      );
    }

    /*
     * Audit trail
     */

    await supabase
      .from(
        "recruitment_events",
      )
      .insert({
        job_id:
          jobId,

        candidate_id:
          candidateId,

        job_candidate_id:
          jobCandidate.id,

        event_type:
          "cv_uploaded",

        event_data: {
          document_id:
            document.id,

          document_type:
            documentType,

          original_file_name:
            file.name,

          parsing_status:
            "pending",
        },
      });

    return NextResponse.json(
      {
        success: true,

        document: {
          id:
            document.id,

          originalFileName:
            document.original_file_name,

          documentType:
            document.document_type,

          parsingStatus:
            document.parsing_status,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "CV UPLOAD API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to process CV upload.",
      },
      {
        status: 500,
      },
    );
  }
}