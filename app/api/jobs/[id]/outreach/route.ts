import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getWhatsAppProviderStatus } from "@/lib/providers";

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
     * -------------------------------------------------
     * Load candidates marked for outreach
     * -------------------------------------------------
     */

    const {
      data: jobCandidates,
      error: jobCandidateError,
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

    if (jobCandidateError) {
      console.error(
        "OUTREACH CANDIDATES ERROR:",
        jobCandidateError.message,
      );

      return NextResponse.json(
        {
          error: "Unable to load outreach candidates.",
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
        provider: getWhatsAppProviderStatus(),
        candidates: [],
      });
    }

    const ids = rows.map((item) => item.id);

    /*
     * -------------------------------------------------
     * Load recruiter decisions
     * -------------------------------------------------
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
      .in("job_candidate_id", ids)
      .order("updated_at", {
        ascending: false,
      });

    if (decisionError) {
      console.error(
        "OUTREACH DECISION ERROR:",
        decisionError.message,
      );

      return NextResponse.json(
        {
          error: "Unable to load candidate decisions.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Latest decision per candidate.
     */

    const decisionMap = new Map<string, any>();

    for (const decision of decisions ?? []) {
      if (!decisionMap.has(decision.job_candidate_id)) {
        decisionMap.set(
          decision.job_candidate_id,
          decision,
        );
      }
    }

    /*
     * -------------------------------------------------
     * Load communication history
     * -------------------------------------------------
     */

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
      .in("job_candidate_id", ids)
      .order("created_at", {
        ascending: false,
      });

    if (communicationError) {
      console.error(
        "COMMUNICATION LOAD ERROR:",
        communicationError.message,
      );
    }

    const latestCommunicationMap = new Map<string, any>();

    for (const event of communicationEvents ?? []) {
      if (!latestCommunicationMap.has(event.job_candidate_id)) {
        latestCommunicationMap.set(
          event.job_candidate_id,
          event,
        );
      }
    }

    /*
     * -------------------------------------------------
     * Build outreach queue
     * -------------------------------------------------
     */

    const candidates = rows.map((item) => {
      const decision = decisionMap.get(item.id) ?? null;

      const communication =
        latestCommunicationMap.get(item.id) ?? null;

      const candidate = Array.isArray(item.candidates)
        ? item.candidates[0] ?? null
        : item.candidates;

      const hasPhone = Boolean(
        candidate?.normalized_phone ||
          candidate?.phone_number,
      );

      const approved =
        decision?.recruiter_decision === "approved";

      const proceed =
        decision?.final_workflow_decision === "proceed";

      const phoneVerified =
        decision?.phone_verified === true;

      const whatsappConsent =
        decision?.whatsapp_consent === true;

      const eligible =
        approved &&
        proceed &&
        hasPhone &&
        phoneVerified &&
        whatsappConsent;

      const blockers: string[] = [];

      if (!approved) {
        blockers.push("Recruiter approval required");
      }

      if (!proceed) {
        blockers.push("Final decision must be Proceed");
      }

      if (!hasPhone) {
        blockers.push("Phone number missing");
      }

      if (!phoneVerified) {
        blockers.push("Phone number not verified");
      }

      if (!whatsappConsent) {
        blockers.push("WhatsApp consent not confirmed");
      }

      return {
        id: item.id,
        candidateId: item.candidate_id,
        workflowStatus: item.workflow_status,
        candidate,
        decision,
        communication,
        eligible,
        blockers,
      };
    });

    return NextResponse.json({
      success: true,
      provider: getWhatsAppProviderStatus(),
      candidates,
    });
  } catch (error) {
    console.error(
      "OUTREACH QUEUE API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to load WhatsApp outreach queue.",
      },
      {
        status: 500,
      },
    );
  }
}