"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type CandidateDetails = {
  id: string;
  full_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  current_job_title: string | null;
  current_employer: string | null;
  total_experience_years: number | null;
  current_location: string | null;
  notice_period_days: number | null;
  education_summary: string | null;
  skills: string[] | null;
  duplicate_flag: boolean;
};

type CVDocument = {
  id: string;
  candidate_id: string;
  job_id: string;
  document_type: string;
  original_file_name: string | null;

  parsing_status:
    | "pending"
    | "processing"
    | "completed"
    | "failed";

  extracted_data: {
    raw_text?: string;
    detected_email?: string | null;
    detected_phone?: string | null;
    character_count?: number;
    parser?: string;
    parsed_at?: string;
  } | null;
};

type SelectedCandidate = {
  id: string;
  candidate_id: string;
  initial_selected: boolean;
  recruiter_review_status: string;
  workflow_status: string;

  candidates:
    CandidateDetails | null;

  cvDocument:
    CVDocument | null;
};

type Scorecard = {
  id: string;
  total_score: number;
  recommendation: string;
  confidence_score: number;
  missing_information_count: number;
  embedding_model_version: string;
  scoring_policy_version: string;
  assessment_timestamp: string;
};

type ScoreComponent = {
  id?: string;
  component_key: string;
  component_label: string;
  jd_requirement: string | null;
  candidate_value: string | null;
  component_score: number | null;
  configured_weight: number;
  score_contribution: number;
  evidence_excerpt: string | null;
  evidence_location: string | null;
  confidence_score: number | null;
  missing_information: boolean;
};

type ScreeningState = {
  scorecard: Scorecard | null;
  components: ScoreComponent[];
};

type CVScreeningProps = {
  jobId: string;

  onContinue?: () => void;
};

