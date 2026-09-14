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

const schema = z.object({
  initialSelected:
    z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } =
      await context.params;

    const body =
      await request.json();

    const parsed =
      schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid selection data.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createSupabaseServerClient();

    const {
      data,
      error,
    } = await supabase
      .from("job_candidates")
      .update({
        initial_selected:
          parsed.data
            .initialSelected,

        recruiter_review_status:
          "reviewed",

        workflow_status:
          parsed.data
            .initialSelected
            ? "awaiting_cv"
            : "initial_screening",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(
        "CANDIDATE SELECTION ERROR:",
        error.code,
        error.message
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      jobCandidate: data,
    });
  } catch (error) {
    console.error(
      "SELECTION API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update candidate.",
      },
      {
        status: 500,
      }
    );
  }
}