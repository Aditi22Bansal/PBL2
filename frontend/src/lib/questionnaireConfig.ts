/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Question {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "radio" | "slider" | "checkbox";
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  validationError?: string;
  validate?: (value: any) => boolean;
}

export interface QuestionnaireStep {
  stepIndex: number;
  title: string;
  description: string;
  questions: Question[];
}

export const questionnaireSteps: QuestionnaireStep[] = [
  {
    stepIndex: 1,
    title: "Personal Information",
    description: "Please provide your basic information to get started.",
    questions: [
      {
        id: "consent",
        label: "Consent to Data Usage",
        type: "checkbox",
        required: true,
        validationError: "You must consent to proceed.",
        validate: (v: any) => v === true || v === "true" || v === "Yes"
      },
      {
        id: "age",
        label: "Age (Years)",
        type: "number",
        placeholder: "e.g. 18",
        min: 16,
        max: 35,
        required: true,
        validationError: "Age must be between 16 and 35.",
        validate: (v: any) => {
          const num = Number(v);
          return !isNaN(num) && num >= 16 && num <= 35;
        }
      },
      {
        id: "gender",
        label: "Gender",
        type: "select",
        options: ["Male", "Female"],
        required: true,
        validationError: "Gender is required."
      },
      {
        id: "year_of_study",
        label: "Year of Study",
        type: "select",
        options: ["1", "2", "3", "4"],
        required: true,
        validationError: "Year of study is required."
      },
      {
        id: "branch",
        label: "Branch of Study",
        type: "select",
        options: ["CSE", "AIML", "RNA", "MECHANICAL", "ENTC", "CIVIL"],
        required: true,
        validationError: "Branch of study is required."
      },
      {
        id: "preferred_room_size",
        label: "Preferred Room Size",
        type: "select",
        options: ["2", "3", "4", "No preference"],
        required: true,
        validationError: "Please select a preferred room size (or No preference)."
      }
    ]
  },
  {
    stepIndex: 2,
    title: "Lifestyle & Daily Routine",
    description: "Help us understand your day-to-day habits in the hostel.",
    questions: [
      {
        id: "sleep_time",
        label: "Usual Sleeping Time",
        type: "select",
        options: ["Before 10 pm", "10 pm to 12 am", "12 am to 2 am", "After 2 am"],
        required: true,
        validationError: "Please select your usual sleeping time."
      },
      {
        id: "wake_time",
        label: "Usual Wake-up Time",
        type: "select",
        options: ["Before 6 am", "6-8 am", "8-10 am", "After 10 am"],
        required: true,
        validationError: "Please select your usual wake-up time."
      },
      {
        id: "cleanliness",
        label: "How clean do you keep your room?",
        type: "select",
        options: ["Messy", "Average", "Moderately Clean", "Very Clean"],
        required: true,
        validationError: "Please select your cleanliness level."
      },
      {
        id: "study_env",
        label: "Preferred Study Environment",
        type: "select",
        options: ["Complete Silence", "Light Background Noise", "Music While Studying", "Does not matter"],
        required: true,
        validationError: "Please select your study environment preference."
      },
      {
        id: "guest_frequency",
        label: "How frequently do you expect guests/friends in the room?",
        type: "select",
        options: ["No", "Rarely", "Occasionally", "Weekly", "Frequently"],
        required: true,
        validationError: "Please select guest frequency."
      },
      {
        id: "smoking_habit",
        label: "Do you smoke?",
        type: "radio",
        options: ["No", "Occasionally", "Yes"],
        required: true,
        validationError: "Please select smoking habit."
      },
      {
        id: "drinking_habit",
        label: "Do you drink alcohol?",
        type: "radio",
        options: ["No", "Occasionally", "Yes"],
        required: true,
        validationError: "Please select drinking habit."
      },
      {
        id: "loud_alarms",
        label: "Do you use loud alarms in the morning?",
        type: "radio",
        options: ["No", "Occasionally", "Yes"],
        required: true,
        validationError: "Please select alarm preference."
      },
      {
        id: "first_time_hostel",
        label: "Is this your first time living in a hostel?",
        type: "radio",
        options: ["No", "Yes"],
        required: true,
        validationError: "Please select this option."
      },
      {
        id: "temp_preference",
        label: "Room Temperature Preference",
        type: "select",
        options: ["Cold", "Moderate", "Warm"],
        required: true,
        validationError: "Please select temperature preference."
      },
      {
        id: "study_hours",
        label: "Study hours per day",
        type: "select",
        options: ["0-2", "2-4", "4-6", "6+"],
        required: true,
        validationError: "Please select study hours."
      },
      {
        id: "active_late",
        label: "Are you active late at night (calls, laptop, etc.)?",
        type: "radio",
        options: ["No", "Rarely", "Yes"],
        required: true,
        validationError: "Please select late night activity status."
      },
      {
        id: "conflict_style",
        label: "When conflicts arise, how do you usually resolve them?",
        type: "select",
        options: [
          "Avoid confrontation",
          "Get irritated but stay silent",
          "Seek third-person help",
          "Talk directly and resolve"
        ],
        required: true,
        validationError: "Please select conflict resolution style."
      },
      {
        id: "room_org",
        label: "Room Organization Style",
        type: "select",
        options: ["Random", "Flexible", "Semi Organized", "Highly Organized"],
        required: true,
        validationError: "Please select room organization style."
      }
    ]
  },
  {
    stepIndex: 3,
    title: "Personality Traits",
    description: "Rate yourself on the following behavioral scales (1 = Strongly Disagree/Low, 5 = Strongly Agree/High).",
    questions: [
      {
        id: "noise_tolerance",
        label: "Noise Tolerance (How well can you tolerate background noise?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      },
      {
        id: "introversion",
        label: "Introversion (How introverted are you?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      },
      {
        id: "irritation",
        label: "Irritability (Do you get irritated easily?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      },
      {
        id: "personal_space",
        label: "Respect for Personal Space (How highly do you value/respect boundaries?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      },
      {
        id: "fixed_routines",
        label: "Preference for Routines (Do you stick strictly to fixed routines?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      },
      {
        id: "sharing_comfort",
        label: "Comfort Sharing Belongings (Are you comfortable sharing things?)",
        type: "slider",
        min: 1,
        max: 5,
        step: 1,
        required: true
      }
    ]
  },
  {
    stepIndex: 4,
    title: "Preferred Roommate",
    description: "What are you looking for in an ideal roommate?",
    questions: [
      {
        id: "pref_roommate_sleep",
        label: "Preferred roommate sleep type",
        type: "select",
        options: ["Does not matter", "Early Sleeper", "Late Sleeper"],
        required: true,
        validationError: "Please select preferred roommate sleep style."
      },
      {
        id: "pref_roommate_social",
        label: "Preferred roommate interaction level",
        type: "select",
        options: [
          "Be moderately social",
          "Be very interactive",
          "Minimal interaction",
          "Respect space mostly"
        ],
        required: true,
        validationError: "Please select roommate social interaction level."
      },
      {
        id: "cleanliness_expectation",
        label: "Cleanliness expectation from roommates",
        type: "select",
        options: ["Does not matter", "Moderate", "Very Clean"],
        required: true,
        validationError: "Please select cleanliness expectation."
      },
      {
        id: "light_preference",
        label: "Night light preference",
        type: "select",
        options: ["Dim light is fine", "Doesn't matter", "Yes , complete darkness"],
        required: true,
        validationError: "Please select night light preference."
      },
      {
        id: "most_important_factor",
        label: "Most important roommate selection factor",
        type: "select",
        options: [
          "Cleanliness",
          "Lifestyle Habits ( Smoking, Drinking, Guests, etc.)",
          "Personality",
          "Sleep Schedule",
          "Study habits"
        ],
        required: true,
        validationError: "Please select the most important factor."
      }
    ]
  }
];
