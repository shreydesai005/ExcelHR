import {
  NextRequest,
  NextResponse,
} from "next/server";

import { z } from "zod";

import {
  createSupabaseServerClient,
} from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const decisionSchema =
  z.object({
    recruiterDecision:
      z.enum([
        "pending",
        "approved",
        "rejected",
      ]),

    recruiterAgreesWithAi:
      z.boolean(),

    overrideReason:
      z.string().trim(),

    recruiterNotes:
      z.string().trim(),

    phoneVerified:
      z.boolean(),

    whatsappConsent:
      z.boolean(),

    finalWorkflowDecision:
      z.enum([
        "pending",
        "proceed",
        "do_not_proceed",
      ]),
  });

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id: jobCandidateId,
    } = await context.params;

    const body =
      await request.json();

    const parsed =
      decisionSchema.safeParse(
        body,
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid recruiter decision.",
          details:
            parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const decision =
      parsed.data;

    /*
     * If recruiter disagrees with
     * AI, override reason is mandatory.
     */

    if (
      !decision.recruiterAgreesWithAi &&
      decision.overrideReason.length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Override reason is required when the recruiter disagrees with the AI recommendation.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Proceed should normally mean
     * recruiter approved.
     */

    if (
      decision.finalWorkflowDecision ===
        "proceed" &&
      decision.recruiterDecision !==
        "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate must be approved before being marked to proceed.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      decision.finalWorkflowDecision ===
        "do_not_proceed" &&
      decision.recruiterDecision !==
        "rejected"
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate must be rejected before being marked Do Not Proceed.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      createSupabaseServerClient();

    /*
     * Load recruitment relation.
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
        candidate_id
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

    /*
     * Latest AI scorecard.
     */

    const {
      data: scorecard,
      error: scorecardError,
    } = await supabase
      .from(
        "candidate_scorecards",
      )
      .select(`
        id,
        recommendation,
        total_score
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

    if (
      scorecardError ||
      !scorecard
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate must be screened before finalisation.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Check if decision already exists.
     */

    const {
      data: existingDecision,
    } = await supabase
      .from(
        "candidate_decisions",
      )
      .select("id")
      .eq(
        "job_candidate_id",
        jobCandidateId,
      )
      .order(
        "updated_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();

    let savedDecision;

    if (existingDecision) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "candidate_decisions",
        )
        .update({
          scorecard_id:
            scorecard.id,

          ai_recommendation:
            scorecard.recommendation,

          recruiter_decision:
            decision.recruiterDecision,

          recruiter_agrees_with_ai:
            decision.recruiterAgreesWithAi,

          override_reason:
            decision.overrideReason ||
            null,

          recruiter_notes:
            decision.recruiterNotes ||
            null,

          phone_verified:
            decision.phoneVerified,

          whatsapp_consent:
            decision.whatsappConsent,

          final_workflow_decision:
            decision.finalWorkflowDecision,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingDecision.id,
        )
        .select()
        .single();

      if (error) {
        console.error(
          "DECISION UPDATE ERROR:",
          error.message,
        );

        return NextResponse.json(
          {
            error:
              "Unable to update recruiter decision.",
          },
          {
            status: 500,
          },
        );
      }

      savedDecision =
        data;
    } else {
      const {
        data,
        error,
      } = await supabase
        .from(
          "candidate_decisions",
        )
        .insert({
          job_candidate_id:
            jobCandidateId,

          scorecard_id:
            scorecard.id,

          ai_recommendation:
            scorecard.recommendation,

          recruiter_decision:
            decision.recruiterDecision,

          recruiter_agrees_with_ai:
            decision.recruiterAgreesWithAi,

          override_reason:
            decision.overrideReason ||
            null,

          recruiter_notes:
            decision.recruiterNotes ||
            null,

          phone_verified:
            decision.phoneVerified,

          whatsapp_consent:
            decision.whatsappConsent,

          final_workflow_decision:
            decision.finalWorkflowDecision,
        })
        .select()
        .single();

      if (error) {
        console.error(
          "DECISION INSERT ERROR:",
          error.message,
        );

        return NextResponse.json(
          {
            error:
              "Unable to save recruiter decision.",
          },
          {
            status: 500,
          },
        );
      }

      savedDecision =
        data;
    }

    /*
     * Update recruitment workflow.
     */

    let workflowStatus =
      "finalisation";

    if (
      decision.finalWorkflowDecision ===
      "proceed"
    ) {
      workflowStatus =
        "approved_for_outreach";
    }

    if (
      decision.finalWorkflowDecision ===
      "do_not_proceed"
    ) {
      workflowStatus =
        "rejected";
    }

    await supabase
      .from(
        "job_candidates",
      )
      .update({
        workflow_status:
          workflowStatus,
      })
      .eq(
        "id",
        jobCandidateId,
      );

    /*
     * Audit trail.
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
          jobCandidateId,

        event_type:
          "candidate_finalised",

        event_data: {
          scorecard_id:
            scorecard.id,

          ai_recommendation:
            scorecard.recommendation,

          ai_score:
            scorecard.total_score,

          recruiter_decision:
            decision.recruiterDecision,

          recruiter_agrees_with_ai:
            decision.recruiterAgreesWithAi,

          final_workflow_decision:
            decision.finalWorkflowDecision,

          phone_verified:
            decision.phoneVerified,

          whatsapp_consent:
            decision.whatsappConsent,

          override_reason:
            decision.overrideReason ||
            null,
        },
      });

    return NextResponse.json({
      success: true,
      decision:
        savedDecision,
    });
  } catch (error) {
    console.error(
      "DECISION API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save recruiter decision.",
      },
      {
        status: 500,
      },
    );
  }
}