"use client";

import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Job = {
  id: string;
  client_name: string;
  job_title: string;
  department: string | null;
  location: string | null;
  work_mode: string;
  min_experience_years: number;
  max_experience_years: number;
  max_notice_period_days: number;
  education_requirements: string | null;
  required_skills: string[];
  preferred_skills: string[];
  knockout_criteria: string[];
  qualifying_score: number;
  job_status: string;
  created_at: string;
};

type CandidateInfo = {
  id: string;
  full_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  current_job_title: string | null;
  current_employer: string | null;
  total_experience_years: number | null;
  current_location: string | null;
  preferred_location: string | null;
  notice_period_days: number | null;
  education_summary: string | null;
  skills: string[];
  duplicate_flag: boolean;
  duplicate_status: string;
};

type Scorecard = {
  id: string;
  total_score: number | null;
  recommendation: string | null;
  confidence_score: number | null;
  missing_information_count: number;
  parser_version: string | null;
  taxonomy_version: string | null;
  embedding_model_version: string | null;
  scoring_policy_version: string | null;
  assessment_timestamp: string;
};

type ScoreComponent = {
  id: string;
  component_key: string;
  component_label: string;
  jd_requirement: string | null;
  candidate_value: string | null;
  component_score: number | null;
  configured_weight: number | null;
  score_contribution: number | null;
  evidence_excerpt: string | null;
  confidence_score: number | null;
  missing_information: boolean;
};

type Decision = {
  id: string;
  ai_recommendation: string | null;
  recruiter_decision: string;
  final_workflow_decision: string | null;
  recruiter_agrees_with_ai: boolean | null;
  override_reason: string | null;
  recruiter_notes: string | null;
  phone_verified: boolean;
  whatsapp_consent: boolean;
};

type Communication = {
  id: string;
  provider_name: string | null;
  provider_message_id: string | null;
  communication_status: string;
  template_name: string | null;
  provider_error_message: string | null;
};

type Call = {
  id: string;
  provider_name: string | null;
  provider_call_id: string | null;
  call_status: string;
  call_language: string | null;
  scheduled_for: string | null;
  transcript_storage_path: string | null;
  recording_storage_path: string | null;
  provider_error_message: string | null;
};

type ReportCandidate = {
  id: string;
  candidateId: string;
  initialSelected: boolean;
  recruiterReviewStatus: string;
  workflowStatus: string;
  candidate: CandidateInfo | null;
  scorecard: Scorecard | null;
  scoreComponents: ScoreComponent[];
  decision: Decision | null;
  communication: Communication | null;
  call: Call | null;
};

type Summary = {
  totalCandidates: number;
  initiallySelected: number;
  screened: number;
  recruiterApproved: number;
  recruiterRejected: number;
  outreachEligible: number;
  whatsappInterested: number;
  callsCompleted: number;
};

type ReportResponse = {
  success: boolean;
  job: Job;
  candidates: ReportCandidate[];
  summary: Summary;
  generatedAt: string;
};

type Props = {
  jobId: string;
};

