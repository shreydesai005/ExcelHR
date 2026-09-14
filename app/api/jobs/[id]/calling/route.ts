import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCallingProviderStatus } from "@/lib/calling-provider";

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

    /*
     * ---------------------------------------------
     * Load candidates approved for outreach
     * ---------------------------------------------
     */

    const {
      data: jobCandidates,
      error: candidateError,
    } = await supabase
      .from("job_candidates")
      .select(`
        id,
        job_id,
        candidate_id,
        workflow_status,
        candidates (
          id,
          full_name,
          email_address,
          phone_number,
          normalized_phone,
          current_job_title,
          current_employer,
          total_experience_years,
          current_location
        )
      `)
      .eq("job_id", jobId)
      .eq("workflow_status", "approved_for_outreach")
      .order("created_at", {
        ascending: true,
      });

    if (candidateError) {
      console.error(
        "CALLING CANDIDATES ERROR:",
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
        provider: getCallingProviderStatus(),
        candidates: [],
      });
    }

    const jobCandidateIds = rows.map(
      (item) => item.id,
    );

    /*
     * ---------------------------------------------
     * Load recruiter decisions
     * ---------------------------------------------
     */

    const {
      data: decisions,
      error: decisionError,
    } = await supabase
      .from("candidate_decisions")
      .select(`
        id,
        job_candidate_id,
        recruiter_decision,
        final_workflow_decision,
        phone_verified,
        whatsapp_consent,
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
        "CALLING DECISION ERROR:",
        decisionError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to load recruiter decisions.",
        },
        {
          status: 500,
        },
      );
    }

    const decisionMap = new Map<
      string,
      any
    >();

    for (const decision of decisions ?? []) {
      if (
        !decisionMap.has(
          decision.job_candidate_id,
        )
      ) {
        decisionMap.set(
          decision.job_candidate_id,
          decision,
        );
      }
    }

    /*
     * ---------------------------------------------
     * Load WhatsApp communication
     * ---------------------------------------------
     */

    const {
      data: communicationEvents,
      error: communicationError,
    } = await supabase
      .from("communication_events")
      .select(`
        id,
        job_candidate_id,
        communication_status,
        provider_name,
        provider_message_id,
        recipient_normalized,
        updated_at,
        created_at
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
        "CALLING COMMUNICATION ERROR:",
        communicationError.message,
      );
    }

    const communicationMap = new Map<
      string,
      any
    >();

    for (
      const event of communicationEvents ??
      []
    ) {
      if (
        !communicationMap.has(
          event.job_candidate_id,
        )
      ) {
        communicationMap.set(
          event.job_candidate_id,
          event,
        );
      }
    }

    /*
     * ---------------------------------------------
     * Load latest call event
     * ---------------------------------------------
     */

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
        "CALL EVENTS ERROR:",
        callError.message,
      );
    }

    const callMap = new Map<
      string,
      any
    >();

    for (const call of callEvents ?? []) {
      if (
        !callMap.has(
          call.job_candidate_id,
        )
      ) {
        callMap.set(
          call.job_candidate_id,
          call,
        );
      }
    }

    /*
     * ---------------------------------------------
     * Build calling queue
     * ---------------------------------------------
     */

    const candidates = rows.map(
      (item) => {
        const candidate = Array.isArray(
          item.candidates,
        )
          ? item.candidates[0] ?? null
          : item.candidates;

        const decision =
          decisionMap.get(item.id) ??
          null;

        const communication =
          communicationMap.get(item.id) ??
          null;

        const call =
          callMap.get(item.id) ?? null;

        const hasPhone = Boolean(
          candidate?.normalized_phone ||
            candidate?.phone_number,
        );

        const recruiterApproved =
          decision?.recruiter_decision ===
          "approved";

        const proceed =
          decision
            ?.final_workflow_decision ===
          "proceed";

        const phoneVerified =
          decision?.phone_verified === true;

        /*
         * Candidate becomes call-eligible only
         * after an actual interested response.
         *
         * We do NOT treat "ready" or "sent"
         * as interest.
         */

        const whatsappInterested =
          communication
            ?.communication_status ===
          "interested";

        const eligible =
          recruiterApproved &&
          proceed &&
          hasPhone &&
          phoneVerified &&
          whatsappInterested;

        const blockers: string[] = [];

        if (!recruiterApproved) {
          blockers.push(
            "Recruiter approval required",
          );
        }

        if (!proceed) {
          blockers.push(
            "Final decision must be Proceed",
          );
        }

        if (!hasPhone) {
          blockers.push(
            "Phone number missing",
          );
        }

        if (!phoneVerified) {
          blockers.push(
            "Phone number not verified",
          );
        }

        if (!whatsappInterested) {
          blockers.push(
            "Candidate has not been recorded as Interested through WhatsApp",
          );
        }

        return {
          id: item.id,
          candidateId:
            item.candidate_id,
          workflowStatus:
            item.workflow_status,

          candidate,
          decision,
          communication,
          call,

          eligible,
          blockers,
        };
      },
    );

    return NextResponse.json({
      success: true,
      provider:
        getCallingProviderStatus(),
      candidates,
    });
  } catch (error) {
    console.error(
      "CALLING QUEUE API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load AI calling queue.",
      },
      {
        status: 500,
      },
    );
  }
}