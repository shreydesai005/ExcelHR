import {
  NextRequest,
  NextResponse,
} from "next/server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getWhatsAppProviderStatus } from "@/lib/providers";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const schema = z.object({
  templateName: z
    .string()
    .trim()
    .min(1, "Template name is required"),
});

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: jobCandidateId } = await context.params;

    const body = await request.json();

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid outreach request.",
          details: parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const supabase = createSupabaseServerClient();

    /*
     * -------------------------------------------------
     * Load job candidate + candidate
     * -------------------------------------------------
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
      .eq("id", jobCandidateId)
      .single();

    if (jobCandidateError || !jobCandidate) {
      return NextResponse.json(
        {
          error: "Candidate recruitment record not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (jobCandidate.workflow_status !== "approved_for_outreach") {
      return NextResponse.json(
        {
          error: "Candidate is not approved for outreach.",
        },
        {
          status: 403,
        },
      );
    }

    const candidate = Array.isArray(jobCandidate.candidates)
      ? jobCandidate.candidates[0] ?? null
      : jobCandidate.candidates;

    if (!candidate) {
      return NextResponse.json(
        {
          error: "Candidate data not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Verify human decision
     * -------------------------------------------------
     */

    const {
      data: decision,
      error: decisionError,
    } = await supabase
      .from("candidate_decisions")
      .select(`
        recruiter_decision,
        final_workflow_decision,
        phone_verified,
        whatsapp_consent
      `)
      .eq("job_candidate_id", jobCandidateId)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (decisionError || !decision) {
      return NextResponse.json(
        {
          error: "Recruiter decision not found.",
        },
        {
          status: 400,
        },
      );
    }

    if (decision.recruiter_decision !== "approved") {
      return NextResponse.json(
        {
          error: "Recruiter approval is required.",
        },
        {
          status: 403,
        },
      );
    }

    if (decision.final_workflow_decision !== "proceed") {
      return NextResponse.json(
        {
          error: "Candidate is not marked to proceed.",
        },
        {
          status: 403,
        },
      );
    }

    if (!decision.phone_verified) {
      return NextResponse.json(
        {
          error: "Phone number must be verified before outreach.",
        },
        {
          status: 400,
        },
      );
    }

    if (!decision.whatsapp_consent) {
      return NextResponse.json(
        {
          error: "WhatsApp consent must be confirmed before outreach.",
        },
        {
          status: 400,
        },
      );
    }

    const phone =
      candidate.normalized_phone ||
      candidate.phone_number;

    if (!phone) {
      return NextResponse.json(
        {
          error: "Candidate phone number is missing.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedPhone = normalizePhone(phone);

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 15
    ) {
      return NextResponse.json(
        {
          error: "Candidate phone number is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * -------------------------------------------------
     * Check provider
     * -------------------------------------------------
     */

    const provider = getWhatsAppProviderStatus();

    /*
     * Provider is NOT configured:
     *
     * We create a NOT_READY record.
     * We DO NOT claim anything was sent.
     */

    if (!provider.configured) {
      const {
        data: communication,
        error: communicationError,
      } = await supabase
        .from("communication_events")
        .insert({
          job_candidate_id: jobCandidateId,
          provider_name: "yeti",
          provider_message_id: null,
          communication_status: "not_ready",
          recipient_normalized: normalizedPhone,
          template_name: parsed.data.templateName,
          provider_error_code: "PROVIDER_NOT_CONFIGURED",
          provider_error_message:
            "Yeti WhatsApp credentials are not configured.",
          provider_payload: {
            missing_variables: provider.missingVariables,
          },
        })
        .select()
        .single();

      if (communicationError) {
        console.error(
          "COMMUNICATION EVENT ERROR:",
          communicationError.message,
        );

        return NextResponse.json(
          {
            error: "Unable to create outreach record.",
          },
          {
            status: 500,
          },
        );
      }

      await supabase
        .from("recruitment_events")
        .insert({
          job_id: jobCandidate.job_id,
          candidate_id: jobCandidate.candidate_id,
          job_candidate_id: jobCandidateId,
          event_type: "whatsapp_not_ready",
          event_data: {
            communication_event_id: communication.id,
            provider: "yeti",
            template_name: parsed.data.templateName,
            reason: "provider_not_configured",
          },
        });

      return NextResponse.json(
        {
          success: false,
          providerConfigured: false,
          communication,
          error:
            "Yeti WhatsApp is not configured yet. No message was sent.",
        },
        {
          status: 503,
        },
      );
    }

    /*
     * -------------------------------------------------
     * IMPORTANT
     * -------------------------------------------------
     *
     * Credentials exist, but we still refuse to guess
     * Yeti's API contract.
     *
     * Once the actual Yeti endpoint + payload format
     * is known, this branch will call the provider.
     */

    const {
      data: communication,
      error: communicationError,
    } = await supabase
      .from("communication_events")
      .insert({
        job_candidate_id: jobCandidateId,
        provider_name: "yeti",
        provider_message_id: null,
        communication_status: "ready",
        recipient_normalized: normalizedPhone,
        template_name: parsed.data.templateName,
        provider_error_code: null,
        provider_error_message: null,
        provider_payload: {},
      })
      .select()
      .single();

    if (communicationError) {
      return NextResponse.json(
        {
          error: "Unable to prepare WhatsApp outreach.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      providerConfigured: true,
      readyToSend: true,
      communication,
      message:
        "Candidate is eligible and Yeti credentials are configured. Provider sending will be enabled after the Yeti API contract is connected.",
    });
  } catch (error) {
    console.error(
      "OUTREACH PREPARATION ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare outreach.",
      },
      {
        status: 500,
      },
    );
  }
}