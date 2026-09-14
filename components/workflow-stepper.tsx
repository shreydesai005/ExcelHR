"use client";

import {
  BriefcaseBusiness,
  FileSearch,
  FileText,
  Phone,
  Send,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    id: 1,
    label: "JD Setup",
    icon: BriefcaseBusiness,
  },
  {
    id: 2,
    label: "Initial Screening",
    icon: FileSearch,
  },
  {
    id: 3,
    label: "CV Screening",
    icon: FileText,
  },
  {
    id: 4,
    label: "Finalisation",
    icon: UserCheck,
  },
  {
    id: 5,
    label: "WhatsApp",
    icon: Send,
  },
  {
    id: 6,
    label: "AI Calling",
    icon: Phone,
  },
  {
    id: 7,
    label: "Final Report",
    icon: ClipboardCheck,
  },
];

type WorkflowStepperProps = {
  activeStep?: number;
};

export default function WorkflowStepper({
  activeStep = 1,
}: WorkflowStepperProps) {
  return (
    <div className="card overflow-x-auto p-5">
      <div className="flex min-w-[850px] items-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const completed = step.id < activeStep;
          const active = step.id === activeStep;

          return (
            <div
              key={step.id}
              className="flex flex-1 items-center"
            >
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{
                    scale: active ? 1.06 : 1,
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                    completed || active
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--text-muted)]"
                  }`}
                >
                  <Icon size={18} />
                </motion.div>

                <span
                  className={`whitespace-nowrap text-xs font-medium ${
                    active
                      ? "text-[var(--brand-primary)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index !== steps.length - 1 && (
                <div className="mx-4 h-[2px] flex-1 bg-[var(--border)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: completed ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-[var(--brand-primary)]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}