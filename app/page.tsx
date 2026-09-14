"use client";

import { useState } from "react";

import AppHeader from "@/components/app-header";
import RecruitmentDashboard from "@/components/recruitment-dashboard";
import WorkflowStepper from "@/components/workflow-stepper";
import JDSetup from "@/components/jd-setup";
import InitialScreening from "@/components/initial-screening";
import CVScreening from "@/components/cv-screening";
import CandidateFinalisation from "@/components/candidate-finalisation";
import WhatsAppOutreach from "@/components/whatsapp-outreach";
import AICalling from "@/components/ai-calling";
import FinalReport from "@/components/final-report";

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

  function startNewRecruitment() {
    setCurrentJobId(null);
    setActiveStep(1);
    setView("recruitment");
  }

  function goToDashboard() {
    setView("dashboard");
    setActiveStep(1);
    setCurrentJobId(null);
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        onNewRecruitment={
          startNewRecruitment
        }
        onLogoClick={
          goToDashboard
        }
      />

      <main className="mx-auto max-w-[1600px] space-y-8 px-6 py-8 lg:px-10 lg:py-10">
        {view ===
          "dashboard" && (
          <RecruitmentDashboard
            onCreateRecruitment={
              startNewRecruitment
            }
          />
        )}

        {view ===
          "recruitment" && (
          <>
            <WorkflowStepper
              activeStep={
                activeStep
              }
            />

            {activeStep ===
              1 && (
              <JDSetup
                jobId={
                  currentJobId
                }
                onJobSaved={(
                  jobId,
                ) => {
                  setCurrentJobId(
                    jobId,
                  );
                }}
                onContinue={(
                  jobId,
                ) => {
                  setCurrentJobId(
                    jobId,
                  );
                  setActiveStep(
                    2,
                  );
                }}
              />
            )}

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

            {activeStep ===
              3 &&
              currentJobId && (
                <CVScreening
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    setActiveStep(
                      4,
                    );
                  }}
                />
              )}

            {activeStep ===
              4 &&
              currentJobId && (
                <CandidateFinalisation
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    setActiveStep(
                      5,
                    );
                  }}
                />
              )}

            {activeStep ===
              5 &&
              currentJobId && (
                <WhatsAppOutreach
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    setActiveStep(
                      6,
                    );
                  }}
                />
              )}

            {activeStep ===
              6 &&
              currentJobId && (
                <AICalling
                  jobId={
                    currentJobId
                  }
                  onContinue={() => {
                    setActiveStep(
                      7,
                    );
                  }}
                />
              )}

            {activeStep ===
              7 &&
              currentJobId && (
                <FinalReport
                  jobId={
                    currentJobId
                  }
                />
              )}
          </>
        )}
      </main>
    </div>
  );
}