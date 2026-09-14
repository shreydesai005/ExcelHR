import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();

  return email.length > 0 ? email : null;
}

function normalizePhone(value: string) {
  const phone = value.replace(/\D/g, "");

  return phone.length > 0 ? phone : null;
}

function optionalNumber(
  value: FormDataEntryValue | null
) {
  if (
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getImageExtension(
  mimeType: string
) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return null;
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: jobId } =
    await context.params;

  const supabase =
    createSupabaseServerClient();

  try {
    /*
     * ------------------------------------------------
     * Confirm job exists
     * ------------------------------------------------
     */

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error:
            "Recruitment could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ------------------------------------------------
     * Read multipart form
     * ------------------------------------------------
     */

    const formData =
      await request.formData();

    const fullName = String(
      formData.get("fullName") ?? ""
    ).trim();

    const emailAddress = String(
      formData.get("emailAddress") ?? ""
    ).trim();

    const phoneNumber = String(
      formData.get("phoneNumber") ?? ""
    ).trim();

    const currentJobTitle = String(
      formData.get("currentJobTitle") ?? ""
    ).trim();

    const currentEmployer = String(
      formData.get("currentEmployer") ?? ""
    ).trim();

    const currentLocation = String(
      formData.get("currentLocation") ?? ""
    ).trim();

    const preferredLocation = String(
      formData.get("preferredLocation") ?? ""
    ).trim();

    const educationSummary = String(
      formData.get("educationSummary") ?? ""
    ).trim();

    const salaryText = String(
      formData.get("salaryText") ?? ""
    ).trim();

    const totalExperienceYears =
      optionalNumber(
        formData.get(
          "totalExperienceYears"
        )
      );

    const noticePeriodDays =
      optionalNumber(
        formData.get(
          "noticePeriodDays"
        )
      );

    /*
     * ------------------------------------------------
     * Validation
     * ------------------------------------------------
     */

    if (!fullName) {
      return NextResponse.json(
        {
          error:
            "Candidate name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      totalExperienceYears !== null &&
      totalExperienceYears < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Experience cannot be negative.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      noticePeriodDays !== null &&
      noticePeriodDays < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Notice period cannot be negative.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ------------------------------------------------
     * Skills
     * ------------------------------------------------
     */

    let skills: string[] = [];

    const skillsValue =
      formData.get("skills");

    if (skillsValue) {
      try {
        const parsed =
          JSON.parse(
            String(skillsValue)
          );

        if (Array.isArray(parsed)) {
          skills = parsed
            .map((skill) =>
              String(skill).trim()
            )
            .filter(Boolean);
        }
      } catch {
        return NextResponse.json(
          {
            error:
              "Skills format is invalid.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * ------------------------------------------------
     * Normalisation
     * ------------------------------------------------
     */

    const normalizedEmail =
      normalizeEmail(emailAddress);

    const normalizedPhone =
      normalizePhone(phoneNumber);

    /*
     * ------------------------------------------------
     * Duplicate detection
     * ------------------------------------------------
     */

    let possibleDuplicate = false;

    if (normalizedEmail) {
      const {
        data: emailMatch,
      } = await supabase
        .from("candidates")
        .select("id")
        .eq(
          "normalized_email",
          normalizedEmail
        )
        .limit(1);

      if (
        emailMatch &&
        emailMatch.length > 0
      ) {
        possibleDuplicate = true;
      }
    }

    if (
      !possibleDuplicate &&
      normalizedPhone
    ) {
      const {
        data: phoneMatch,
      } = await supabase
        .from("candidates")
        .select("id")
        .eq(
          "normalized_phone",
          normalizedPhone
        )
        .limit(1);

      if (
        phoneMatch &&
        phoneMatch.length > 0
      ) {
        possibleDuplicate = true;
      }
    }

    /*
     * ------------------------------------------------
     * Create candidate
     * ------------------------------------------------
     */

    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidates")
      .insert({
        full_name: fullName,

        email_address:
          emailAddress || null,

        phone_number:
          phoneNumber || null,

        normalized_email:
          normalizedEmail,

        normalized_phone:
          normalizedPhone,

        current_job_title:
          currentJobTitle || null,

        current_employer:
          currentEmployer || null,

        total_experience_years:
          totalExperienceYears,

        current_location:
          currentLocation || null,

        preferred_location:
          preferredLocation || null,

        notice_period_days:
          noticePeriodDays,

        education_summary:
          educationSummary || null,

        salary_text:
          salaryText || null,

        skills,

        duplicate_flag:
          possibleDuplicate,

        duplicate_status:
          possibleDuplicate
            ? "possible_duplicate"
            : "unique",
      })
      .select()
      .single();

    if (
      candidateError ||
      !candidate
    ) {
      console.error(
        "CANDIDATE INSERT ERROR:",
        candidateError?.code,
        candidateError?.message
      );

      return NextResponse.json(
        {
          error:
            candidateError?.message ||
            "Unable to save candidate.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ------------------------------------------------
     * Link candidate to job
     * ------------------------------------------------
     */

    const {
      data: jobCandidate,
      error:
        jobCandidateError,
    } = await supabase
      .from("job_candidates")
      .insert({
        job_id: jobId,

        candidate_id:
          candidate.id,

        initial_score: null,

        initial_selected:
          false,

        recruiter_review_status:
          "pending",

        workflow_status:
          "initial_screening",
      })
      .select()
      .single();

    if (
      jobCandidateError ||
      !jobCandidate
    ) {
      await supabase
        .from("candidates")
        .delete()
        .eq(
          "id",
          candidate.id
        );

      console.error(
        "JOB CANDIDATE ERROR:",
        jobCandidateError?.code,
        jobCandidateError?.message
      );

      return NextResponse.json(
        {
          error:
            jobCandidateError?.message ||
            "Unable to connect candidate to recruitment.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ------------------------------------------------
     * Optional screenshot upload
     * ------------------------------------------------
     */

    const fileValue =
      formData.get(
        "profileScreenshot"
      );

    let documentRecord = null;

    if (
      fileValue instanceof File &&
      fileValue.size > 0
    ) {
      const maxSize =
        5 * 1024 * 1024;

      if (
        fileValue.size >
        maxSize
      ) {
        await supabase
          .from(
            "job_candidates"
          )
          .delete()
          .eq(
            "id",
            jobCandidate.id
          );

        await supabase
          .from("candidates")
          .delete()
          .eq(
            "id",
            candidate.id
          );

        return NextResponse.json(
          {
            error:
              "Screenshot must be 5 MB or smaller.",
          },
          {
            status: 400,
          }
        );
      }

      const extension =
        getImageExtension(
          fileValue.type
        );

      if (!extension) {
        await supabase
          .from(
            "job_candidates"
          )
          .delete()
          .eq(
            "id",
            jobCandidate.id
          );

        await supabase
          .from("candidates")
          .delete()
          .eq(
            "id",
            candidate.id
          );

        return NextResponse.json(
          {
            error:
              "Only PNG, JPG and WEBP screenshots are supported.",
          },
          {
            status: 400,
          }
        );
      }

      const storagePath =
        `${jobId}/${candidate.id}/${randomUUID()}.${extension}`;

      const arrayBuffer =
        await fileValue.arrayBuffer();

      const {
        error: uploadError,
      } = await supabase.storage
        .from(
          "candidate-documents"
        )
        .upload(
          storagePath,
          arrayBuffer,
          {
            contentType:
              fileValue.type,

            upsert: false,
          }
        );

      if (uploadError) {
        await supabase
          .from(
            "job_candidates"
          )
          .delete()
          .eq(
            "id",
            jobCandidate.id
          );

        await supabase
          .from("candidates")
          .delete()
          .eq(
            "id",
            candidate.id
          );

        console.error(
          "SCREENSHOT UPLOAD ERROR:",
          uploadError.message
        );

        return NextResponse.json(
          {
            error:
              "Candidate was not saved because the screenshot upload failed.",
          },
          {
            status: 500,
          }
        );
      }

      const {
        data: document,
        error: documentError,
      } = await supabase
        .from(
          "candidate_documents"
        )
        .insert({
          candidate_id:
            candidate.id,

          job_id: jobId,

          document_type:
            "profile_screenshot",

          storage_bucket:
            "candidate-documents",

          storage_path:
            storagePath,

          original_file_name:
            fileValue.name,

          mime_type:
            fileValue.type,

          file_size_bytes:
            fileValue.size,

          parsing_status:
            "pending",
        })
        .select()
        .single();

      if (documentError) {
        await supabase.storage
          .from(
            "candidate-documents"
          )
          .remove([
            storagePath,
          ]);

        console.error(
          "DOCUMENT INSERT ERROR:",
          documentError.code,
          documentError.message
        );
      } else {
        documentRecord =
          document;
      }
    }

    /*
     * ------------------------------------------------
     * Audit event
     * ------------------------------------------------
     */

    await supabase
      .from(
        "recruitment_events"
      )
      .insert({
        job_id: jobId,

        candidate_id:
          candidate.id,

        job_candidate_id:
          jobCandidate.id,

        event_type:
          "candidate_added",

        event_data: {
          source:
            "initial_screening",
          screenshot_uploaded:
            Boolean(
              documentRecord
            ),
          possible_duplicate:
            possibleDuplicate,
        },
      });

    return NextResponse.json(
      {
        success: true,

        candidate,

        jobCandidate,

        document:
          documentRecord,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE CANDIDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process candidate.",
      },
      {
        status: 500,
      }
    );
  }
}