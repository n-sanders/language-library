export const PRESET_TOPICS = [
  { id: "cats", label: "Cats", emoji: "🐱" },
  { id: "rockets", label: "Rockets", emoji: "🚀" },
  { id: "trees", label: "Trees", emoji: "🌳" },
  { id: "otters", label: "Otters", emoji: "🦦" },
  { id: "dinosaurs", label: "Dinosaurs", emoji: "🦖" },
  { id: "ocean", label: "The ocean", emoji: "🌊" },
  { id: "horses", label: "Horses", emoji: "🐴" },
  { id: "weather", label: "Weather", emoji: "⛈️" },
  { id: "castles", label: "Castles", emoji: "🏰" },
  { id: "bugs", label: "Bugs", emoji: "🐞" },
];

const PRESET_TOPIC_LABELS = PRESET_TOPICS.map((topic) => topic.label);

/** True when the stored topic was typed by the student rather than chosen from the preset buttons. */
export function isCustomTopic(topic: string): boolean {
  return !PRESET_TOPIC_LABELS.includes(topic);
}

export function presetTopicLabels(): readonly string[] {
  return PRESET_TOPIC_LABELS;
}

export const MAX_CUSTOM_TOPIC_LENGTH = 40;

/** Keeps custom topics short and plain so they can't smuggle instructions into prompts. */
export function sanitizeTopic(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} '\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CUSTOM_TOPIC_LENGTH);
}
