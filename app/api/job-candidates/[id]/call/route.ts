import {
  NextRequest,
  NextResponse,
} from "next/server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCallingProviderStatus } from "@/lib/calling-provider";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const requestSchema = z.object({
  language: z.enum([
    "english",
    "hindi",
    "hinglish",
  ]),

  scheduledFor: z
    .string()
    .datetime()
    .nullable()
    .optional(),
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
      requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid call configuration.",
          details:
            parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const {
      language,
      scheduledFor,
    } = parsed.data;

    const supabase =
      createSupabaseServerClient();

    /*
     * ----------------------------------------
     * Job candidate
     * ----------------------------------------
     */

    const {
      data: jobCandidate,
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
          phone_number,
          normalized_phone
        )
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

    const candidate =
      Array.isArray(
        jobCandidate.candidates,
      )
        ? jobCandidate
            .candidates[0] ?? null
        : jobCandidate.candidates;

    if (!candidate) {
      return NextResponse.json(
        {
          error:
            "Candidate data not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ----------------------------------------
     * Recruiter decision
     * ----------------------------------------
     */

    const {
      data: decision,
      error: decisionError,
    } = await supabase
      .from(
        "candidate_decisions",
      )
      .select(`
        recruiter_decision,
        final_workflow_decision,
        phone_verified
      `)
      .eq(
        "job_candidate_id",
        jobCandidateId,
      )
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (
      decisionError ||
      !decision
    ) {
      return NextResponse.json(
        {
          error:
            "Recruiter decision not found.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      decision.recruiter_decision !==
      "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Recruiter approval is required.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      decision.final_workflow_decision !==
      "proceed"
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate is not marked to proceed.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      !decision.phone_verified
    ) {
      return NextResponse.json(
        {
          error:
            "Phone number must be verified.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ----------------------------------------
     * Verify actual WhatsApp interest
     * ----------------------------------------
     */

    const {
      data: communication,
      error:
        communicationError,
    } = await supabase
      .from(
        "communication_events",
      )
      .select(`
        id,
        communication_status
      `)
      .eq(
        "job_candidate_id",
        jobCandidateId,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (
      communicationError ||
      !communication
    ) {
      return NextResponse.json(
        {
          error:
            "No WhatsApp response found for this candidate.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      communication.communication_status !==
      "interested"
    ) {
      return NextResponse.json(
        {
          error:
            "Only candidates recorded as Interested can enter AI calling.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ----------------------------------------
     * Phone
     * ----------------------------------------
     */

    const phone =
      candidate.normalized_phone ||
      candidate.phone_number;

    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Candidate phone number is missing.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ----------------------------------------
     * Provider
     * ----------------------------------------
     */

    const provider =
      getCallingProviderStatus();

    /*
     * If provider isn't configured,
     * save a NOT_READY event.
     *
     * This is NOT a call attempt.
     */

    if (!provider.configured) {
      const {
        data: call,
        error: callError,
      } = await supabase
        .from("call_events")
        .insert({
          job_candidate_id:
            jobCandidateId,

          provider_name:
            "ai-calling",

          provider_call_id:
            null,

          call_status:
            "not_ready",

          call_language:
            language,

          scheduled_for:
            scheduledFor ??
            null,

          provider_error_code:
            "PROVIDER_NOT_CONFIGURED",

          provider_error_message:
            "AI calling provider credentials are not configured.",

          provider_payload: {
            missing_variables:
              provider.missingVariables,
          },
        })
        .select()
        .single();

      if (callError) {
        console.error(
          "CALL EVENT ERROR:",
          callError.message,
        );

        return NextResponse.json(
          {
            error:
              "Unable to save call configuration.",
          },
          {
            status: 500,
          },
        );
      }

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
            "ai_call_not_ready",

          event_data: {
            call_event_id:
              call.id,

            language,

            scheduled_for:
              scheduledFor ??
              null,

            reason:
              "provider_not_configured",
          },
        });

      return NextResponse.json(
        {
          success: false,

          providerConfigured:
            false,

          call,

          error:
            "AI calling provider is not configured. No call was initiated.",
        },
        {
          status: 503,
        },
      );
    }

    /*
     * Provider credentials exist,
     * but provider contract is not
     * implemented yet.
     *
     * Store as scheduled/not-ready
     * without pretending to call.
     */

    const callStatus =
      scheduledFor
        ? "scheduled"
        : "not_ready";

    const {
      data: call,
      error: callError,
    } = await supabase
      .from("call_events")
      .insert({
        job_candidate_id:
          jobCandidateId,

        provider_name:
          "ai-calling",

        provider_call_id:
          null,

        call_status:
          callStatus,

        call_language:
          language,

        scheduled_for:
          scheduledFor ??
          null,

        provider_error_code:
          null,

        provider_error_message:
          null,

        provider_payload: {},
      })
      .select()
      .single();

    if (callError) {
      console.error(
        "CALL PREPARATION ERROR:",
        callError.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare AI call.",
        },
        {
          status: 500,
        },
      );
    }

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
          scheduledFor
            ? "ai_call_scheduled"
            : "ai_call_prepared",

        event_data: {
          call_event_id:
            call.id,

          language,

          scheduled_for:
            scheduledFor ??
            null,
        },
      });

    return NextResponse.json({
      success: true,

      providerConfigured:
        true,

      providerAdapterReady:
        false,

      call,

      message:
        scheduledFor
          ? "Call schedule saved. Actual provider execution will be enabled after the calling adapter is connected."
          : "Call configuration saved. Actual provider execution will be enabled after the calling adapter is connected.",
    });
  } catch (error) {
    console.error(
      "CALL PREPARATION API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare AI call.",
      },
      {
        status: 500,
      },
    );
  }
}