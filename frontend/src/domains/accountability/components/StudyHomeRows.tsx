import { CalendarClock, ChartLine, Flame } from "lucide-react";

import { HomeRow } from "@/domains/students/components/HomeRow";

import { StudyFormat as F } from "../services/StudyFormat";
import { StreakEngine } from "../services/StreakEngine";
import type { StudentProgress } from "../services/StudyProgress";

/** The loop on the portal's Home, in At a glance. Null progress: no goal yet. */
export function StudyHomeRows({ progress }: { progress: StudentProgress | null }) {
  if (!progress) return <HomeRow tab="plan" icon={ChartLine} urgent title="Set your study goal" />;
  const { goal, plan, onTrack, streak } = progress;
  const band = onTrack && F.BAND[onTrack.band];
  const { earnBack } = streak;
  const milestone = StreakEngine.nextMilestone(streak.current);
  return (
    <>
      <HomeRow
        tab="plan"
        icon={ChartLine}
        urgent={onTrack !== null && onTrack.band !== "on_track"}
        title={band ? <span className={band.tone}>{band.label}</span> : "On-Track score"}
        detail={`${F.hours(plan.hoursDone)} of ${goal.targetHours} h`}
        value={onTrack ? <span className={`text-3xl font-bold ${band?.tone}`}>{onTrack.score}</span> : "New"}
      />
      {plan.perDay !== null && (
        <HomeRow
          tab="plan"
          icon={CalendarClock}
          urgent={plan.overCapacity}
          title={plan.restDay ? "Rest day" : plan.todayHours > 0 ? `${F.toDo(plan.todayHours)} left today` : "Done for today"}
          detail={`${F.hours(plan.perDay)} a study day`}
        />
      )}
      <HomeRow
        tab="plan"
        icon={Flame}
        urgent={earnBack !== null}
        title={earnBack ? `Earn Back ${streak.current}-day streak` : `${streak.current}-day streak`}
        detail={
          earnBack ? (
            // Wraps rather than truncates: the deadline is the point.
            <span className="block whitespace-normal">{`${earnBack.questionsLeft} questions or ${earnBack.minutesLeft} min by ${F.weekday(earnBack.until)}`}</span>
          ) : streak.perfect
              ? "Perfect streak"
              : milestone
                ? `Next milestone: ${milestone} days`
                : `Best: ${streak.best} days`
        }
      />
    </>
  );
}
