"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Candidate = {
  id: string;
  candidate_id: string;
  workflow_status: string;

  candidates: {
    id: string;
    full_name: string | null;
    email_address: string | null;
    phone_number: string | null;
    current_job_title: string | null;
    current_employer: string | null;
    total_experience_years: number | null;
    current_location: string | null;
    notice_period_days: number | null;
  } | null;

  scorecard: {
    id: string;
    total_score: number;
    recommendation: string;
    confidence_score: number;
    missing_information_count: number;
  };

  components: Array<{
    id: string;
    component_key: string;
    component_label: string;
    component_score: number | null;
    configured_weight: number;
    score_contribution: number;
    evidence_excerpt: string | null;
    confidence_score: number | null;
    missing_information: boolean;
  }>;

  decision: {
    id: string;
    recruiter_decision:
      | "pending"
      | "approved"
      | "rejected";

    final_workflow_decision:
      | "pending"
      | "proceed"
      | "do_not_proceed"
      | null;

    recruiter_agrees_with_ai:
      boolean | null;

    override_reason:
      string | null;

    recruiter_notes:
      string | null;

    phone_verified:
      boolean;

    whatsapp_consent:
      boolean;
  } | null;
};

type DecisionForm = {
  recruiterDecision:
    | "pending"
    | "approved"
    | "rejected";

  recruiterAgreesWithAi:
    boolean;

  overrideReason:
    string;

  recruiterNotes:
    string;

  phoneVerified:
    boolean;

  whatsappConsent:
    boolean;

  finalWorkflowDecision:
    | "pending"
    | "proceed"
    | "do_not_proceed";
};

type Props = {
  jobId: string;
  onContinue?: () => void;
};