export default function FinalReport({
  jobId,
}: Props) {
  const [
    report,
    setReport,
  ] = useState<ReportResponse | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    expanded,
    setExpanded,
  ] = useState<
    Record<string, boolean>
  >({});

  const loadReport =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `/api/jobs/${jobId}/report`,
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
              "Unable to load final report.",
          );
        }

        setReport(result);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load final report.",
        );
      } finally {
        setLoading(false);
      }
    }, [jobId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  function toggleCandidate(
    id: string,
  ) {
    setExpanded(
      (previous) => ({
        ...previous,

        [id]:
          !previous[id],
      }),
    );
  }

  if (loading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center p-8">
        <div className="text-center">
          <Loader2
            size={30}
            className="mx-auto animate-spin text-[var(--brand-primary)]"
          />

          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Building final
            recruitment
            report...
          </p>
        </div>
      </div>
    );
  }

  if (
    error ||
    !report
  ) {
    return (
      <div className="card p-8">
        <div className="flex gap-3">
          <AlertCircle
            size={20}
            className="shrink-0 text-red-600"
          />

          <div>
            <p className="font-semibold">
              Unable to load
              report
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadReport()
              }
              className="mt-4 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    job,
    candidates,
    summary,
  } = report;

  return (
    <section className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Stage 7
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Final Recruitment
            Report
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Consolidated
            recruitment record
            containing model
            assessments,
            evidence, recruiter
            decisions,
            communication
            status and calling
            outcomes.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadReport()
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <RefreshCw
            size={16}
          />

          Refresh Report
        </button>
      </div>

      {/* JOB INFORMATION */}

      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
            <BriefcaseBusiness
              size={20}
            />
          </div>

          <div>
            <h2 className="text-xl font-semibold">
              {job.job_title}
            </h2>

            <p className="text-sm text-[var(--text-secondary)]">
              {job.client_name}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="Department"
            value={
              job.department ||
              "Not specified"
            }
          />

          <Info
            label="Location"
            value={
              job.location ||
              "Not specified"
            }
          />

          <Info
            label="Work Mode"
            value={formatStatus(
              job.work_mode,
            )}
          />

          <Info
            label="Experience"
            value={`${job.min_experience_years} – ${job.max_experience_years} years`}
          />

          <Info
            label="Maximum Notice"
            value={`${job.max_notice_period_days} days`}
          />

          <Info
            label="Qualifying Score"
            value={`${job.qualifying_score}%`}
          />

          <Info
            label="Job Status"
            value={formatStatus(
              job.job_status,
            )}
          />

          <Info
            label="Created"
            value={new Date(
              job.created_at,
            ).toLocaleDateString()}
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <SkillBlock
            title="Required Skills"
            values={
              job.required_skills ??
              []
            }
          />

          <SkillBlock
            title="Preferred Skills"
            values={
              job.preferred_skills ??
              []
            }
          />

          <SkillBlock
            title="Knockout Criteria"
            values={
              job.knockout_criteria ??
              []
            }
          />
        </div>
      </div>

      {/* SUMMARY */}

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Recruitment
          Summary
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={
              <Users
                size={18}
              />
            }
            label="Total Candidates"
            value={
              summary.totalCandidates
            }
          />

          <Metric
            icon={
              <FileText
                size={18}
              />
            }
            label="CV Screened"
            value={
              summary.screened
            }
          />

          <Metric
            icon={
              <UserCheck
                size={18}
              />
            }
            label="Recruiter Approved"
            value={
              summary.recruiterApproved
            }
          />

          <Metric
            icon={
              <ClipboardCheck
                size={18}
              />
            }
            label="Recruiter Rejected"
            value={
              summary.recruiterRejected
            }
          />

          <Metric
            icon={
              <MessageCircle
                size={18}
              />
            }
            label="Outreach Eligible"
            value={
              summary.outreachEligible
            }
          />

          <Metric
            icon={
              <CheckCircle2
                size={18}
              />
            }
            label="WhatsApp Interested"
            value={
              summary.whatsappInterested
            }
          />

          <Metric
            icon={
              <Phone
                size={18}
              />
            }
            label="Calls Completed"
            value={
              summary.callsCompleted
            }
          />

          <Metric
            icon={
              <ShieldCheck
                size={18}
              />
            }
            label="Initially Selected"
            value={
              summary.initiallySelected
            }
          />
        </div>
      </div>

      {/* CANDIDATES */}

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Candidate Report
          </h2>

          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Each candidate
            record preserves
            AI assessment and
            recruiter decision
            separately.
          </p>
        </div>

        {candidates.length ===
          0 && (
          <div className="card p-10 text-center">
            <Users
              size={32}
              className="mx-auto text-[var(--text-muted)]"
            />

            <p className="mt-4 font-semibold">
              No candidates
              found.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {candidates.map(
            (item) => {
              const candidate =
                item.candidate;

              if (!candidate) {
                return null;
              }

              const isExpanded =
                expanded[
                  item.id
                ] ?? false;

              return (
                <article
                  key={
                    item.id
                  }
                  className="card overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
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
                          <h3 className="text-lg font-semibold">
                            {candidate.full_name ||
                              "Unnamed Candidate"}
                          </h3>

                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {candidate.current_job_title ||
                              "Role not provided"}

                            {candidate.current_employer
                              ? ` · ${candidate.current_employer}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ReportValue
                          label="AI Score"
                          value={
                            item.scorecard
                              ?.total_score !=
                            null
                              ? `${item.scorecard.total_score}%`
                              : "Not screened"
                          }
                        />

                        <ReportValue
                          label="AI Recommendation"
                          value={formatStatus(
                            item.scorecard
                              ?.recommendation ??
                              "not available",
                          )}
                        />

                        <ReportValue
                          label="Recruiter"
                          value={formatStatus(
                            item.decision
                              ?.recruiter_decision ??
                              "pending",
                          )}
                        />

                        <ReportValue
                          label="Workflow"
                          value={formatStatus(
                            item.workflowStatus,
                          )}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleCandidate(
                          item.id,
                        )
                      }
                      className="mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                      {isExpanded ? (
                        <ChevronUp
                          size={16}
                        />
                      ) : (
                        <ChevronDown
                          size={16}
                        />
                      )}

                      {isExpanded
                        ? "Hide Detailed Report"
                        : "View Detailed Report"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-6">
                      {/* PROFILE */}

                      <ReportSection
                        title="Candidate Profile"
                      >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Info
                            label="Email"
                            value={
                              candidate.email_address ||
                              "Not available"
                            }
                          />

                          <Info
                            label="Phone"
                            value={
                              candidate.phone_number ||
                              "Not available"
                            }
                          />

                          <Info
                            label="Experience"
                            value={
                              candidate.total_experience_years !=
                              null
                                ? `${candidate.total_experience_years} years`
                                : "Not available"
                            }
                          />

                          <Info
                            label="Location"
                            value={
                              candidate.current_location ||
                              "Not available"
                            }
                          />

                          <Info
                            label="Preferred Location"
                            value={
                              candidate.preferred_location ||
                              "Not available"
                            }
                          />

                          <Info
                            label="Notice Period"
                            value={
                              candidate.notice_period_days !=
                              null
                                ? `${candidate.notice_period_days} days`
                                : "Not available"
                            }
                          />

                          <Info
                            label="Education"
                            value={
                              candidate.education_summary ||
                              "Not available"
                            }
                          />

                          <Info
                            label="Duplicate Status"
                            value={formatStatus(
                              candidate.duplicate_status,
                            )}
                          />
                        </div>
                      </ReportSection>

                      {/* AI */}

                      <ReportSection
                        title="CV Screening Assessment"
                      >
                        {!item.scorecard ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            No CV
                            screening
                            scorecard is
                            available.
                          </p>
                        ) : (
                          <>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <Info
                                label="Overall Score"
                                value={
                                  item.scorecard.total_score !=
                                  null
                                    ? `${item.scorecard.total_score}%`
                                    : "Unavailable"
                                }
                              />

                              <Info
                                label="Recommendation"
                                value={formatStatus(
                                  item.scorecard.recommendation ??
                                    "Unavailable",
                                )}
                              />

                              <Info
                                label="Confidence"
                                value={
                                  item.scorecard.confidence_score !=
                                  null
                                    ? `${item.scorecard.confidence_score}%`
                                    : "Unavailable"
                                }
                              />

                              <Info
                                label="Missing Information"
                                value={String(
                                  item.scorecard.missing_information_count,
                                )}
                              />
                            </div>

                            {item
                              .scoreComponents
                              .length >
                              0 && (
                              <div className="mt-5 overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
                                      <th className="pb-3 pr-4">
                                        Component
                                      </th>

                                      <th className="pb-3 pr-4">
                                        JD Requirement
                                      </th>

                                      <th className="pb-3 pr-4">
                                        Candidate Evidence
                                      </th>

                                      <th className="pb-3 pr-4">
                                        Score
                                      </th>

                                      <th className="pb-3 pr-4">
                                        Weight
                                      </th>

                                      <th className="pb-3">
                                        Confidence
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {item.scoreComponents.map(
                                      (
                                        component,
                                      ) => (
                                        <tr
                                          key={
                                            component.id
                                          }
                                          className="border-b border-[var(--border)] align-top"
                                        >
                                          <td className="py-4 pr-4 font-medium">
                                            {
                                              component.component_label
                                            }
                                          </td>

                                          <td className="max-w-[220px] py-4 pr-4 text-[var(--text-secondary)]">
                                            {component.jd_requirement ||
                                              "—"}
                                          </td>

                                          <td className="max-w-[300px] py-4 pr-4 text-[var(--text-secondary)]">
                                            {component.evidence_excerpt ||
                                              component.candidate_value ||
                                              "No evidence available"}
                                          </td>

                                          <td className="py-4 pr-4">
                                            {component.component_score !=
                                            null
                                              ? `${component.component_score}%`
                                              : "—"}
                                          </td>

                                          <td className="py-4 pr-4">
                                            {component.configured_weight !=
                                            null
                                              ? `${component.configured_weight}%`
                                              : "—"}
                                          </td>

                                          <td className="py-4">
                                            {component.confidence_score !=
                                            null
                                              ? `${component.confidence_score}%`
                                              : "—"}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                              <p className="text-xs font-semibold">
                                Reproducibility
                                Metadata
                              </p>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Info
                                  label="Embedding Model"
                                  value={
                                    item.scorecard.embedding_model_version ||
                                    "Not recorded"
                                  }
                                />

                                <Info
                                  label="Scoring Policy"
                                  value={
                                    item.scorecard.scoring_policy_version ||
                                    "Not recorded"
                                  }
                                />

                                <Info
                                  label="Parser"
                                  value={
                                    item.scorecard.parser_version ||
                                    "Not recorded"
                                  }
                                />

                                <Info
                                  label="Taxonomy"
                                  value={
                                    item.scorecard.taxonomy_version ||
                                    "Not recorded"
                                  }
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </ReportSection>

                      {/* RECRUITER */}

                      <ReportSection
                        title="Recruiter Decision"
                      >
                        {!item.decision ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            No recruiter
                            decision has
                            been recorded.
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Info
                              label="Decision"
                              value={formatStatus(
                                item.decision.recruiter_decision,
                              )}
                            />

                            <Info
                              label="Final Workflow Decision"
                              value={formatStatus(
                                item.decision.final_workflow_decision ??
                                  "pending",
                              )}
                            />

                            <Info
                              label="Agrees with AI"
                              value={
                                item.decision.recruiter_agrees_with_ai ===
                                true
                                  ? "Yes"
                                  : item.decision.recruiter_agrees_with_ai ===
                                      false
                                    ? "No"
                                    : "Not recorded"
                              }
                            />

                            <Info
                              label="Phone Verified"
                              value={
                                item.decision.phone_verified
                                  ? "Yes"
                                  : "No"
                              }
                            />

                            <Info
                              label="WhatsApp Consent"
                              value={
                                item.decision.whatsapp_consent
                                  ? "Yes"
                                  : "No"
                              }
                            />

                            <Info
                              label="Override Reason"
                              value={
                                item.decision.override_reason ||
                                "None"
                              }
                            />

                            <div className="sm:col-span-2">
                              <Info
                                label="Recruiter Notes"
                                value={
                                  item.decision.recruiter_notes ||
                                  "No notes"
                                }
                              />
                            </div>
                          </div>
                        )}
                      </ReportSection>

                      {/* COMMUNICATION */}

                      <ReportSection
                        title="WhatsApp Outreach"
                      >
                        {!item.communication ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            No WhatsApp
                            communication
                            event recorded.
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Info
                              label="Status"
                              value={formatStatus(
                                item.communication.communication_status,
                              )}
                            />

                            <Info
                              label="Provider"
                              value={
                                item.communication.provider_name ||
                                "Not available"
                              }
                            />

                            <Info
                              label="Template"
                              value={
                                item.communication.template_name ||
                                "Not available"
                              }
                            />

                            <Info
                              label="Provider Message ID"
                              value={
                                item.communication.provider_message_id ||
                                "Not assigned"
                              }
                            />
                          </div>
                        )}
                      </ReportSection>

                      {/* CALL */}

                      <ReportSection
                        title="AI Calling"
                      >
                        {!item.call ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            No AI call
                            record
                            available.
                          </p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Info
                              label="Status"
                              value={formatStatus(
                                item.call.call_status,
                              )}
                            />

                            <Info
                              label="Language"
                              value={formatStatus(
                                item.call.call_language ??
                                  "Not selected",
                              )}
                            />

                            <Info
                              label="Scheduled For"
                              value={
                                item.call.scheduled_for
                                  ? new Date(
                                      item.call.scheduled_for,
                                    ).toLocaleString()
                                  : "Not scheduled"
                              }
                            />

                            <Info
                              label="Provider Call ID"
                              value={
                                item.call.provider_call_id ||
                                "Not assigned"
                              }
                            />

                            <Info
                              label="Transcript"
                              value={
                                item.call.transcript_storage_path
                                  ? "Available"
                                  : "Not available"
                              }
                            />

                            <Info
                              label="Recording"
                              value={
                                item.call.recording_storage_path
                                  ? "Available"
                                  : "Not available"
                              }
                            />
                          </div>
                        )}
                      </ReportSection>
                    </div>
                  )}
                </article>
              );
            },
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
        <div className="flex gap-3">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-[var(--brand-primary)]"
          />

          <div>
            <p className="font-semibold">
              Human-controlled
              recruitment
            </p>

            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              AI screening
              results are
              preserved
              separately from
              recruiter
              decisions. The
              final hiring
              decision remains
              under human
              control.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[var(--brand-primary)]">
          {icon}
        </div>

        <p className="text-2xl font-semibold">
          {value}
        </p>
      </div>

      <p className="mt-3 text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>
    </div>
  );
}

function Info({
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

function ReportValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[120px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-1 text-xs font-semibold">
        {value}
      </p>
    </div>
  );
}

function SkillBlock({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold">
        {title}
      </p>

      {values.length ===
      0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          None specified
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map(
            (
              value,
              index,
            ) => (
              <span
                key={`${value}-${index}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs"
              >
                {value}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <div className="mb-7 last:mb-0">
      <h4 className="mb-4 border-b border-[var(--border)] pb-3 text-sm font-semibold">
        {title}
      </h4>

      {children}
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