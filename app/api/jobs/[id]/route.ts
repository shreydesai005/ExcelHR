import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const scoringWeightsSchema = z.object({
  requiredSkills: z.number().min(0).max(100),
  preferredSkills: z.number().min(0).max(100),
  experience: z.number().min(0).max(100),
  roleRelevance: z.number().min(0).max(100),
  education: z.number().min(0).max(100),
  location: z.number().min(0).max(100),
  noticePeriod: z.number().min(0).max(100),
});

const updateJobSchema = z.object({
  clientName: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  department: z.string().trim().min(1),
  location: z.string().trim().min(1),

  workMode: z.enum([
    "onsite",
    "hybrid",
    "remote",
  ]),

  minExperience: z.number().min(0),
  maxExperience: z.number().min(0),
  maxNoticePeriod: z.number().int().min(0),

  education: z.string(),
  jdText: z.string(),

  requiredSkills: z.array(z.string()).min(1),
  preferredSkills: z.array(z.string()),
  knockoutCriteria: z.array(z.string()),

  qualifyingScore: z.number().min(0).max(100),

  scoringWeights: scoringWeightsSchema,

  workflowStage: z.number().int().min(1).max(7).optional(),

  jobStatus: z
    .enum([
      "draft",
      "active",
      "completed",
      "archived",
    ])
    .optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Job ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const body = await request.json();

    const parsed =
      updateJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid job data.",
          details:
            parsed.error.flatten(),
        },
        {
          status: 400,
        },
      );
    }

    const job = parsed.data;

    if (
      job.maxExperience <
      job.minExperience
    ) {
      return NextResponse.json(
        {
          error:
            "Maximum experience cannot be lower than minimum experience.",
        },
        {
          status: 400,
        },
      );
    }

    const totalWeight =
      Object.values(
        job.scoringWeights,
      ).reduce(
        (sum, value) =>
          sum + value,
        0,
      );

    if (totalWeight !== 100) {
      return NextResponse.json(
        {
          error:
            "Scoring weights must total exactly 100%.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      createSupabaseServerClient();

    const { data, error } =
      await supabase
        .from("jobs")
        .update({
          client_name:
            job.clientName,

          job_title:
            job.jobTitle,

          department:
            job.department,

          location:
            job.location,

          work_mode:
            job.workMode,

          min_experience_years:
            job.minExperience,

          max_experience_years:
            job.maxExperience,

          max_notice_period_days:
            job.maxNoticePeriod,

          education_requirements:
            job.education || null,

          jd_text:
            job.jdText || null,

          required_skills:
            job.requiredSkills.filter(
              Boolean,
            ),

          preferred_skills:
            job.preferredSkills.filter(
              Boolean,
            ),

          knockout_criteria:
            job.knockoutCriteria.filter(
              Boolean,
            ),

          scoring_weights:
            job.scoringWeights,

          qualifying_score:
            job.qualifyingScore,

          workflow_stage:
            job.workflowStage ?? 1,

          job_status:
            job.jobStatus ??
            "draft",
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
      console.error(
        "SUPABASE JOB UPDATE ERROR",
      );

      console.error(
        "Code:",
        error.code,
      );

      console.error(
        "Message:",
        error.message,
      );

      return NextResponse.json(
        {
          error:
            "Unable to update recruitment.",
          code: error.code,
          message:
            error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      job: data,
    });
  } catch (error) {
    console.error(
      "JOB UPDATE API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to process request.",
      },
      {
        status: 500,
      },
    );
  }
}