export default function CandidateFinalisation({
  jobId,
  onContinue,
}: Props) {
  const [
    candidates,
    setCandidates,
  ] = useState<Candidate[]>(
    [],
  );

  const [
    forms,
    setForms,
  ] = useState<
    Record<
      string,
      DecisionForm
    >
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    errors,
    setErrors,
  ] = useState<
    Record<string, string>
  >({});

  const [
    success,
    setSuccess,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    expanded,
    setExpanded,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    pageError,
    setPageError,
  ] = useState("");

  const loadCandidates =
    useCallback(
      async () => {
        setLoading(true);
        setPageError("");

        try {
          const response =
            await fetch(
              `/api/jobs/${jobId}/finalisation`,
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
                "Unable to load finalisation.",
            );
          }

          const loaded:
            Candidate[] =
              result.candidates ??
              [];

          setCandidates(
            loaded,
          );

          const nextForms:
            Record<
              string,
              DecisionForm
            > = {};

          for (
            const item of
            loaded
          ) {
            nextForms[
              item.id
            ] = {
              recruiterDecision:
                item.decision
                  ?.recruiter_decision ??
                "pending",

              recruiterAgreesWithAi:
                item.decision
                  ?.recruiter_agrees_with_ai ??
                true,

              overrideReason:
                item.decision
                  ?.override_reason ??
                "",

              recruiterNotes:
                item.decision
                  ?.recruiter_notes ??
                "",

              phoneVerified:
                item.decision
                  ?.phone_verified ??
                false,

              whatsappConsent:
                item.decision
                  ?.whatsapp_consent ??
                false,

              finalWorkflowDecision:
                item.decision
                  ?.final_workflow_decision ??
                "pending",
            };
          }

          setForms(
            nextForms,
          );
        } catch (error) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Unable to load finalisation.",
          );
        } finally {
          setLoading(false);
        }
      },
      [jobId],
    );

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  function updateForm(
    id: string,
    update:
      Partial<DecisionForm>,
  ) {
    setForms(
      (previous) => ({
        ...previous,

        [id]: {
          ...previous[id],
          ...update,
        },
      }),
    );

    setSuccess(
      (previous) => ({
        ...previous,
        [id]: false,
      }),
    );
  }

  async function saveDecision(
    item: Candidate,
  ) {
    const form =
      forms[item.id];

    if (!form) {
      return;
    }

    setSaving(
      (previous) => ({
        ...previous,
        [item.id]: true,
      }),
    );

    setErrors(
      (previous) => ({
        ...previous,
        [item.id]: "",
      }),
    );

    setSuccess(
      (previous) => ({
        ...previous,
        [item.id]: false,
      }),
    );

    try {
      const response =
        await fetch(
          `/api/job-candidates/${item.id}/decision`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                form,
              ),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            "Unable to save decision.",
        );
      }

      setSuccess(
        (previous) => ({
          ...previous,
          [item.id]: true,
        }),
      );

      await loadCandidates();
    } catch (error) {
      setErrors(
        (previous) => ({
          ...previous,

          [item.id]:
            error instanceof Error
              ? error.message
              : "Unable to save decision.",
        }),
      );
    } finally {
      setSaving(
        (previous) => ({
          ...previous,
          [item.id]: false,
        }),
      );
    }
  }

  const proceedCount =
    candidates.filter(
      (item) =>
        item.decision
          ?.final_workflow_decision ===
        "proceed",
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
            Loading candidate
            finalisation...
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
            Stage 4
          </p>

          <h1 className="text-3xl font-semibold">
            Candidate
            Finalisation
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Review the model
            recommendation and
            make the final human
            recruitment decision.
            The recruiter remains
            fully in control.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-xl bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-primary)]">
            {
              proceedCount
            }{" "}
            proceeding
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

      {candidates.length ===
        0 && (
        <div className="card p-10 text-center">
          <ShieldCheck
            size={32}
            className="mx-auto text-[var(--text-muted)]"
          />

          <p className="mt-4 font-semibold">
            No screened
            candidates found.
          </p>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Run CV screening
            before finalising
            candidates.
          </p>
        </div>
      )}

      {candidates.map(
        (item) => {
          const candidate =
            item.candidates;

          const form =
            forms[item.id];

          if (
            !candidate ||
            !form
          ) {
            return null;
          }

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
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-lg font-semibold text-[var(--brand-primary)]">
                        {candidate
                          .full_name
                          ?.charAt(
                            0,
                          )
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

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Metric
                        label="AI Score"
                        value={`${Number(
                          item
                            .scorecard
                            .total_score,
                        ).toFixed(
                          1,
                        )}/100`}
                      />

                      <Metric
                        label="AI Recommendation"
                        value={formatRecommendation(
                          item
                            .scorecard
                            .recommendation,
                        )}
                      />

                      <Metric
                        label="Confidence"
                        value={`${Number(
                          item
                            .scorecard
                            .confidence_score,
                        ).toFixed(
                          1,
                        )}%`}
                      />
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
                      className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                      {isExpanded
                        ? "Hide scoring breakdown"
                        : "View scoring breakdown"}

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

                    {isExpanded && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                        {item.components.map(
                          (
                            component,
                          ) => (
                            <div
                              key={
                                component.id
                              }
                              className="border-b border-[var(--border)] p-4 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-semibold">
                                  {
                                    component.component_label
                                  }
                                </p>

                                <p className="text-sm font-semibold">
                                  {component.component_score ===
                                  null
                                    ? "—"
                                    : `${Number(
                                        component.component_score,
                                      ).toFixed(
                                        1,
                                      )}/100`}
                                </p>
                              </div>

                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">
                                {component.evidence_excerpt ||
                                  "No evidence recorded."}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                    <p className="text-sm font-semibold">
                      Recruiter
                      Decision
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateForm(
                            item.id,
                            {
                              recruiterDecision:
                                "approved",

                              finalWorkflowDecision:
                                "proceed",
                            },
                          )
                        }
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          form.recruiterDecision ===
                          "approved"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-[var(--border)] bg-white"
                        }`}
                      >
                        <UserCheck
                          size={17}
                        />

                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateForm(
                            item.id,
                            {
                              recruiterDecision:
                                "rejected",

                              finalWorkflowDecision:
                                "do_not_proceed",
                            },
                          )
                        }
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          form.recruiterDecision ===
                          "rejected"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-[var(--border)] bg-white"
                        }`}
                      >
                        <UserX
                          size={17}
                        />

                        Reject
                      </button>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-medium">
                        Do you agree
                        with the AI
                        recommendation?
                      </p>

                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateForm(
                              item.id,
                              {
                                recruiterAgreesWithAi:
                                  true,
                              },
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                            form.recruiterAgreesWithAi
                              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                              : "border-[var(--border)] bg-white"
                          }`}
                        >
                          Yes
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateForm(
                              item.id,
                              {
                                recruiterAgreesWithAi:
                                  false,
                              },
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                            !form.recruiterAgreesWithAi
                              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                              : "border-[var(--border)] bg-white"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {!form.recruiterAgreesWithAi && (
                      <div className="mt-4">
                        <label className="text-sm font-medium">
                          Override
                          Reason *
                        </label>

                        <textarea
                          value={
                            form.overrideReason
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              item.id,
                              {
                                overrideReason:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          rows={3}
                          placeholder="Explain why the recruiter is overriding the model..."
                          className="input-style mt-2 resize-none"
                        />
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="text-sm font-medium">
                        Recruiter Notes
                      </label>

                      <textarea
                        value={
                          form.recruiterNotes
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            item.id,
                            {
                              recruiterNotes:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        rows={3}
                        placeholder="Optional recruiter notes..."
                        className="input-style mt-2 resize-none"
                      />
                    </div>

                    <div className="mt-5 space-y-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            form.phoneVerified
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              item.id,
                              {
                                phoneVerified:
                                  event
                                    .target
                                    .checked,
                              },
                            )
                          }
                          className="mt-1"
                        />

                        <span>
                          <span className="block text-sm font-medium">
                            Phone
                            number
                            verified
                          </span>

                          <span className="text-xs text-[var(--text-secondary)]">
                            {
                              candidate.phone_number ||
                              "No phone number available"
                            }
                          </span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            form.whatsappConsent
                          }
                          onChange={(
                            event,
                          ) =>
                            updateForm(
                              item.id,
                              {
                                whatsappConsent:
                                  event
                                    .target
                                    .checked,
                              },
                            )
                          }
                          className="mt-1"
                        />

                        <span>
                          <span className="block text-sm font-medium">
                            WhatsApp
                            outreach
                            consent
                            confirmed
                          </span>

                          <span className="text-xs text-[var(--text-secondary)]">
                            Required
                            before
                            outreach is
                            enabled.
                          </span>
                        </span>
                      </label>
                    </div>

                    {errors[
                      item.id
                    ] && (
                      <div className="mt-4 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 shrink-0"
                        />

                        {
                          errors[
                            item.id
                          ]
                        }
                      </div>
                    )}

                    {success[
                      item.id
                    ] && (
                      <div className="mt-4 flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                        <CheckCircle2
                          size={14}
                        />

                        Decision
                        saved.
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={
                        saving[
                          item.id
                        ]
                      }
                      onClick={() =>
                        void saveDecision(
                          item,
                        )
                      }
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving[
                        item.id
                      ] ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <ShieldCheck
                          size={17}
                        />
                      )}

                      {saving[
                        item.id
                      ]
                        ? "Saving..."
                        : "Save Final Decision"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        },
      )}

      {proceedCount >
        0 &&
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
              WhatsApp
              Outreach

              <ArrowRight
                size={17}
              />
            </button>
          </div>
        )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="text-xs text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-base font-semibold">
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