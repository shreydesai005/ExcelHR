"use client";

import { useState } from "react";

import AppHeader from "@/components/app-header";
import RecruitmentDashboard from "@/components/recruitment-dashboard";
import WorkflowStepper from "@/components/workflow-stepper";
import JDSetup from "@/components/jd-setup";
import InitialScreening from "@/components/initial-screening";
import CVScreening from "@/components/cv-screening";
import CandidateFinalisation from "@/components/candidate-finalisation";

type View =
  | "dashboard"
  | "recruitment";

export default function Home() {
  const [
    view,
    setView,
  ] = useState<View>(
    "dashboard",
  );

  const [
    activeStep,
    setActiveStep,
  ] = useState(1);

  const [
    currentJobId,
    setCurrentJobId,
  ] = useState<
    string | null
  >(null);

  /*
   * =========================================
   * Start a completely new recruitment
   * =========================================
   */

  function startNewRecruitment() {
    setCurrentJobId(null);
    setActiveStep(1);
    setView("recruitment");
  }

  /*
   * =========================================
   * Return to dashboard
   * =========================================
   */

  function goToDashboard() {
    setView("dashboard");
    setActiveStep(1);
    setCurrentJobId(null);
  }

  return (
    <div className="min-h-screen">
      {/* =====================================
          GLOBAL HEADER
      ====================================== */}

      <AppHeader
        onNewRecruitment={
          startNewRecruitment
        }
        onLogoClick={
          goToDashboard
        }
      />

      {/* =====================================
          MAIN PAGE
      ====================================== */}

      <main className="mx-auto max-w-[1600px] space-y-8 px-6 py-8 lg:px-10 lg:py-10">

        {/* ===================================
            DASHBOARD
        ==================================== */}

        {view ===
          "dashboard" && (
          <RecruitmentDashboard
            onCreateRecruitment={
              startNewRecruitment
            }
          />
        )}

        {/* ===================================
            RECRUITMENT WORKFLOW
        ==================================== */}

        {view ===
          "recruitment" && (
          <>
            {/* ---------------------------------
                WORKFLOW STEPPER
            ---------------------------------- */}

            <WorkflowStepper
              activeStep={
                activeStep
              }
            />

            {/* =================================
                STAGE 1
                JD SETUP
            ================================== */}

            {activeStep ===
              1 && (
              <JDSetup
                jobId={
                  currentJobId
                }
                onJobSaved={(
                  jobId,
                ) => {
                  /*
                   * When draft/save
                   * creates a job,
                   * retain its real
                   * database UUID.
                   */

                  setCurrentJobId(
                    jobId,
                  );
                }}
                onContinue={(
                  jobId,
                ) => {
                  /*
                   * Continue from
                   * JD Setup to
                   * Initial Screening.
                   */

                  setCurrentJobId(
                    jobId,
                  );

                  setActiveStep(
                    2,
                  );
                }}
              />
            )}

            {/* =================================
                STAGE 2
                INITIAL SCREENING
            ================================== */}

            {activeStep ===
              2 &&
              currentJobId && (
                <InitialScreening
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    setActiveStep(
                      3,
                    );
                  }}
                />
              )}

            {/* =================================
                STAGE 3
                CV SCREENING
            ================================== */}

            {activeStep ===
              3 &&
              currentJobId && (
                <CVScreening
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    /*
                     * Recruiter has
                     * completed CV
                     * screening and
                     * can now review
                     * final decisions.
                     */

                    setActiveStep(
                      4,
                    );
                  }}
                />
              )}

            {/* =================================
                STAGE 4
                CANDIDATE FINALISATION
            ================================== */}

            {activeStep ===
              4 &&
              currentJobId && (
                <CandidateFinalisation
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    /*
                     * Approved candidates
                     * can now move into
                     * outreach.
                     */

                    setActiveStep(
                      5,
                    );
                  }}
                />
              )}

            {/* =================================
                STAGE 5
                WHATSAPP OUTREACH
                PLACEHOLDER FOR NOW
            ================================== */}

            {activeStep ===
              5 &&
              currentJobId && (
                <section className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Stage 5
                    </p>

                    <h1 className="text-3xl font-semibold tracking-tight">
                      WhatsApp
                      Outreach
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                      Candidates approved
                      during finalisation
                      will appear here for
                      recruiter-controlled
                      WhatsApp outreach.
                    </p>
                  </div>

                  <div className="card p-8">
                    <div className="max-w-2xl">
                      <h2 className="text-lg font-semibold">
                        Yeti Integration
                        Not Connected Yet
                      </h2>

                      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                        We will connect the
                        real Yeti WhatsApp
                        provider in the next
                        stage. Until valid
                        provider credentials
                        are configured, this
                        application will not
                        simulate message
                        delivery or display
                        fake successful
                        sends.
                      </p>

                      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                        <p className="text-sm font-semibold">
                          Candidates eligible
                          for outreach
                        </p>

                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          Only candidates
                          with:
                        </p>

                        <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                          <p>
                            • Recruiter
                            decision =
                            Approved
                          </p>

                          <p>
                            • Final workflow
                            decision =
                            Proceed
                          </p>

                          <p>
                            • Verified phone
                            number
                          </p>

                          <p>
                            • WhatsApp consent
                            confirmed
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

            {/* =================================
                STAGE 6
                AI CALLING
                FUTURE PLACEHOLDER
            ================================== */}

            {activeStep ===
              6 &&
              currentJobId && (
                <section className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Stage 6
                    </p>

                    <h1 className="text-3xl font-semibold">
                      AI Calling
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                      AI calling will be
                      connected after the
                      WhatsApp outreach
                      workflow is complete.
                    </p>
                  </div>

                  <div className="card p-8">
                    <p className="text-sm text-[var(--text-secondary)]">
                      No calling provider
                      is connected yet.
                    </p>
                  </div>
                </section>
              )}

            {/* =================================
                STAGE 7
                FINAL REPORT
                FUTURE PLACEHOLDER
            ================================== */}

            {activeStep ===
              7 &&
              currentJobId && (
                <section className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Stage 7
                    </p>

                    <h1 className="text-3xl font-semibold">
                      Final Report
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                      The final recruitment
                      report will consolidate
                      screening results,
                      recruiter decisions,
                      outreach events and
                      calling outcomes.
                    </p>
                  </div>

                  <div className="card p-8">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Reporting will be
                      connected after
                      outreach and calling
                      workflows are
                      implemented.
                    </p>
                  </div>
                </section>
              )}
          </>
        )}
      </main>
    </div>
  );
}