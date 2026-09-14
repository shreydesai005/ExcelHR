import {
  NextRequest,
  NextResponse,
} from "next/server";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import {
  createSupabaseServerClient,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanText(
  value: string,
) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(
  text: string,
) {
  const match =
    text.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    );

  return match?.[0] ?? null;
}

function extractPhone(
  text: string,
) {
  const matches =
    text.match(
      /(?:\+?\d[\d\s().-]{8,}\d)/g,
    );

  if (!matches) {
    return null;
  }

  for (const match of matches) {
    const digits =
      match.replace(
        /\D/g,
        "",
      );

    if (
      digits.length >= 10 &&
      digits.length <= 15
    ) {
      return match.trim();
    }
  }

  return null;
}

async function parsePdf(
  buffer: Uint8Array,
) {
  const parser =
    new PDFParse({
      data: buffer,
    });

  try {
    const result =
      await parser.getText();

    return cleanText(
      result.text ?? "",
    );
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(
  buffer: Buffer,
) {
  const result =
    await mammoth.extractRawText({
      buffer,
    });

  return cleanText(
    result.value ?? "",
  );
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id: documentId } =
    await context.params;

  const supabase =
    createSupabaseServerClient();

  try {
    /*
     * --------------------------------
     * Load document record
     * --------------------------------
     */

    const {
      data: document,
      error: documentError,
    } = await supabase
      .from(
        "candidate_documents",
      )
      .select(`
        id,
        candidate_id,
        job_id,
        document_type,
        storage_bucket,
        storage_path,
        original_file_name,
        mime_type,
        parsing_status
      `)
      .eq(
        "id",
        documentId,
      )
      .single();

    if (
      documentError ||
      !document
    ) {
      return NextResponse.json(
        {
          error:
            "CV document not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      ![
        "cv_pdf",
        "cv_docx",
      ].includes(
        document.document_type,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This document type cannot be parsed as a CV.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------
     * Mark processing
     * --------------------------------
     */

    await supabase
      .from(
        "candidate_documents",
      )
      .update({
        parsing_status:
          "processing",

        parser_error_code:
          null,

        parser_error_message:
          null,
      })
      .eq(
        "id",
        document.id,
      );

    /*
     * --------------------------------
     * Download private file
     * --------------------------------
     */

    const {
      data: fileData,
      error: downloadError,
    } =
      await supabase.storage
        .from(
          document.storage_bucket,
        )
        .download(
          document.storage_path,
        );

    if (
      downloadError ||
      !fileData
    ) {
      await supabase
        .from(
          "candidate_documents",
        )
        .update({
          parsing_status:
            "failed",

          parser_error_code:
            "STORAGE_DOWNLOAD_FAILED",

          parser_error_message:
            downloadError?.message ??
            "Unable to download CV.",
        })
        .eq(
          "id",
          document.id,
        );

      return NextResponse.json(
        {
          error:
            "Unable to download CV from storage.",
        },
        {
          status: 500,
        },
      );
    }

    const arrayBuffer =
      await fileData.arrayBuffer();

    const nodeBuffer =
      Buffer.from(
        arrayBuffer,
      );

    /*
     * --------------------------------
     * Parse document
     * --------------------------------
     */

    let extractedText = "";

    if (
      document.document_type ===
      "cv_pdf"
    ) {
      extractedText =
        await parsePdf(
          new Uint8Array(
            nodeBuffer,
          ),
        );
    }

    if (
      document.document_type ===
      "cv_docx"
    ) {
      extractedText =
        await parseDocx(
          nodeBuffer,
        );
    }

    if (
      !extractedText.trim()
    ) {
      await supabase
        .from(
          "candidate_documents",
        )
        .update({
          parsing_status:
            "failed",

          parser_error_code:
            "NO_TEXT_FOUND",

          parser_error_message:
            "No machine-readable text could be extracted from the CV.",
        })
        .eq(
          "id",
          document.id,
        );

      return NextResponse.json(
        {
          error:
            "No machine-readable text could be extracted. This may be a scanned/image-based CV.",
        },
        {
          status: 422,
        },
      );
    }

    /*
     * --------------------------------
     * Basic deterministic extraction
     *
     * IMPORTANT:
     * this is NOT our final AI model.
     * --------------------------------
     */

    const detectedEmail =
      extractEmail(
        extractedText,
      );

    const detectedPhone =
      extractPhone(
        extractedText,
      );

    const extractedData = {
      raw_text:
        extractedText,

      detected_email:
        detectedEmail,

      detected_phone:
        detectedPhone,

      character_count:
        extractedText.length,

      parser:
        document.document_type ===
        "cv_pdf"
          ? "pdf-parse"
          : "mammoth",

      parsed_at:
        new Date().toISOString(),
    };

    /*
     * --------------------------------
     * Save extraction
     * --------------------------------
     */

    const {
      error: updateError,
    } = await supabase
      .from(
        "candidate_documents",
      )
      .update({
        parsing_status:
          "completed",

        extracted_data:
          extractedData,

        parser_error_code:
          null,

        parser_error_message:
          null,
      })
      .eq(
        "id",
        document.id,
      );

    if (updateError) {
      console.error(
        "DOCUMENT PARSE UPDATE ERROR:",
        updateError.message,
      );

      return NextResponse.json(
        {
          error:
            "CV text was extracted but could not be saved.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * --------------------------------
     * Audit event
     * --------------------------------
     */

    const {
      data: jobCandidate,
    } = await supabase
      .from(
        "job_candidates",
      )
      .select("id")
      .eq(
        "job_id",
        document.job_id,
      )
      .eq(
        "candidate_id",
        document.candidate_id,
      )
      .maybeSingle();

    if (
      document.job_id
    ) {
      await supabase
        .from(
          "recruitment_events",
        )
        .insert({
          job_id:
            document.job_id,

          candidate_id:
            document.candidate_id,

          job_candidate_id:
            jobCandidate?.id ??
            null,

          event_type:
            "cv_parsed",

          event_data: {
            document_id:
              document.id,

            parser:
              extractedData.parser,

            character_count:
              extractedData.character_count,

            email_detected:
              Boolean(
                detectedEmail,
              ),

            phone_detected:
              Boolean(
                detectedPhone,
              ),
          },
        });
    }

    return NextResponse.json({
      success: true,

      documentId:
        document.id,

      parsingStatus:
        "completed",

      extractedData: {
        detectedEmail,

        detectedPhone,

        characterCount:
          extractedText.length,

        text:
          extractedText,
      },
    });
  } catch (error) {
    console.error(
      "CV PARSE ERROR:",
      error,
    );

    await supabase
      .from(
        "candidate_documents",
      )
      .update({
        parsing_status:
          "failed",

        parser_error_code:
          "PARSER_EXCEPTION",

        parser_error_message:
          error instanceof Error
            ? error.message
            : "Unknown parsing error.",
      })
      .eq(
        "id",
        documentId,
      );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to parse CV.",
      },
      {
        status: 500,
      },
    );
  }
}