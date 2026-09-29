import { GRADE_LEVELS, gradeLabel } from "@/lib/grade";

export function GradeSelect({ defaultValue = 3 }: { defaultValue?: number }) {
  return (
    <select name="gradeLevel" defaultValue={defaultValue} className="input">
      {GRADE_LEVELS.map((g) => (
        <option key={g} value={g}>
          {gradeLabel(g)}
        </option>
      ))}
    </select>
  );
}
