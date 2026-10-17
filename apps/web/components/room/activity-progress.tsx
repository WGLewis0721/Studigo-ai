/** Position within this activity is separate from saved mastery or a grade. */
export function ActivityProgress({ current, total, label, completed = current - 1 }: {
  current: number; total: number; label: string; completed?: number;
}) {
  return <div className="quizProgress activityProgress">
    <span className="tinyLabel" role="status">{label} {current} of {total}</span>
    <div className="quizBar" role="progressbar" aria-label={`${label} completed`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
      <i style={{ width: `${total ? completed / total * 100 : 0}%` }} />
    </div>
  </div>;
}
