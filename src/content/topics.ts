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

export const MAX_CUSTOM_TOPIC_LENGTH = 40;

/** Keeps custom topics short and plain so they can't smuggle instructions into prompts. */
export function sanitizeTopic(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} '\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CUSTOM_TOPIC_LENGTH);
}
