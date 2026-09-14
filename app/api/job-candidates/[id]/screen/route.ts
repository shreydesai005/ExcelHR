import {
  NextRequest,
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

type ScreeningComponent = {
  key: string;
  label: string;
  score: number | null;
  configuredWeight: number;
  contribution: number;
  confidence: number;
  missingInformation: boolean;
  explanation: string;

  evidence: Array<{
    requirement?: string | null;
    candidateEvidence?: string | null;
    similarity?: number | null;
    matched?: boolean | null;
  }>;
};

type ScreeningResponse = {
  totalScore: number;
  recommendation:
    | "strong_match"
    | "review_recommended"
    | "weak_match"
    | "insufficient_information";

  confidenceScore: number;
  qualifyingScore: number;

  components:
    ScreeningComponent[];

  missingInformationCount: number;

  modelMetadata: {
    embeddingModel: string;
    scoringPolicy: string;
    skillMatchPolicy: string;
  };
};

export const runtime =
  "nodejs";

/*
 * =====================================================
 * GET latest stored scorecard
 * =====================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id: jobCandidateId,
    } = await context.params;

    const supabase =
      createSupabaseServerClient();

    const {
      data: scorecard,
      error,
    } = await supabase
      .from(
        "candidate_scorecards",
      )
      .select(`
        id,
        total_score,
        recommendation,
        confidence_score,
        missing_information_count,
        parser_version,
        ocr_version,
        taxonomy_version,
        embedding_model_version,
        scoring_policy_version,
        assessment_timestamp,
        created_at
      `)
      .eq(
        "job_candidate_id",
        jobCandidateId,
      )
      .order(
        "assessment_timestamp",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "LOAD SCORECARD ERROR:",
        error.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load scorecard.",
        },
        {
          status: 500,
        },
      );
    }

    if (!scorecard) {
      return NextResponse.json({
        success: true,
        scorecard: null,
        components: [],
      });
    }

    const {
      data: components,
      error: componentsError,
    } = await supabase
      .from(
        "candidate_score_components",
      )
      .select(`
        id,
        component_key,
        component_label,
        jd_requirement,
        candidate_value,
        component_score,
        configured_weight,
        score_contribution,
        evidence_excerpt,
        evidence_location,
        confidence_score,
        missing_information
      `)
      .eq(
        "scorecard_id",
        scorecard.id,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

    if (componentsError) {
      console.error(
        "LOAD SCORE COMPONENTS ERROR:",
        componentsError.message,
      );
    }

    return NextResponse.json({
      success: true,
      scorecard,
      components:
        components ?? [],
    });
  } catch (error) {
    console.error(
      "LOAD SCREENING ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load screening result.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * =====================================================
 * POST run real screening
 * =====================================================
 */

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id: jobCandidateId,
    } = await context.params;

    const supabase =
      createSupabaseServerClient();

    /*
     * -------------------------------------------------
     * Load job/candidate link
     * -------------------------------------------------
     */

    const {
      data: jobCandidate,
      error:
        jobCandidateError,
    } = await supabase
      .from(
        "job_candidates",
      )
      .select(`
        id,
        job_id,
        candidate_id,
        initial_selected,
        workflow_status
      `)
      .eq(
        "id",
        jobCandidateId,
      )
      .single();

    if (
      jobCandidateError ||
      !jobCandidate
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate recruitment record not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !jobCandidate.initial_selected
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate was not selected for CV screening.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Load job
     * -------------------------------------------------
     */

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(`
        id,
        job_title,
        location,
        min_experience_years,
        max_experience_years,
        max_notice_period_days,
        education_requirements,
        jd_text,
        required_skills,
        preferred_skills,
        knockout_criteria,
        qualifying_score,
        scoring_weights
      `)
      .eq(
        "id",
        jobCandidate.job_id,
      )
      .single();

    if (
      jobError ||
      !job
    ) {
      return NextResponse.json(
        {
          error:
            "Job data could not be loaded.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Load candidate
     * -------------------------------------------------
     */

    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidates")
      .select(`
        id,
        full_name,
        current_job_title,
        total_experience_years,
        current_location,
        preferred_location,
        notice_period_days,
        education_summary,
        skills
      `)
      .eq(
        "id",
        jobCandidate.candidate_id,
      )
      .single();

    if (
      candidateError ||
      !candidate
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate data could not be loaded.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Load latest completed CV
     * -------------------------------------------------
     */

    const {
      data: document,
      error: documentError,
    } = await supabase
      .from(
        "candidate_documents",
      )
      .select(`
        id,
        document_type,
        parsing_status,
        extracted_data,
        original_file_name
      `)
      .eq(
        "candidate_id",
        candidate.id,
      )
      .eq(
        "job_id",
        job.id,
      )
      .in(
        "document_type",
        [
          "cv_pdf",
          "cv_docx",
        ],
      )
      .eq(
        "parsing_status",
        "completed",
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    if (documentError) {
      console.error(
        "CV LOAD ERROR:",
        documentError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load candidate CV.",
        },
        {
          status: 500,
        },
      );
    }

    if (!document) {
      return NextResponse.json(
        {
          error:
            "Candidate CV must be parsed before screening.",
        },
        {
          status: 400,
        },
      );
    }

    const extractedData =
      document.extracted_data as
        | {
            raw_text?: string;
          }
        | null;

    const cvText =
      extractedData?.raw_text ??
      "";

    if (!cvText.trim()) {
      return NextResponse.json(
        {
          error:
            "Parsed CV does not contain extracted text.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Validate weights
     * -------------------------------------------------
     */

    const scoringWeights =
      job.scoring_weights as Record<
        string,
        number
      >;

    if (!scoringWeights) {
      return NextResponse.json(
        {
          error:
            "Job scoring weights are missing.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Prepare request to OUR model
     * -------------------------------------------------
     */

    const modelPayload = {
      job: {
        jobTitle:
          job.job_title,

        location:
          job.location,

        minExperience:
          job.min_experience_years,

        maxExperience:
          job.max_experience_years,

        maxNoticePeriod:
          job.max_notice_period_days,

        education:
          job.education_requirements,

        jdText:
          job.jd_text,

        requiredSkills:
          Array.isArray(
            job.required_skills,
          )
            ? job.required_skills
            : [],

        preferredSkills:
          Array.isArray(
            job.preferred_skills,
          )
            ? job.preferred_skills
            : [],

        knockoutCriteria:
          Array.isArray(
            job.knockout_criteria,
          )
            ? job.knockout_criteria
            : [],

        qualifyingScore:
          job.qualifying_score,

        scoringWeights,
      },

      candidate: {
        fullName:
          candidate.full_name,

        currentJobTitle:
          candidate.current_job_title,

        totalExperienceYears:
          candidate.total_experience_years,

        currentLocation:
          candidate.current_location,

        noticePeriodDays:
          candidate.notice_period_days,

        educationSummary:
          candidate.education_summary,

        skills:
          Array.isArray(
            candidate.skills,
          )
            ? candidate.skills
            : [],

        cvText,
      },
    };

    /*
     * -------------------------------------------------
     * Call Excel HR Python model
     * -------------------------------------------------
     */

    const modelServiceUrl =
      process.env
        .CV_MODEL_SERVICE_URL;

    if (!modelServiceUrl) {
      return NextResponse.json(
        {
          error:
            "CV model service URL is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    let modelResponse:
      Response;

    try {
      modelResponse =
        await fetch(
          `${modelServiceUrl}/screen`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                modelPayload,
              ),

            cache:
              "no-store",
          },
        );
    } catch (error) {
      console.error(
        "MODEL CONNECTION ERROR:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Excel HR screening service is not reachable. Make sure the Python model service is running.",
        },
        {
          status: 503,
        },
      );
    }

    let screeningResult:
      ScreeningResponse;

    try {
      screeningResult =
        await modelResponse.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Screening service returned an invalid response.",
        },
        {
          status: 502,
        },
      );
    }

    if (!modelResponse.ok) {
      console.error(
        "MODEL SERVICE ERROR:",
        screeningResult,
      );

      return NextResponse.json(
        {
          error:
            "Screening model was unable to evaluate the candidate.",
        },
        {
          status: 502,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Find/create model version
     * -------------------------------------------------
     */

    const embeddingVersion =
      screeningResult
        .modelMetadata
        .embeddingModel;

    const scoringVersion =
      screeningResult
        .modelMetadata
        .scoringPolicy;

    const {
      data:
        existingModelVersion,
    } = await supabase
      .from(
        "model_versions",
      )
      .select("id")
      .eq(
        "parser_version",
        "excel-parser-v1",
      )
      .eq(
        "taxonomy_version",
        "excel-taxonomy-v1",
      )
      .eq(
        "embedding_model_version",
        embeddingVersion,
      )
      .eq(
        "scoring_policy_version",
        scoringVersion,
      )
      .eq(
        "is_active",
        true,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    let modelVersionId =
      existingModelVersion?.id ??
      null;

    if (!modelVersionId) {
      const {
        data:
          modelVersion,
        error:
          modelVersionError,
      } = await supabase
        .from(
          "model_versions",
        )
        .insert({
          parser_version:
            "excel-parser-v1",

          ocr_version:
            null,

          taxonomy_version:
            "excel-taxonomy-v1",

          embedding_model_version:
            embeddingVersion,

          scoring_policy_version:
            scoringVersion,

          is_active:
            true,

          metadata: {
            skillMatchPolicy:
              screeningResult
                .modelMetadata
                .skillMatchPolicy,
          },
        })
        .select("id")
        .single();

      if (
        modelVersionError ||
        !modelVersion
      ) {
        console.error(
          "MODEL VERSION ERROR:",
          modelVersionError?.message,
        );

        return NextResponse.json(
          {
            error:
              "Screening completed but model version could not be recorded.",
          },
          {
            status: 500,
          },
        );
      }

      modelVersionId =
        modelVersion.id;
    }

    /*
     * -------------------------------------------------
     * Create scorecard
     * -------------------------------------------------
     */

    const {
      data: scorecard,
      error:
        scorecardError,
    } = await supabase
      .from(
        "candidate_scorecards",
      )
      .insert({
        job_candidate_id:
          jobCandidate.id,

        model_version_id:
          modelVersionId,

        total_score:
          screeningResult.totalScore,

        recommendation:
          screeningResult.recommendation,

        confidence_score:
          screeningResult.confidenceScore,

        missing_information_count:
          screeningResult.missingInformationCount,

        parser_version:
          "excel-parser-v1",

        ocr_version:
          null,

        taxonomy_version:
          "excel-taxonomy-v1",

        embedding_model_version:
          embeddingVersion,

        scoring_policy_version:
          scoringVersion,

        assessment_timestamp:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (
      scorecardError ||
      !scorecard
    ) {
      console.error(
        "SCORECARD ERROR:",
        scorecardError?.message,
      );

      return NextResponse.json(
        {
          error:
            "Screening completed but scorecard could not be stored.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Store score components
     * -------------------------------------------------
     */

    const componentRows =
      screeningResult.components.map(
        (component) => {
          const firstEvidence =
            component.evidence?.[0];

          const evidenceText =
            component.evidence
              ?.map((item) => {
                const requirement =
                  item.requirement ??
                  "";

                const evidence =
                  item.candidateEvidence ??
                  "";

                const similarity =
                  item.similarity !==
                  undefined &&
                  item.similarity !==
                  null
                    ? `Similarity: ${Math.round(
                        item.similarity *
                          100,
                      )}%`
                    : "";

                return [
                  requirement
                    ? `Requirement: ${requirement}`
                    : "",

                  evidence
                    ? `Evidence: ${evidence}`
                    : "",

                  similarity,
                ]
                  .filter(Boolean)
                  .join(" | ");
              })
              .filter(Boolean)
              .join("\n") ??
            "";

          return {
            scorecard_id:
              scorecard.id,

            component_key:
              component.key,

            component_label:
              component.label,

            jd_requirement:
              firstEvidence?.requirement ??
              null,

            candidate_value:
              firstEvidence
                ?.candidateEvidence ??
              null,

            component_score:
              component.score,

            configured_weight:
              component.configuredWeight,

            score_contribution:
              component.contribution,

            evidence_excerpt:
              evidenceText ||
              component.explanation,

            evidence_location:
              document.original_file_name
                ? `CV: ${document.original_file_name}`
                : "Candidate CV",

            confidence_score:
              component.confidence,

            missing_information:
              component.missingInformation,
          };
        },
      );

    if (
      componentRows.length >
      0
    ) {
      const {
        error:
          componentInsertError,
      } = await supabase
        .from(
          "candidate_score_components",
        )
        .insert(
          componentRows,
        );

      if (
        componentInsertError
      ) {
        console.error(
          "SCORE COMPONENT INSERT ERROR:",
          componentInsertError.message,
        );

        /*
         * Remove incomplete scorecard.
         */

        await supabase
          .from(
            "candidate_scorecards",
          )
          .delete()
          .eq(
            "id",
            scorecard.id,
          );

        return NextResponse.json(
          {
            error:
              "Unable to save score breakdown.",
          },
          {
            status: 500,
          },
        );
      }
    }

    /*
     * -------------------------------------------------
     * Update workflow
     * -------------------------------------------------
     */

    await supabase
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

    /*
     * -------------------------------------------------
     * Audit
     * -------------------------------------------------
     */

    await supabase
      .from(
        "recruitment_events",
      )
      .insert({
        job_id:
          jobCandidate.job_id,

        candidate_id:
          jobCandidate.candidate_id,

        job_candidate_id:
          jobCandidate.id,

        event_type:
          "candidate_screened",

        event_data: {
          scorecard_id:
            scorecard.id,

          total_score:
            screeningResult.totalScore,

          recommendation:
            screeningResult.recommendation,

          confidence_score:
            screeningResult.confidenceScore,

          embedding_model:
            embeddingVersion,

          scoring_policy:
            scoringVersion,
        },
      });

    return NextResponse.json(
      {
        success: true,

        scorecard,

        components:
          componentRows,

        result:
          screeningResult,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "RUN SCREENING ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to screen candidate.",
      },
      {
        status: 500,
      },
    );
  }
}