export default function CVScreening({
  jobId,
  onContinue,
}: CVScreeningProps) {
  const [
    candidates,
    setCandidates,
  ] =
    useState<
      SelectedCandidate[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    uploadLoading,
    setUploadLoading,
  ] = useState<
    Record<
      string,
      boolean
    >
  >({});

  const [
    parseLoading,
    setParseLoading,
  ] = useState<
    Record<
      string,
      boolean
    >
  >({});

  const [
    screeningLoading,
    setScreeningLoading,
  ] = useState<
    Record<
      string,
      boolean
    >
  >({});

  const [
    errors,
    setErrors,
  ] = useState<
    Record<
      string,
      string
    >
  >({});

  const [
    screenings,
    setScreenings,
  ] = useState<
    Record<
      string,
      ScreeningState
    >
  >({});

  const [
    expanded,
    setExpanded,
  ] = useState<
    Record<
      string,
      boolean
    >
  >({});

  const loadScreening =
    useCallback(
      async (
        jobCandidateId: string,
      ) => {
        try {
          const response =
            await fetch(
              `/api/job-candidates/${jobCandidateId}/screen`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            await response.json();

          if (
            !response.ok
          ) {
            return;
          }

          setScreenings(
            (previous) => ({
              ...previous,

              [jobCandidateId]:
                {
                  scorecard:
                    result.scorecard ??
                    null,

                  components:
                    result.components ??
                    [],
                },
            }),
          );
        } catch {
          // Individual scorecard
          // loading failure should
          // not break Stage 3.
        }
      },
      [],
    );

  const loadCandidates =
    useCallback(
      async () => {
        setLoading(true);
        setPageError("");

        try {
          const response =
            await fetch(
              `/api/jobs/${jobId}/selected-candidates`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              result.error ||
                "Unable to load candidates.",
            );
          }

          const loaded =
            result.candidates ??
            [];

          setCandidates(
            loaded,
          );

          await Promise.all(
            loaded.map(
              (
                item: SelectedCandidate,
              ) =>
                loadScreening(
                  item.id,
                ),
            ),
          );
        } catch (error) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Unable to load candidates.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        jobId,
        loadScreening,
      ],
    );

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  function setError(
    candidateId: string,
    value: string,
  ) {
    setErrors(
      (previous) => ({
        ...previous,
        [candidateId]:
          value,
      }),
    );
  }

  async function uploadCV(
    candidateId: string,
    file: File,
  ) {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      setError(
        candidateId,
        "Only PDF and DOCX CVs are supported.",
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        candidateId,
        "CV must be 10 MB or smaller.",
      );

      return;
    }

    setUploadLoading(
      (previous) => ({
        ...previous,
        [candidateId]:
          true,
      }),
    );

    setError(
      candidateId,
      "",
    );

    try {
      const formData =
        new FormData();

      formData.append(
        "jobId",
        jobId,
      );

      formData.append(
        "cv",
        file,
      );

      const response =
        await fetch(
          `/api/candidates/${candidateId}/cv`,
          {
            method:
              "POST",
            body:
              formData,
          },
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            "Unable to upload CV.",
        );
      }

      /*
       * Replacing a CV means
       * previous screening is stale.
       */

      setScreenings(
        (previous) => {
          const next = {
            ...previous,
          };

          const jobCandidate =
            candidates.find(
              (item) =>
                item.candidate_id ===
                candidateId,
            );

          if (
            jobCandidate
          ) {
            delete next[
              jobCandidate.id
            ];
          }

          return next;
        },
      );

      await loadCandidates();
    } catch (error) {
      setError(
        candidateId,

        error instanceof Error
          ? error.message
          : "Unable to upload CV.",
      );
    } finally {
      setUploadLoading(
        (previous) => ({
          ...previous,
          [candidateId]:
            false,
        }),
      );
    }
  }

  async function parseCV(
    candidateId: string,
    documentId: string,
  ) {
    setParseLoading(
      (previous) => ({
        ...previous,
        [candidateId]:
          true,
      }),
    );

    setError(
      candidateId,
      "",
    );

    try {
      const response =
        await fetch(
          `/api/documents/${documentId}/parse`,
          {
            method:
              "POST",
          },
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            "Unable to parse CV.",
        );
      }

      await loadCandidates();
    } catch (error) {
      setError(
        candidateId,

        error instanceof Error
          ? error.message
          : "Unable to parse CV.",
      );

      await loadCandidates();
    } finally {
      setParseLoading(
        (previous) => ({
          ...previous,
          [candidateId]:
            false,
        }),
      );
    }
  }

  async function runScreening(
    candidateId: string,
    jobCandidateId: string,
  ) {
    setScreeningLoading(
      (previous) => ({
        ...previous,
        [candidateId]:
          true,
      }),
    );

    setError(
      candidateId,
      "",
    );

    try {
      const response =
        await fetch(
          `/api/job-candidates/${jobCandidateId}/screen`,
          {
            method:
              "POST",
          },
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            "Unable to screen candidate.",
        );
      }

      await loadScreening(
        jobCandidateId,
      );

      setExpanded(
        (previous) => ({
          ...previous,
          [jobCandidateId]:
            true,
        }),
      );
    } catch (error) {
      setError(
        candidateId,

        error instanceof Error
          ? error.message
          : "Unable to screen candidate.",
      );
    } finally {
      setScreeningLoading(
        (previous) => ({
          ...previous,
          [candidateId]:
            false,
        }),
      );
    }
  }

  function handleFileChange(
    candidateId: string,
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    void uploadCV(
      candidateId,
      file,
    );

    event.target.value =
      "";
  }

  const screenedCount =
    candidates.filter(
      (item) =>
        Boolean(
          screenings[item.id]
            ?.scorecard,
        ),
    ).length;

  if (loading) {
    return (
      <div className="card flex min-h-[300px] items-center justify-center p-8">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-[var(--brand-primary)]"
          />

          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Loading CV
            screening...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Stage 3
          </p>

          <h1 className="text-3xl font-semibold">
            CV Screening
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Candidate CVs are
            parsed and evaluated
            using Excel HR&apos;s
            evidence-backed
            screening engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-primary)]">
            {screenedCount}/
            {candidates.length}{" "}
            screened
          </div>

          <button
            type="button"
            onClick={() =>
              void loadCandidates()
            }
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold"
          >
            <RefreshCw
              size={16}
            />

            Refresh
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {candidates.map(
        (item) => {
          const candidate =
            item.candidates;

          if (!candidate) {
            return null;
          }

          const document =
            item.cvDocument;

          const screening =
            screenings[
              item.id
            ];

          const scorecard =
            screening
              ?.scorecard;

          const components =
            screening
              ?.components ??
            [];

          const uploading =
            uploadLoading[
              candidate.id
            ];

          const parsing =
            parseLoading[
              candidate.id
            ];

          const screeningNow =
            screeningLoading[
              candidate.id
            ];

          const error =
            errors[
              candidate.id
            ];

          const isExpanded =
            expanded[
              item.id
            ];

          return (
            <article
              key={item.id}
              className="card overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-lg font-semibold text-[var(--brand-primary)]">
                        {candidate
                          .full_name
                          ?.charAt(0)
                          .toUpperCase() ??
                          "C"}
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold">
                          {candidate.full_name ||
                            "Unnamed Candidate"}
                        </h2>

                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {candidate.current_job_title ||
                            "Role not provided"}

                          {candidate.current_employer
                            ? ` · ${candidate.current_employer}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {candidate.total_experience_years !==
                        null && (
                        <Chip>
                          {
                            candidate.total_experience_years
                          }{" "}
                          years
                        </Chip>
                      )}

                      {candidate.current_location && (
                        <Chip>
                          {
                            candidate.current_location
                          }
                        </Chip>
                      )}

                      {candidate.notice_period_days !==
                        null && (
                        <Chip>
                          {
                            candidate.notice_period_days
                          }{" "}
                          day notice
                        </Chip>
                      )}
                    </div>
                  </div>

                  <div className="w-full space-y-3 xl:w-[420px]">
                    {!document ? (
                      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-5">
                        {uploading ? (
                          <Loader2
                            size={18}
                            className="animate-spin"
                          />
                        ) : (
                          <Upload
                            size={18}
                          />
                        )}

                        <span className="text-sm font-semibold">
                          {uploading
                            ? "Uploading..."
                            : "Upload CV"}
                        </span>

                        <input
                          type="file"
                          accept=".pdf,.docx"
                          disabled={
                            uploading
                          }
                          className="hidden"
                          onChange={(
                            event,
                          ) =>
                            handleFileChange(
                              candidate.id,
                              event,
                            )
                          }
                        />
                      </label>
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <div className="flex items-center gap-3">
                          <FileText
                            size={18}
                            className="text-[var(--brand-primary)]"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {document.original_file_name ||
                                "Candidate CV"}
                            </p>

                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {
                                document.parsing_status
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {document.parsing_status !==
                            "completed" && (
                            <button
                              type="button"
                              disabled={
                                parsing
                              }
                              onClick={() =>
                                void parseCV(
                                  candidate.id,
                                  document.id,
                                )
                              }
                              className="flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {parsing ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <FileSearch
                                  size={14}
                                />
                              )}

                              {parsing
                                ? "Parsing..."
                                : "Parse CV"}
                            </button>
                          )}

                          <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold">
                            Replace CV

                            <input
                              type="file"
                              accept=".pdf,.docx"
                              className="hidden"
                              onChange={(
                                event,
                              ) =>
                                handleFileChange(
                                  candidate.id,
                                  event,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {document?.parsing_status ===
                      "completed" && (
                      <button
                        type="button"
                        disabled={
                          screeningNow
                        }
                        onClick={() =>
                          void runScreening(
                            candidate.id,
                            item.id,
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-60"
                      >
                        {screeningNow ? (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <Sparkles
                            size={17}
                          />
                        )}

                        {screeningNow
                          ? "Screening Candidate..."
                          : scorecard
                            ? "Run Screening Again"
                            : "Run Screening"}
                      </button>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 shrink-0"
                        />

                        {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {scorecard && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ScoreMetric
                      label="Overall Score"
                      value={`${Number(
                        scorecard.total_score,
                      ).toFixed(1)}/100`}
                    />

                    <ScoreMetric
                      label="Recommendation"
                      value={formatRecommendation(
                        scorecard.recommendation,
                      )}
                    />

                    <ScoreMetric
                      label="Confidence"
                      value={`${Number(
                        scorecard.confidence_score,
                      ).toFixed(1)}%`}
                    />

                    <ScoreMetric
                      label="Missing Information"
                      value={String(
                        scorecard.missing_information_count,
                      )}
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <ShieldCheck
                        size={16}
                        className="text-[var(--brand-primary)]"
                      />

                      Evidence-backed
                      Excel HR
                      assessment
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(
                          (
                            previous,
                          ) => ({
                            ...previous,

                            [item.id]:
                              !isExpanded,
                          }),
                        )
                      }
                      className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                      {isExpanded
                        ? "Hide Breakdown"
                        : "View Breakdown"}

                      {isExpanded ? (
                        <ChevronUp
                          size={16}
                        />
                      ) : (
                        <ChevronDown
                          size={16}
                        />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px] text-left text-sm">
                          <thead className="bg-[var(--surface-soft)]">
                            <tr>
                              <th className="p-4">
                                Component
                              </th>

                              <th className="p-4">
                                Score
                              </th>

                              <th className="p-4">
                                Weight
                              </th>

                              <th className="p-4">
                                Contribution
                              </th>

                              <th className="p-4">
                                Confidence
                              </th>

                              <th className="p-4">
                                Evidence
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {components.map(
                              (
                                component,
                              ) => (
                                <tr
                                  key={
                                    component.id ??
                                    component.component_key
                                  }
                                  className="border-t border-[var(--border)] align-top"
                                >
                                  <td className="p-4">
                                    <p className="font-semibold">
                                      {
                                        component.component_label
                                      }
                                    </p>

                                    {component.missing_information && (
                                      <p className="mt-1 text-xs text-amber-700">
                                        Information
                                        unavailable
                                      </p>
                                    )}
                                  </td>

                                  <td className="p-4 font-semibold">
                                    {component.component_score ===
                                    null
                                      ? "—"
                                      : `${Number(
                                          component.component_score,
                                        ).toFixed(
                                          1,
                                        )}`}
                                  </td>

                                  <td className="p-4">
                                    {Number(
                                      component.configured_weight,
                                    ).toFixed(
                                      0,
                                    )}
                                    %
                                  </td>

                                  <td className="p-4">
                                    {Number(
                                      component.score_contribution,
                                    ).toFixed(
                                      2,
                                    )}
                                  </td>

                                  <td className="p-4">
                                    {component.confidence_score ===
                                    null
                                      ? "—"
                                      : `${Number(
                                          component.confidence_score,
                                        ).toFixed(
                                          1,
                                        )}%`}
                                  </td>

                                  <td className="max-w-[430px] p-4">
                                    <p className="whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">
                                      {component.evidence_excerpt ||
                                        "No evidence recorded."}
                                    </p>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        },
      )}

      {candidates.length ===
        0 && (
        <div className="card p-10 text-center">
          <FileText
            size={30}
            className="mx-auto text-[var(--text-muted)]"
          />

          <p className="mt-4 font-semibold">
            No candidates
            selected for CV
            screening.
          </p>
        </div>
      )}

      {screenedCount > 0 &&
        onContinue && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                onContinue
              }
              className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              Continue to
              Finalisation

              <ArrowRight
                size={17}
              />
            </button>
          </div>
        )}
    </section>
  );
}

function Chip({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

function ScoreMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function formatRecommendation(
  value: string,
) {
  switch (value) {
    case "strong_match":
      return "Strong Match";

    case "review_recommended":
      return "Review Recommended";

    case "weak_match":
      return "Weak Match";

    case "insufficient_information":
      return "Insufficient Information";

    default:
      return value;
  }
}