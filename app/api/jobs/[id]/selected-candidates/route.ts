import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id: jobId } =
      await context.params;

    const supabase =
      createSupabaseServerClient();

    const {
      data:
        jobCandidates,
      error,
    } = await supabase
      .from(
        "job_candidates",
      )
      .select(`
        id,
        candidate_id,
        initial_selected,
        recruiter_review_status,
        workflow_status,
        candidates (
          id,
          full_name,
          email_address,
          phone_number,
          current_job_title,
          current_employer,
          total_experience_years,
          current_location,
          notice_period_days,
          education_summary,
          skills,
          duplicate_flag
        )
      `)
      .eq(
        "job_id",
        jobId,
      )
      .eq(
        "initial_selected",
        true,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

    if (error) {
      console.error(
        "SELECTED CANDIDATES ERROR:",
        error.code,
        error.message,
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        },
      );
    }

    const candidateIds =
      (
        jobCandidates ??
        []
      )
        .map(
          (item) =>
            item.candidate_id,
        )
        .filter(Boolean);

    let documents: any[] =
      [];

    if (
      candidateIds.length >
      0
    ) {
      const {
        data:
          documentData,
        error:
          documentsError,
      } = await supabase
        .from(
          "candidate_documents",
        )
        .select(`
          id,
          candidate_id,
          job_id,
          document_type,
          original_file_name,
          parsing_status,
          extracted_data,
          created_at
        `)
        .eq(
          "job_id",
          jobId,
        )
        .in(
          "candidate_id",
          candidateIds,
        )
        .in(
          "document_type",
          [
            "cv_pdf",
            "cv_docx",
            "scanned_cv",
          ],
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (
        documentsError
      ) {
        console.error(
          "CV DOCUMENT LOAD ERROR:",
          documentsError.message,
        );
      } else {
        documents =
          documentData ??
          [];
      }
    }

    const result =
      (
        jobCandidates ??
        []
      ).map(
        (item) => {
          const cv =
            documents.find(
              (document) =>
                document.candidate_id ===
                item.candidate_id,
            ) ??
            null;

          return {
            ...item,

            cvDocument:
              cv,
          };
        },
      );

    return NextResponse.json({
      success: true,
      candidates:
        result,
    });
  } catch (error) {
    console.error(
      "SELECTED CANDIDATES API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load selected candidates.",
      },
      {
        status: 500,
      },
    );
  }
}