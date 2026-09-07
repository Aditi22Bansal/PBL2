"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";
import axios from "axios";
import { questionnaireSteps, Question } from "../lib/questionnaireConfig";
import { ChevronLeft, ChevronRight, Save, Send, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QuestionnaireWizardProps {
  onSubmitSuccess: () => void;
}

// Derived from the config, not hardcoded - questionnaireSteps was split from
// 5 steps into 7 (see questionnaireConfig.ts) specifically so no single step
// shows a wall of inputs; hardcoding the old "5" here would have silently
// broken navigation instead of just looking wrong.
const REVIEW_STEP = questionnaireSteps.length + 1;
const TOTAL_STEPS = REVIEW_STEP;

export default function QuestionnaireWizard({ onSubmitSuccess }: QuestionnaireWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    consent: false,
    age: "",
    gender: "",
    year_of_study: "",
    branch: "",
    preferred_room_size: "",
    accessibility_need: "",
    sleep_time: "",
    wake_time: "",
    cleanliness: "",
    study_env: "",
    guest_frequency: "",
    smoking_habit: "",
    drinking_habit: "",
    loud_alarms: "",
    first_time_hostel: "",
    temp_preference: "",
    study_hours: "",
    active_late: "",
    conflict_style: "",
    room_org: "",
    noise_tolerance: 3,
    introversion: 3,
    irritation: 3,
    personal_space: 3,
    fixed_routines: 3,
    sharing_comfort: 3,
    pref_roommate_sleep: "",
    pref_roommate_social: "",
    cleanliness_expectation: "",
    light_preference: "",
    most_important_factor: "",
  });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  // Load draft data on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await axios.get("/api/student/profile");
        if (res.data && res.data._id) {
          setFormData((prev: any) => ({
            ...prev,
            ...res.data,
            consent: res.data.profileCompleted !== undefined ? true : false, // Auto-consent if synced or completed
            age: res.data.age ?? "",
            noise_tolerance: Number(res.data.noise_tolerance ?? 3),
            introversion: Number(res.data.introversion ?? 3),
            irritation: Number(res.data.irritation ?? 3),
            personal_space: Number(res.data.personal_space ?? 3),
            fixed_routines: Number(res.data.fixed_routines ?? 3),
            sharing_comfort: Number(res.data.sharing_comfort ?? 3),
          }));
        }
      } catch (err) {
        console.error("Failed to load student draft:", err);
      }
    }
    loadDraft();
  }, []);

  const handleChange = (id: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [id]: value }));
    // Clear validation error when user makes correction
    if (validationErrors[id]) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const validateStep = (stepIdx: number): boolean => {
    const stepDef = questionnaireSteps.find((s) => s.stepIndex === stepIdx);
    if (!stepDef) return true;

    const errors: { [key: string]: string } = {};

    stepDef.questions.forEach((q) => {
      const val = formData[q.id];
      
      // Check required
      if (q.required) {
        if (val === undefined || val === null || val === "" || val === false) {
          errors[q.id] = q.validationError || `${q.label} is required.`;
          return;
        }
      }

      // Check custom validation if configured
      if (q.validate && val !== "" && val !== undefined) {
        if (!q.validate(val)) {
          errors[q.id] = q.validationError || "Invalid input value.";
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = async () => {
    setSaveStatus("saving");
    try {
      await axios.put("/api/student/profile", formData);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps first
    let allValid = true;
    for (let i = 1; i < REVIEW_STEP; i++) {
      if (!validateStep(i)) {
        allValid = false;
        setCurrentStep(i); // Go to the first step with error
        break;
      }
    }

    if (!allValid) return;

    setSubmitStatus("submitting");
    try {
      await axios.post("/api/student/profile", formData);
      setSubmitStatus("success");
      setTimeout(() => {
        onSubmitSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      setSubmitStatus("error");
    }
  };

  // Render question field dynamically based on type
  const renderQuestionField = (q: Question) => {
    const value = formData[q.id];
    const hasError = !!validationErrors[q.id];

    switch (q.type) {
      case "checkbox":
        return (
          <label className="flex items-start gap-4 p-4 bg-stone-50 border border-stone-200 rounded-2xl cursor-pointer hover:bg-stone-100/60 transition-colors">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(q.id, e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-teal-700 focus:ring-teal-600 border-stone-300"
            />
            <span className="text-stone-700 text-sm leading-relaxed">{q.label}</span>
          </label>
        );

      case "select":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleChange(q.id, e.target.value)}
            className={`w-full bg-stone-50 border ${hasError ? 'border-red-300 focus:border-red-500' : 'border-stone-200 focus:border-teal-600'} rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none transition-all`}
          >
            <option value="" disabled>Select option...</option>
            {q.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case "radio":
        return (
          <div className="flex flex-wrap gap-4">
            {q.options?.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleChange(q.id, opt)}
                className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  value === opt
                    ? "bg-teal-700 border-teal-700 text-white shadow-sm shadow-teal-900/15"
                    : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case "slider":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">Strongly Disagree</span>
              <span className="text-2xl font-black text-teal-700">{value}</span>
              <span className="text-xs text-stone-600 font-bold uppercase tracking-wider">Strongly Agree</span>
            </div>
            <input
              type="range"
              min={q.min || 1}
              max={q.max || 5}
              step={q.step || 1}
              value={value || 3}
              onChange={(e) => handleChange(q.id, parseInt(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-teal-700"
            />
          </div>
        );

      case "number":
      case "text":
      default:
        return (
          <input
            type={q.type}
            placeholder={q.placeholder}
            value={value || ""}
            onChange={(e) => handleChange(q.id, e.target.value)}
            className={`w-full bg-stone-50 border ${hasError ? 'border-red-300 focus:border-red-500' : 'border-stone-200 focus:border-teal-600'} rounded-xl px-4 py-3.5 text-sm text-stone-800 focus:outline-none transition-all placeholder:text-stone-600`}
          />
        );
    }
  };

  // Render the final review-and-submit step
  const renderReviewStep = () => {
    return (
      <div className="space-y-8">
        <div className="bg-teal-50 border border-teal-200 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-teal-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Please review your responses
          </h3>
          <p className="text-teal-800 text-sm leading-relaxed">
            Ensure all answers are accurate before submitting. Once submitted, your profile will be frozen for matching. You can click any card&apos;s title to edit that section.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questionnaireSteps.map((step) => (
            <div
              key={step.stepIndex}
              onClick={() => setCurrentStep(step.stepIndex)}
              className="glass-card rounded-[2rem] p-6 hover:border-teal-300 transition-all cursor-pointer group relative"
            >
              <div className="absolute top-4 right-4 text-xs font-bold text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Edit Section →
              </div>
              <h4 className="font-bold text-stone-800 mb-4 border-b border-stone-200 pb-2">
                Step {step.stepIndex}: {step.title}
              </h4>
              <div className="space-y-2">
                {step.questions.map((q) => (
                  <div key={q.id} className="flex justify-between items-start gap-4 text-xs">
                    <span className="text-stone-600 font-medium">{q.label.split(" (")[0]}</span>
                    <span className="text-stone-800 font-bold text-right shrink-0">
                      {q.id === "consent" ? "Consented" : String(formData[q.id] || "Not answered")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const currentStepDef = questionnaireSteps.find((s) => s.stepIndex === currentStep);
  const isReview = currentStep === REVIEW_STEP;

  return (
    <div className="w-full space-y-8 max-w-4xl mx-auto">
      {/* Top Wizard Indicator */}
      <div className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-widest">
              Step {currentStep} of {TOTAL_STEPS}
            </p>
            <h2 className="font-bold text-stone-800 text-lg mt-0.5">
              {isReview ? "Submit & Finalize" : currentStepDef?.title}
            </h2>
            <p className="text-stone-600 text-xs mt-0.5">
              {isReview ? "Verify all details and submit your application." : currentStepDef?.description}
            </p>
          </div>
        </div>

        {/* Segmented step indicator - reads clearly at 7 steps without the
            wall-of-numbers a full numbered stepper would need at this count. */}
        <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step <= currentStep ? "bg-teal-600" : "bg-stone-200"}`}
            />
          ))}
        </div>
      </div>

      {/* Main Form Content */}
      <div className="glass-card rounded-[2.5rem] p-8 md:p-12 min-h-[400px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-8 flex-1"
          >
            {isReview ? (
              renderReviewStep()
            ) : (
              <div className="space-y-6">
                {currentStepDef?.questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <label className="block text-sm font-bold text-stone-700 ml-1">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      {renderQuestionField(q)}
                      {validationErrors[q.id] && (
                        <div className="text-red-600 text-xs font-semibold mt-1.5 flex items-center gap-1 ml-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{validationErrors[q.id]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-stone-200 pt-8 mt-12 gap-4">
          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="px-5 py-3 border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {!isReview && (
              <button
                onClick={handleNext}
                className="px-5 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-md shadow-teal-900/15"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {isReview && (
              <button
                onClick={handleSubmit}
                disabled={submitStatus === "submitting" || submitStatus === "success"}
                className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-md shadow-teal-900/15 disabled:opacity-50"
              >
                {submitStatus === "submitting" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : submitStatus === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{submitStatus === "submitting" ? "Submitting..." : submitStatus === "success" ? "Submitted!" : "Submit Profile"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === "saved" && (
              <span className="text-emerald-700 text-xs font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" /> Draft Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-700 text-xs font-bold flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5" /> Save Failed
              </span>
            )}

            <button
              onClick={handleSaveDraft}
              disabled={saveStatus === "saving"}
              className="px-5 py-3 border border-stone-300 hover:bg-stone-50 text-stone-600 font-semibold rounded-xl text-sm transition-all flex items-center gap-2"
              title="Save draft and resume later"
            >
              <Save className="w-4 h-4" />
              <span>{saveStatus === "saving" ? "Saving..." : "Save Draft"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
