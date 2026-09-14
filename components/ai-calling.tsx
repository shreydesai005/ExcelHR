"use client";

import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Languages,
  Loader2,
  LockKeyhole,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type ProviderStatus = {
  configured: boolean;
  provider: string;
  missingVariables: string[];
};

type CandidateInfo = {
  id: string;
  full_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  normalized_phone: string | null;
  current_job_title: string | null;
  current_employer: string | null;
  total_experience_years: number | null;
  current_location: string | null;
};

type Communication = {
  id: string;
  communication_status: string;
  provider_name: string | null;
  provider_message_id: string | null;
};

type CallEvent = {
  id: string;
  provider_name: string | null;
  provider_call_id: string | null;
  call_status: string;
  call_language:
    | "english"
    | "hindi"
    | "hinglish"
    | null;
  scheduled_for: string | null;
  transcript_storage_path:
    | string
    | null;
  recording_storage_path:
    | string
    | null;
  provider_error_code:
    | string
    | null;
  provider_error_message:
    | string
    | null;
};

type CallingCandidate = {
  id: string;
  candidateId: string;
  workflowStatus: string;

  candidate:
    | CandidateInfo
    | null;

  communication:
    | Communication
    | null;

  call:
    | CallEvent
    | null;

  eligible: boolean;
  blockers: string[];
};

type Props = {
  jobId: string;
  onContinue?: () => void;
};

type Language =
  | "english"
  | "hindi"
  | "hinglish";

