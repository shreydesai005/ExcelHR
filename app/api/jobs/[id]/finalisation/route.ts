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
    const { id: jobId } =
      await context.params;

    const supabase =
      createSupabaseServerClient();

    /*
     * Load candidates attached to
     * this recruitment.
     */

    const {
      data: jobCandidates,
      error: jobCandidateError,
    } = await supabase
      .from("job_candidates")
      .select(`
        id,
        candidate_id,
        initial_selected,
        workflow_status,
        recruiter_review_status,
        candidates (
          id,
          full_name,
          email_address,
          phone_number,
          current_job_title,
          current_employer,
          total_experience_years,
          current_location,
          preferred_location,
          notice_period_days,
          education_summary,
          skills,
          duplicate_flag
        )
      `)
      .eq("job_id", jobId)
      .eq("initial_selected", true)
      .order("created_at", {
        ascending: true,
      });

    if (jobCandidateError) {
      console.error(
        "FINALISATION CANDIDATES ERROR:",
        jobCandidateError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load candidates.",
        },
        {
          status: 500,
        },
      );
    }

    const candidateRows =
      jobCandidates ?? [];

    const jobCandidateIds =
      candidateRows.map(
        (item) => item.id,
      );

    if (
      jobCandidateIds.length === 0
    ) {
      return NextResponse.json({
        success: true,
        candidates: [],
      });
    }

    /*
     * Load scorecards.
     */

    const {
      data: scorecards,
      error: scorecardError,
    } = await supabase
      .from("candidate_scorecards")
      .select(`
        id,
        job_candidate_id,
        total_score,
        recommendation,
        confidence_score,
        missing_information_count,
        assessment_timestamp,
        created_at
      `)
      .in(
        "job_candidate_id",
        jobCandidateIds,
      )
      .order(
        "assessment_timestamp",
        {
          ascending: false,
        },
      );

    if (scorecardError) {
      console.error(
        "FINALISATION SCORECARD ERROR:",
        scorecardError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load screening results.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Keep only latest scorecard
     * per candidate.
     */

    const latestScorecardMap =
      new Map<
        string,
        any
      >();

    for (
      const scorecard of
      scorecards ?? []
    ) {
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

    const latestScorecardIds =
      Array.from(
        latestScorecardMap.values(),
      ).map(
        (scorecard) =>
          scorecard.id,
      );

    let components: any[] =
      [];

    if (
      latestScorecardIds.length >
      0
    ) {
      const {
        data:
          componentRows,
        error:
          componentError,
      } = await supabase
        .from(
          "candidate_score_components",
        )
        .select(`
          id,
          scorecard_id,
          component_key,
          component_label,
          component_score,
          configured_weight,
          score_contribution,
          evidence_excerpt,
          confidence_score,
          missing_information
        `)
        .in(
          "scorecard_id",
          latestScorecardIds,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        );

      if (componentError) {
        console.error(
          "FINALISATION COMPONENT ERROR:",
          componentError.message,
        );
      } else {
        components =
          componentRows ??
          [];
      }
    }

    /*
     * Load latest recruiter decision.
     */

    const {
      data: decisions,
      error: decisionError,
    } = await supabase
      .from(
        "candidate_decisions",
      )
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
      .order(
        "updated_at",
        {
          ascending: false,
        },
      );

    if (decisionError) {
      console.error(
        "FINALISATION DECISION ERROR:",
        decisionError.message,
      );
    }

    const latestDecisionMap =
      new Map<
        string,
        any
      >();

    for (
      const decision of
      decisions ?? []
    ) {
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

    /*
     * Combine everything.
     */

    const result =
      candidateRows
        .map((item) => {
          const scorecard =
            latestScorecardMap.get(
              item.id,
            ) ?? null;

          if (!scorecard) {
            return null;
          }

          return {
            ...item,

            scorecard,

            components:
              components.filter(
                (component) =>
                  component.scorecard_id ===
                  scorecard.id,
              ),

            decision:
              latestDecisionMap.get(
                item.id,
              ) ?? null,
          };
        })
        .filter(Boolean);

    return NextResponse.json({
      success: true,
      candidates: result,
    });
  } catch (error) {
    console.error(
      "FINALISATION API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load finalisation data.",
      },
      {
        status: 500,
      },
    );
  }
}