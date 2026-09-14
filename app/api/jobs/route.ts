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

const jobSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  department: z.string().trim().min(1, "Department is required"),
  location: z.string().trim().min(1, "Location is required"),

  workMode: z.enum(["onsite", "hybrid", "remote"]),

  minExperience: z.number().min(0),
  maxExperience: z.number().min(0),

  maxNoticePeriod: z.number().int().min(0),

  education: z.string().trim(),

  jdText: z.string().trim(),

  requiredSkills: z.array(z.string().trim()).min(1),
  preferredSkills: z.array(z.string().trim()),
  knockoutCriteria: z.array(z.string().trim()),

  qualifyingScore: z.number().min(0).max(100),

  scoringWeights: scoringWeightsSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = jobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid job data.",
          details: parsed.error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    const job = parsed.data;

    if (job.maxExperience < job.minExperience) {
      return NextResponse.json(
        {
          error:
            "Maximum experience cannot be lower than minimum experience.",
        },
        {
          status: 400,
        }
      );
    }

    const weightTotal = Object.values(job.scoringWeights).reduce(
      (sum, value) => sum + value,
      0
    );

    if (weightTotal !== 100) {
      return NextResponse.json(
        {
          error: "Scoring weights must total exactly 100%.",
          total: weightTotal,
        },
        {
          status: 400,
        }
      );
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        client_name: job.clientName,
        job_title: job.jobTitle,
        department: job.department,
        location: job.location,

        work_mode: job.workMode,

        min_experience_years: job.minExperience,
        max_experience_years: job.maxExperience,

        max_notice_period_days: job.maxNoticePeriod,

        education_requirements:
          job.education.length > 0 ? job.education : null,

        jd_text: job.jdText.length > 0 ? job.jdText : null,

        required_skills: job.requiredSkills.filter(
          (skill) => skill.length > 0
        ),

        preferred_skills: job.preferredSkills.filter(
          (skill) => skill.length > 0
        ),

        knockout_criteria: job.knockoutCriteria.filter(
          (criterion) => criterion.length > 0
        ),

        scoring_weights: job.scoringWeights,

        qualifying_score: job.qualifyingScore,

        workflow_stage: 1,

        job_status: "draft",
      })
      .select(
        `
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
        `
      )
      .single();

    if (error) {
      console.error("SUPABASE JOB INSERT ERROR");
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      console.error("Details:", error.details);
      console.error("Hint:", error.hint);

      return NextResponse.json(
        {
          error: "Unable to save recruitment.",
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        job: data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("JOB API ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to process the request.",
      },
      {
        status: 500,
      }
    );
  }
}