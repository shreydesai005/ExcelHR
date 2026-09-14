import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

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
    const { id: jobId } = await context.params;

    const supabase = createSupabaseServerClient();

    // --------------------------------------------------
    // JOB
    // --------------------------------------------------

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(`
        id,
        client_name,
        job_title,
        department,
        location,
        work_mode,
        min_experience_years,
        max_experience_years,
        max_notice_period_days,
        education_requirements,
        jd_text,
        required_skills,
        preferred_skills,
        knockout_criteria,
        scoring_weights,
        qualifying_score,
        workflow_stage,
        job_status,
        created_at,
        updated_at
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: "Recruitment not found.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // JOB CANDIDATES
    // --------------------------------------------------

    const {
      data: jobCandidates,
      error: candidateError,
    } = await supabase
      .from("job_candidates")
      .select(`
        id,
        candidate_id,
        initial_score,
        initial_selected,
        recruiter_review_status,
        workflow_status,
        created_at,
        updated_at,
        candidates (
          id,
          full_name,
          email_address,
          phone_number,
          normalized_email,
          normalized_phone,
          current_job_title,
          current_employer,
          total_experience_years,
          current_location,
          preferred_location,
          notice_period_days,
          education_summary,
          salary_text,
          skills,
          duplicate_flag,
          duplicate_status
        )
      `)
      .eq("job_id", jobId)
      .order("created_at", {
        ascending: true,
      });

    if (candidateError) {
      console.error(
        "REPORT CANDIDATE ERROR:",
        candidateError.message,
      );

      return NextResponse.json(
        {
          error: "Unable to load candidates.",
        },
        {
          status: 500,
        },
      );
    }

    const rows = jobCandidates ?? [];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        job,
        candidates: [],
        summary: {
          totalCandidates: 0,
          initiallySelected: 0,
          screened: 0,
          recruiterApproved: 0,
          recruiterRejected: 0,
          outreachEligible: 0,
          whatsappInterested: 0,
          callsCompleted: 0,
        },
      });
    }

    const jobCandidateIds = rows.map(
      (row) => row.id,
    );

    // --------------------------------------------------
    // SCORECARDS
    // --------------------------------------------------

    const {
      data: scorecards,
      error: scorecardError,
    } = await supabase
      .from("candidate_scorecards")
      .select(`
        id,
        job_candidate_id,
        model_version_id,
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
      .in(
        "job_candidate_id",
        jobCandidateIds,
      )
      .order("assessment_timestamp", {
        ascending: false,
      });

    if (scorecardError) {
      console.error(
        "REPORT SCORECARD ERROR:",
        scorecardError.message,
      );
    }

    const latestScorecardMap =
      new Map<string, any>();

    for (const scorecard of scorecards ?? []) {
      if (
        !latestScorecardMap.has(
          scorecard.job_candidate_id,
        )
      ) {
        latestScorecardMap.set(
          scorecard.job_candidate_id,
          scorecard,
        );
      }
    }

    const latestScorecardIds = Array.from(
      latestScorecardMap.values(),
    ).map((scorecard) => scorecard.id);

    // --------------------------------------------------
    // SCORE COMPONENTS
    // --------------------------------------------------

    let components: any[] = [];

    if (latestScorecardIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("candidate_score_components")
        .select(`
          id,
          scorecard_id,
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
          missing_information,
          created_at
        `)
        .in(
          "scorecard_id",
          latestScorecardIds,
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "REPORT COMPONENT ERROR:",
          error.message,
        );
      } else {
        components = data ?? [];
      }
    }

    const componentMap =
      new Map<string, any[]>();

    for (const component of components) {
      const existing =
        componentMap.get(
          component.scorecard_id,
        ) ?? [];

      existing.push(component);

      componentMap.set(
        component.scorecard_id,
        existing,
      );
    }

    // --------------------------------------------------
    // RECRUITER DECISIONS
    // --------------------------------------------------

    const {
      data: decisions,
      error: decisionError,
    } = await supabase
      .from("candidate_decisions")
      .select(`
        id,
        job_candidate_id,
        scorecard_id,
        ai_recommendation,
        recruiter_decision,
        final_workflow_decision,
        recruiter_agrees_with_ai,
        override_reason,
        recruiter_notes,
        corrected_extracted_values,
        corrected_skills,
        phone_verified,
        whatsapp_consent,
        created_at,
        updated_at
      `)
      .in(
        "job_candidate_id",
        jobCandidateIds,
      )
      .order("updated_at", {
        ascending: false,
      });

    if (decisionError) {
      console.error(
        "REPORT DECISION ERROR:",
        decisionError.message,
      );
    }

    const latestDecisionMap =
      new Map<string, any>();

    for (const decision of decisions ?? []) {
      if (
        !latestDecisionMap.has(
          decision.job_candidate_id,
        )
      ) {
        latestDecisionMap.set(
          decision.job_candidate_id,
          decision,
        );
      }
    }

    // --------------------------------------------------
    // COMMUNICATION
    // --------------------------------------------------

    const {
      data: communicationEvents,
      error: communicationError,
    } = await supabase
      .from("communication_events")
      .select(`
        id,
        job_candidate_id,
        provider_name,
        provider_message_id,
        communication_status,
        recipient_normalized,
        template_name,
        provider_error_code,
        provider_error_message,
        created_at,
        updated_at
      `)
      .in(
        "job_candidate_id",
        jobCandidateIds,
      )
      .order("created_at", {
        ascending: false,
      });

    if (communicationError) {
      console.error(
        "REPORT COMMUNICATION ERROR:",
        communicationError.message,
      );
    }

    const latestCommunicationMap =
      new Map<string, any>();

    for (
      const communication of
        communicationEvents ?? []
    ) {
      if (
        !latestCommunicationMap.has(
          communication.job_candidate_id,
        )
      ) {
        latestCommunicationMap.set(
          communication.job_candidate_id,
          communication,
        );
      }
    }

    // --------------------------------------------------
    // CALLS
    // --------------------------------------------------

    const {
      data: callEvents,
      error: callError,
    } = await supabase
      .from("call_events")
      .select(`
        id,
        job_candidate_id,
        provider_name,
        provider_call_id,
        call_status,
        call_language,
        scheduled_for,
        transcript_storage_path,
        recording_storage_path,
        provider_error_code,
        provider_error_message,
        created_at,
        updated_at
      `)
      .in(
        "job_candidate_id",
        jobCandidateIds,
      )
      .order("created_at", {
        ascending: false,
      });

    if (callError) {
      console.error(
        "REPORT CALL ERROR:",
        callError.message,
      );
    }

    const latestCallMap =
      new Map<string, any>();

    for (const call of callEvents ?? []) {
      if (
        !latestCallMap.has(
          call.job_candidate_id,
        )
      ) {
        latestCallMap.set(
          call.job_candidate_id,
          call,
        );
      }
    }

    // --------------------------------------------------
    // BUILD FINAL CANDIDATE RECORDS
    // --------------------------------------------------

    const candidates = rows.map((row) => {
      const candidate = Array.isArray(
        row.candidates,
      )
        ? row.candidates[0] ?? null
        : row.candidates;

      const scorecard =
        latestScorecardMap.get(row.id) ??
        null;

      const scoreComponents =
        scorecard
          ? componentMap.get(
              scorecard.id,
            ) ?? []
          : [];

      const decision =
        latestDecisionMap.get(row.id) ??
        null;

      const communication =
        latestCommunicationMap.get(row.id) ??
        null;

      const call =
        latestCallMap.get(row.id) ??
        null;

      return {
        id: row.id,
        candidateId: row.candidate_id,

        initialSelected:
          row.initial_selected,

        recruiterReviewStatus:
          row.recruiter_review_status,

        workflowStatus:
          row.workflow_status,

        candidate,

        scorecard,

        scoreComponents,

        decision,

        communication,

        call,
      };
    });

    // --------------------------------------------------
    // REAL SUMMARY
    // --------------------------------------------------

    const summary = {
      totalCandidates:
        candidates.length,

      initiallySelected:
        candidates.filter(
          (candidate) =>
            candidate.initialSelected,
        ).length,

      screened:
        candidates.filter(
          (candidate) =>
            Boolean(
              candidate.scorecard,
            ),
        ).length,

      recruiterApproved:
        candidates.filter(
          (candidate) =>
            candidate.decision
              ?.recruiter_decision ===
            "approved",
        ).length,

      recruiterRejected:
        candidates.filter(
          (candidate) =>
            candidate.decision
              ?.recruiter_decision ===
            "rejected",
        ).length,

      outreachEligible:
        candidates.filter(
          (candidate) =>
            candidate.decision
              ?.final_workflow_decision ===
              "proceed" &&
            candidate.decision
              ?.phone_verified ===
              true &&
            candidate.decision
              ?.whatsapp_consent ===
              true,
        ).length,

      whatsappInterested:
        candidates.filter(
          (candidate) =>
            candidate.communication
              ?.communication_status ===
            "interested",
        ).length,

      callsCompleted:
        candidates.filter(
          (candidate) =>
            candidate.call
              ?.call_status ===
            "completed",
        ).length,
    };

    return NextResponse.json({
      success: true,
      job,
      candidates,
      summary,
      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "FINAL REPORT API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate recruitment report.",
      },
      {
        status: 500,
      },
    );
  }
}