export default function AICalling({
  jobId,
  onContinue,
}: Props) {
  const [
    candidates,
    setCandidates,
  ] = useState<
    CallingCandidate[]
  >([]);

  const [
    provider,
    setProvider,
  ] = useState<
    ProviderStatus | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    languages,
    setLanguages,
  ] = useState<
    Record<
      string,
      Language
    >
  >({});

  const [
    scheduledTimes,
    setScheduledTimes,
  ] = useState<
    Record<string, string>
  >({});

  const [
    preparing,
    setPreparing,
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
    Record<string, string>
  >({});

  const loadQueue =
    useCallback(
      async () => {
        setLoading(true);
        setPageError("");

        try {
          const response =
            await fetch(
              `/api/jobs/${jobId}/calling`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Unable to load AI calling queue.",
            );
          }

          setCandidates(
            result.candidates ??
              [],
          );

          setProvider(
            result.provider ??
              null,
          );

          const initialLanguages: Record<
            string,
            Language
          > = {};

          const initialSchedules: Record<
            string,
            string
          > = {};

          for (
            const item of
              result.candidates ??
            []
          ) {
            initialLanguages[
              item.id
            ] =
              item.call
                ?.call_language ??
              "english";

            if (
              item.call
                ?.scheduled_for
            ) {
              initialSchedules[
                item.id
              ] =
                toLocalDateTimeInput(
                  item.call
                    .scheduled_for,
                );
            }
          }

          setLanguages(
            initialLanguages,
          );

          setScheduledTimes(
            initialSchedules,
          );
        } catch (error) {
          setPageError(
            error instanceof
              Error
              ? error.message
              : "Unable to load calling queue.",
          );
        } finally {
          setLoading(false);
        }
      },
      [jobId],
    );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function prepareCall(
    item: CallingCandidate,
  ) {
    const language =
      languages[item.id] ??
      "english";

    const localSchedule =
      scheduledTimes[
        item.id
      ];

    let scheduledFor:
      | string
      | null = null;

    if (localSchedule) {
      const date =
        new Date(
          localSchedule,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        setErrors(
          (previous) => ({
            ...previous,

            [item.id]:
              "Invalid call schedule.",
          }),
        );

        return;
      }

      if (
        date.getTime() <=
        Date.now()
      ) {
        setErrors(
          (previous) => ({
            ...previous,

            [item.id]:
              "Scheduled call time must be in the future.",
          }),
        );

        return;
      }

      scheduledFor =
        date.toISOString();
    }

    setPreparing(
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
        [item.id]: "",
      }),
    );

    try {
      const response =
        await fetch(
          `/api/job-candidates/${item.id}/call`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                language,
                scheduledFor,
              }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to prepare AI call.",
        );
      }

      setSuccess(
        (previous) => ({
          ...previous,

          [item.id]:
            result.message ||
            "Call configuration saved.",
        }),
      );

      await loadQueue();
    } catch (error) {
      setErrors(
        (previous) => ({
          ...previous,

          [item.id]:
            error instanceof
              Error
              ? error.message
              : "Unable to prepare AI call.",
        }),
      );

      await loadQueue();
    } finally {
      setPreparing(
        (previous) => ({
          ...previous,
          [item.id]: false,
        }),
      );
    }
  }

  const eligibleCount =
    candidates.filter(
      (item) =>
        item.eligible,
    ).length;

  const scheduledCount =
    candidates.filter(
      (item) =>
        item.call
          ?.call_status ===
        "scheduled",
    ).length;

  const completedCount =
    candidates.filter(
      (item) =>
        item.call
          ?.call_status ===
        "completed",
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
            Loading AI calling
            queue...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Stage 6
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            AI Calling
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Configure AI calls
            only for candidates
            who have passed human
            review and expressed
            interest through the
            outreach workflow.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadQueue()
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <RefreshCw
            size={16}
          />

          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Eligible for Calling"
          value={String(
            eligibleCount,
          )}
        />

        <Metric
          label="Scheduled Calls"
          value={String(
            scheduledCount,
          )}
        />

        <Metric
          label="Completed Calls"
          value={String(
            completedCount,
          )}
        />
      </div>

      {provider && (
        <div
          className={`rounded-2xl border p-5 ${
            provider.configured
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {provider.configured ? (
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
            ) : (
              <LockKeyhole
                size={20}
                className="mt-0.5 shrink-0 text-amber-700"
              />
            )}

            <div>
              <p className="font-semibold">
                {provider.configured
                  ? "Calling provider credentials detected"
                  : "AI calling provider is not configured"}
              </p>

              <p className="mt-1 text-sm leading-6 opacity-80">
                {provider.configured
                  ? "Call configuration can be stored, but real calls remain disabled until the provider adapter is implemented."
                  : "No AI call can be initiated until valid server-side provider credentials are configured."}
              </p>

              {!provider.configured &&
                provider
                  .missingVariables
                  .length >
                  0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.missingVariables.map(
                      (
                        variable,
                      ) => (
                        <span
                          key={
                            variable
                          }
                          className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 font-mono text-xs"
                        >
                          {
                            variable
                          }
                        </span>
                      ),
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {candidates.length ===
        0 && (
        <div className="card p-10 text-center">
          <Bot
            size={34}
            className="mx-auto text-[var(--text-muted)]"
          />

          <p className="mt-4 font-semibold">
            No candidates in
            the calling queue.
          </p>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Candidates will
            appear after
            recruiter approval
            and the outreach
            workflow.
          </p>
        </div>
      )}

      {candidates.map(
        (item) => {
          const candidate =
            item.candidate;

          if (!candidate) {
            return null;
          }

          const language =
            languages[
              item.id
            ] ?? "english";

          const isPreparing =
            preparing[
              item.id
            ];

          return (
            <article
              key={item.id}
              className="card overflow-hidden"
            >
              <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
                <div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-lg font-semibold text-[var(--brand-primary)]">
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

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SmallMetric
                      label="Phone"
                      value={
                        candidate.phone_number ||
                        candidate.normalized_phone ||
                        "Not available"
                      }
                    />

                    <SmallMetric
                      label="WhatsApp Status"
                      value={formatStatus(
                        item.communication
                          ?.communication_status ??
                          "not_ready",
                      )}
                    />

                    <SmallMetric
                      label="Call Status"
                      value={formatStatus(
                        item.call
                          ?.call_status ??
                          "not_ready",
                      )}
                    />

                    <SmallMetric
                      label="Language"
                      value={formatStatus(
                        item.call
                          ?.call_language ??
                          language,
                      )}
                    />
                  </div>

                  {!item.eligible && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex gap-3">
                        <AlertCircle
                          size={
                            18
                          }
                          className="mt-0.5 shrink-0 text-amber-700"
                        />

                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            AI
                            calling
                            blocked
                          </p>

                          <div className="mt-2 space-y-1 text-xs text-amber-800">
                            {item.blockers.map(
                              (
                                blocker,
                              ) => (
                                <p
                                  key={
                                    blocker
                                  }
                                >
                                  •{" "}
                                  {
                                    blocker
                                  }
                                </p>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.call && (
                    <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                      <p className="text-sm font-semibold">
                        Latest Call
                        Record
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <SmallMetric
                          label="Status"
                          value={formatStatus(
                            item.call
                              .call_status,
                          )}
                        />

                        <SmallMetric
                          label="Language"
                          value={formatStatus(
                            item.call
                              .call_language ??
                              "not selected",
                          )}
                        />

                        <SmallMetric
                          label="Provider Call ID"
                          value={
                            item.call
                              .provider_call_id ||
                            "Not assigned"
                          }
                        />

                        <SmallMetric
                          label="Scheduled For"
                          value={
                            item.call
                              .scheduled_for
                              ? new Date(
                                  item.call.scheduled_for,
                                ).toLocaleString()
                              : "Not scheduled"
                          }
                        />
                      </div>

                      {item.call
                        .provider_error_message && (
                        <p className="mt-3 text-xs text-red-600">
                          {
                            item.call
                              .provider_error_message
                          }
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                  <div className="flex items-center gap-2">
                    <Bot
                      size={18}
                      className="text-[var(--brand-primary)]"
                    />

                    <p className="font-semibold">
                      AI Call
                      Configuration
                    </p>
                  </div>

                  <div className="mt-5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Languages
                        size={
                          16
                        }
                      />

                      Call
                      Language
                    </label>

                    <select
                      value={
                        language
                      }
                      disabled={
                        !item.eligible
                      }
                      onChange={(
                        event,
                      ) =>
                        setLanguages(
                          (
                            previous,
                          ) => ({
                            ...previous,

                            [item.id]:
                              event
                                .target
                                .value as Language,
                          }),
                        )
                      }
                      className="input-style mt-2"
                    >
                      <option value="english">
                        English
                      </option>

                      <option value="hindi">
                        Hindi
                      </option>

                      <option value="hinglish">
                        Hinglish
                      </option>
                    </select>
                  </div>

                  <div className="mt-5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock
                        size={
                          16
                        }
                      />

                      Schedule
                      Call
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        scheduledTimes[
                          item.id
                        ] ?? ""
                      }
                      disabled={
                        !item.eligible
                      }
                      onChange={(
                        event,
                      ) =>
                        setScheduledTimes(
                          (
                            previous,
                          ) => ({
                            ...previous,

                            [item.id]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="input-style mt-2"
                    />

                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Leave empty
                      to prepare
                      the call
                      without a
                      schedule.
                    </p>
                  </div>

                  <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                    <div className="flex gap-3">
                      <ShieldCheck
                        size={
                          17
                        }
                        className="mt-0.5 shrink-0 text-[var(--brand-primary)]"
                      />

                      <p className="text-xs leading-5 text-[var(--text-secondary)]">
                        Saving
                        configuration
                        does not
                        initiate a
                        phone call.
                        A real call
                        will only be
                        recorded
                        after the
                        provider
                        accepts the
                        request.
                      </p>
                    </div>
                  </div>

                  {errors[
                    item.id
                  ] && (
                    <div className="mt-4 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                      <AlertCircle
                        size={
                          14
                        }
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
                        size={
                          14
                        }
                        className="mt-0.5 shrink-0"
                      />

                      {
                        success[
                          item.id
                        ]
                      }
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      !item.eligible ||
                      isPreparing
                    }
                    onClick={() =>
                      void prepareCall(
                        item,
                      )
                    }
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPreparing ? (
                      <Loader2
                        size={
                          17
                        }
                        className="animate-spin"
                      />
                    ) : (
                      <CalendarClock
                        size={
                          17
                        }
                      />
                    )}

                    {isPreparing
                      ? "Saving..."
                      : "Save Call Configuration"}
                  </button>

                  <button
                    type="button"
                    disabled
                    title="Connect a real AI calling provider first."
                    className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-muted)] opacity-60"
                  >
                    <Phone
                      size={17}
                    />

                    Start AI Call
                  </button>
                </div>
              </div>
            </article>
          );
        },
      )}

      {completedCount >
        0 &&
        onContinue && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                onContinue
              }
              className="rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              Continue to
              Final Report
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
    <div className="card p-5">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function formatStatus(
  value: string,
) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function toLocalDateTimeInput(
  iso: string,
) {
  const date =
    new Date(iso);

  const offset =
    date.getTimezoneOffset();

  const local =
    new Date(
      date.getTime() -
        offset *
          60 *
          1000,
    );

  return local
    .toISOString()
    .slice(0, 16);
}