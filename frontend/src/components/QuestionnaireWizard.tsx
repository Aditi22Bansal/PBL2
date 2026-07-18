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

export default function QuestionnaireWizard({ onSubmitSuccess }: QuestionnaireWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    consent: false,
    age: "",
    gender: "",
    year_of_study: "",
    branch: "",
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
      setCurrentStep((prev) => Math.min(prev + 1, 5));
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
    for (let i = 1; i <= 4; i++) {
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
          <label className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-colors">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(q.id, e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="text-slate-600 text-sm leading-relaxed">{q.label}</span>
          </label>
        );

      case "select":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleChange(q.id, e.target.value)}
            className={`w-full bg-slate-50 border ${hasError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'} rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none transition-all`}
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
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-100"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
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
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Strongly Disagree</span>
              <span className="text-2xl font-black text-blue-600">{value}</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Strongly Agree</span>
            </div>
            <input
              type="range"
              min={q.min || 1}
              max={q.max || 5}
              step={q.step || 1}
              value={value || 3}
              onChange={(e) => handleChange(q.id, parseInt(e.target.value))}
              className="w-full h-2 bg-slate-150 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
            className={`w-full bg-slate-50 border ${hasError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'} rounded-xl px-4 py-3.5 text-sm text-slate-800 focus:outline-none transition-all placeholder:text-slate-400`}
          />
        );
    }
  };

  // Render Step 5 (Review and Submit)
  const renderReviewStep = () => {
    return (
      <div className="space-y-8">
        <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Please review your responses
          </h3>
          <p className="text-blue-700 text-sm leading-relaxed">
            Ensure all answers are accurate before submitting. Once submitted, your profile will be frozen for matching. You can click any card&apos;s title to edit that section.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questionnaireSteps.map((step) => (
            <div
              key={step.stepIndex}
              onClick={() => setCurrentStep(step.stepIndex)}
              className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:border-blue-300 transition-all cursor-pointer group relative"
            >
              <div className="absolute top-4 right-4 text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Edit Section →
              </div>
              <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                Step {step.stepIndex}: {step.title}
              </h4>
              <div className="space-y-2">
                {step.questions.map((q) => (
                  <div key={q.id} className="flex justify-between items-start gap-4 text-xs">
                    <span className="text-slate-500 font-medium">{q.label.split(" (")[0]}</span>
                    <span className="text-slate-800 font-bold text-right shrink-0">
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

  const progressPct = ((currentStep - 1) / 4) * 100;
  const currentStepDef = questionnaireSteps.find((s) => s.stepIndex === currentStep);

  return (
    <div className="w-full space-y-8 max-w-4xl mx-auto">
      {/* Top Wizard Indicator */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center font-black text-blue-600 text-lg">
            {currentStep}/5
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">
              {currentStep === 5 ? "Submit & Finalize" : currentStepDef?.title}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {currentStep === 5 ? "Verify all details and submit your application." : currentStepDef?.description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex-1 max-w-[200px] md:max-w-[300px]">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span>Overall Progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-250/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              className="bg-blue-600 h-full rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-sm min-h-[400px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-8 flex-1"
          >
            {currentStep === 5 ? (
              renderReviewStep()
            ) : (
              <div className="space-y-6">
                {currentStepDef?.questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700 ml-1">
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
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-8 mt-12 gap-4">
          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            
            {currentStep < 5 && (
              <button
                onClick={handleNext}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-md shadow-blue-150"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                onClick={handleSubmit}
                disabled={submitStatus === "submitting" || submitStatus === "success"}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-md shadow-blue-150 disabled:opacity-50"
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
              <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-250/20 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" /> Draft Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-600 text-xs font-bold flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5" /> Save Failed
              </span>
            )}

            <button
              onClick={handleSaveDraft}
              disabled={saveStatus === "saving"}
              className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold rounded-xl text-sm transition-all flex items-center gap-2"
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
