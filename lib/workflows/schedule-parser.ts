type EveryInterval = {
  value: number;
  unit: "minutes" | "hours" | "days" | "weeks";
  cronEquivalent: string;
};

type CronValidation = {
  valid: boolean;
  description?: string;
  nextRun?: Date;
  error?: string;
};

type CronFieldConfig = {
  min: number;
  max: number;
  normalize?: (value: number) => number;
};

type CronParts = {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
};

type ParsedCronField =
  | {
      valid: true;
      values: Set<number>;
    }
  | {
      valid: false;
      error: string;
    };

type ParsedCronExpression =
  | {
      valid: true;
      parts: CronParts;
    }
  | {
      valid: false;
      error: string;
    };

type WorkflowLike = {
  trigger: string;
  scheduleMode?: string | null;
  frequency?: string | null;
  cronExpression?: string | null;
  timezone?: string | null;
  enabled?: boolean | null;
  lastRunAt?: Date | string | null;
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

const MONTH_LABELS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

function expandRange(start: number, end: number, step = 1) {
  const values: number[] = [];

  for (let value = start; value <= end; value += step) {
    values.push(value);
  }

  return values;
}

function normalizeEveryExpression(expression: string) {
  return expression.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatTime(hour: number, minute: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

function parseCronField(
  field: string,
  { min, max, normalize }: CronFieldConfig
): ParsedCronField {
  const values = new Set<number>();
  const normalizedField = field.trim();

  if (!normalizedField) {
    return {
      valid: false,
      error: "Empty cron field."
    };
  }

  const parts = normalizedField.split(",");

  for (const part of parts) {
    if (part === "*") {
      expandRange(min, max).forEach((value) => values.add(value));
      continue;
    }

    const [rangePart, stepPart] = part.split("/");
    const step =
      stepPart === undefined ? 1 : Number.parseInt(stepPart, 10);

    if (!Number.isInteger(step) || step < 1) {
      return {
        valid: false,
        error: `Invalid step value "${stepPart}".`
      };
    }

    if (rangePart === "*") {
      expandRange(min, max, step).forEach((value) => values.add(value));
      continue;
    }

    if (rangePart.includes("-")) {
      const [startRaw, endRaw] = rangePart.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
        return {
          valid: false,
          error: `Invalid range "${rangePart}".`
        };
      }

      expandRange(start, end, step).forEach((value) => {
        const normalizedValue = normalize ? normalize(value) : value;
        values.add(normalizedValue);
      });
      continue;
    }

    const single = Number.parseInt(rangePart, 10);
    if (!Number.isInteger(single)) {
      return {
        valid: false,
        error: `Invalid value "${rangePart}".`
      };
    }

    const normalizedValue = normalize ? normalize(single) : single;
    values.add(normalizedValue);
  }

  for (const value of values) {
    if (value < min || value > max) {
      return {
        valid: false,
        error: `Value "${value}" is outside the allowed range ${min}-${max}.`
      };
    }
  }

  return {
    valid: true,
    values
  };
}

function parseCronExpressionInternal(cron: string): ParsedCronExpression {
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    return {
      valid: false,
      error: "Cron expressions must have exactly 5 fields."
    };
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] =
    parts;

  const minute = parseCronField(minuteField, { min: 0, max: 59 });
  if (!minute.valid) {
    return minute;
  }

  const hour = parseCronField(hourField, { min: 0, max: 23 });
  if (!hour.valid) {
    return hour;
  }

  const dayOfMonth = parseCronField(dayOfMonthField, {
    min: 1,
    max: 31
  });
  if (!dayOfMonth.valid) {
    return dayOfMonth;
  }

  const month = parseCronField(monthField, {
    min: 1,
    max: 12
  });
  if (!month.valid) {
    return month;
  }

  const dayOfWeek = parseCronField(dayOfWeekField, {
    min: 0,
    max: 6,
    normalize: (value) => (value === 7 ? 0 : value)
  });
  if (!dayOfWeek.valid) {
    return dayOfWeek;
  }

  return {
    valid: true,
    parts: {
      minute: minute.values,
      hour: hour.values,
      dayOfMonth: dayOfMonth.values,
      month: month.values,
      dayOfWeek: dayOfWeek.values
    } satisfies CronParts
  };
}

function getNextCronRun(cron: string, from = new Date()) {
  const parsed = parseCronExpressionInternal(cron);

  if (!parsed.valid) {
    return null;
  }

  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const maxIterations = 60 * 24 * 370;

  for (let index = 0; index < maxIterations; index += 1) {
    if (
      parsed.parts.minute.has(cursor.getMinutes()) &&
      parsed.parts.hour.has(cursor.getHours()) &&
      parsed.parts.dayOfMonth.has(cursor.getDate()) &&
      parsed.parts.month.has(cursor.getMonth() + 1) &&
      parsed.parts.dayOfWeek.has(cursor.getDay())
    ) {
      return new Date(cursor);
    }

    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return null;
}

export function getNextCronRuns(
  cron: string,
  count = 3,
  from = new Date()
) {
  const runs: Date[] = [];
  let cursor = new Date(from);

  for (let index = 0; index < count; index += 1) {
    const next = getNextCronRun(cron, cursor);

    if (!next) {
      break;
    }

    runs.push(next);
    cursor = new Date(next);
  }

  return runs;
}

function describeCron(cron: string, parts: CronParts) {
  const raw = cron.trim();

  if (raw === "* * * * *") {
    return "Every minute";
  }

  if (raw === "0 * * * *") {
    return "Every hour";
  }

  const minuteValues = [...parts.minute];
  const hourValues = [...parts.hour];
  const dayOfMonthValues = [...parts.dayOfMonth];
  const monthValues = [...parts.month];
  const dayOfWeekValues = [...parts.dayOfWeek];

  const singleMinute = minuteValues.length === 1 ? minuteValues[0] : null;
  const singleHour = hourValues.length === 1 ? hourValues[0] : null;
  const singleDayOfMonth =
    dayOfMonthValues.length === 1 ? dayOfMonthValues[0] : null;
  const singleMonth = monthValues.length === 1 ? monthValues[0] : null;
  const singleDayOfWeek =
    dayOfWeekValues.length === 1 ? dayOfWeekValues[0] : null;

  if (
    singleMinute !== null &&
    singleHour !== null &&
    dayOfMonthValues.length === 31 &&
    monthValues.length === 12 &&
    dayOfWeekValues.length === 7
  ) {
    return `Every day at ${formatTime(singleHour, singleMinute)}`;
  }

  if (
    singleMinute !== null &&
    singleHour !== null &&
    dayOfMonthValues.length === 31 &&
    monthValues.length === 12 &&
    raw.endsWith("1-5")
  ) {
    return `Every weekday at ${formatTime(singleHour, singleMinute)}`;
  }

  if (
    singleMinute !== null &&
    singleHour !== null &&
    dayOfMonthValues.length === 31 &&
    monthValues.length === 12 &&
    singleDayOfWeek !== null
  ) {
    return `Every ${WEEKDAY_LABELS[singleDayOfWeek]} at ${formatTime(
      singleHour,
      singleMinute
    )}`;
  }

  if (
    singleMinute !== null &&
    singleHour !== null &&
    singleDayOfMonth !== null &&
    monthValues.length === 12 &&
    dayOfWeekValues.length === 7
  ) {
    return `Day ${singleDayOfMonth} of every month at ${formatTime(
      singleHour,
      singleMinute
    )}`;
  }

  if (
    singleMinute !== null &&
    singleHour !== null &&
    singleDayOfMonth !== null &&
    singleMonth !== null &&
    dayOfWeekValues.length === 7
  ) {
    return `${MONTH_LABELS[singleMonth]} ${singleDayOfMonth} at ${formatTime(
      singleHour,
      singleMinute
    )}`;
  }

  return "Custom cron schedule";
}

export function parseEveryInterval(expression: string): EveryInterval | null {
  const normalized = normalizeEveryExpression(expression);

  // Plain-word aliases used widely across business-templates.ts
  // ("daily", "weekly", "monthly", "quarterly", "yearly"). Without these,
  // every starterWorkflow that pins a plain-word frequency would fall
  // through and return null, leaving nextRunAt unset and the workflow
  // never firing on its schedule.
  if (normalized === "daily") {
    return {
      value: 1,
      unit: "days",
      cronEquivalent: "0 0 * * *"
    };
  }

  if (normalized === "weekly") {
    return {
      value: 1,
      unit: "weeks",
      cronEquivalent: "0 0 * * 0"
    };
  }

  if (normalized === "monthly") {
    // 1st of every month at 00:00 — daysOfMonth fixed, dayOfWeek wildcard
    return {
      value: 30,
      unit: "days",
      cronEquivalent: "0 0 1 * *"
    };
  }

  if (normalized === "quarterly") {
    // 1st of every 3rd month at 00:00
    return {
      value: 91,
      unit: "days",
      cronEquivalent: "0 0 1 */3 *"
    };
  }

  if (normalized === "yearly" || normalized === "annually") {
    // Jan 1 at 00:00
    return {
      value: 365,
      unit: "days",
      cronEquivalent: "0 0 1 1 *"
    };
  }

  if (!normalized.startsWith("every ")) {
    return null;
  }

  if (normalized === "every day") {
    return {
      value: 1,
      unit: "days",
      cronEquivalent: "0 0 * * *"
    };
  }

  if (normalized === "every week") {
    return {
      value: 1,
      unit: "weeks",
      cronEquivalent: "0 0 * * 0"
    };
  }

  const weekdayKey = normalized.replace("every ", "");
  if (weekdayKey in WEEKDAY_MAP) {
    return {
      value: 1,
      unit: "weeks",
      cronEquivalent: `0 0 * * ${WEEKDAY_MAP[weekdayKey]}`
    };
  }

  const quantifiedMatch = normalized.match(
    /^every (?:(\d+)\s+)?(minute|minutes|hour|hours|day|days|week|weeks)$/
  );

  if (quantifiedMatch) {
    const value = Number.parseInt(quantifiedMatch[1] || "1", 10);
    const rawUnit = quantifiedMatch[2];
    const unit = rawUnit.endsWith("s")
      ? (rawUnit as EveryInterval["unit"])
      : (`${rawUnit}s` as EveryInterval["unit"]);

    const cronEquivalent =
      unit === "minutes"
        ? `*/${value} * * * *`
        : unit === "hours"
          ? `0 */${value} * * *`
          : unit === "days"
            ? `0 0 */${value} * *`
            : `0 0 */${Math.max(value * 7, 7)} * *`;

    return {
      value,
      unit,
      cronEquivalent
    };
  }

  return null;
}

export function validateCronExpression(cron: string): CronValidation {
  const parsed = parseCronExpressionInternal(cron);

  if (!parsed.valid) {
    return {
      valid: false,
      error: parsed.error
    };
  }

  const nextRun = getNextCronRun(cron);

  return {
    valid: true,
    description: describeCron(cron, parsed.parts),
    nextRun: nextRun ?? undefined
  };
}

export function getNextRunTime(workflow: WorkflowLike): Date | null {
  if (!workflow.enabled) {
    return null;
  }

  if (workflow.trigger !== "scheduled") {
    return null;
  }

  const scheduleMode = workflow.scheduleMode ?? "";

  if (scheduleMode === "cron" && workflow.cronExpression) {
    return validateCronExpression(workflow.cronExpression).nextRun ?? null;
  }

  if (scheduleMode === "every" && workflow.frequency) {
    const parsed = parseEveryInterval(workflow.frequency);

    if (!parsed) {
      return null;
    }

    if (parsed.unit === "weeks" && /\* \* \d$/.test(parsed.cronEquivalent)) {
      return validateCronExpression(parsed.cronEquivalent).nextRun ?? null;
    }

    // Calendar-anchored schedules (monthly/quarterly/yearly) — these have
    // fixed dayOfMonth or month positions in the cron, so route them
    // through validateCronExpression to honor the calendar boundary
    // instead of doing simple "lastRun + N days" arithmetic.
    const cronParts = parsed.cronEquivalent.split(/\s+/);
    if (cronParts.length === 5) {
      const [, , dayOfMonth, month] = cronParts;
      const hasFixedDayOrMonth =
        (dayOfMonth !== "*" && !dayOfMonth.startsWith("*/")) ||
        (month !== "*" && month !== "*/1");
      if (hasFixedDayOrMonth) {
        return validateCronExpression(parsed.cronEquivalent).nextRun ?? null;
      }
    }

    // First-fire semantics for "every N" schedules: if the workflow has
    // never run, fire immediately on the next scheduler tick. Only add the
    // interval AFTER a successful run has anchored lastRunAt. This matches
    // what users intuitively expect — "every 4 hours" creates a workflow
    // that runs soon, then every 4 hours after that, not one that waits 4
    // hours for its first ever run.
    if (!workflow.lastRunAt) {
      return new Date();
    }

    const nextRun = new Date(workflow.lastRunAt);

    if (parsed.unit === "minutes") {
      nextRun.setMinutes(nextRun.getMinutes() + parsed.value);
    } else if (parsed.unit === "hours") {
      nextRun.setHours(nextRun.getHours() + parsed.value);
    } else if (parsed.unit === "days") {
      nextRun.setDate(nextRun.getDate() + parsed.value);
    } else {
      nextRun.setDate(nextRun.getDate() + parsed.value * 7);
    }

    return nextRun;
  }

  return null;
}

export function formatScheduleDisplay(workflow: WorkflowLike) {
  switch (workflow.trigger) {
    case "manual":
      return "Manual only";
    case "webhook":
      return "Via webhook";
    case "new_email":
      return "On new email";
    case "new_lead":
      return "On new lead";
    case "new_comment":
      return "On new comment";
    case "scheduled": {
      if (workflow.scheduleMode === "cron" && workflow.cronExpression) {
        const validation = validateCronExpression(workflow.cronExpression);
        return validation.valid
          ? `${validation.description}${workflow.timezone ? ` | ${workflow.timezone}` : ""}`
          : "Scheduled (invalid cron)";
      }

      if (workflow.scheduleMode === "every" && workflow.frequency) {
        const parsed = parseEveryInterval(workflow.frequency);
        if (!parsed) {
          return workflow.frequency;
        }

        const unitLabel =
          parsed.value === 1 ? parsed.unit.slice(0, -1) : parsed.unit;
        return `Every ${parsed.value} ${unitLabel}${workflow.timezone ? ` | ${workflow.timezone}` : ""}`;
      }

      if (
        workflow.scheduleMode === "definition_only" ||
        workflow.scheduleMode === "definition"
      ) {
        return workflow.frequency || "Definition only";
      }

      return "Scheduled";
    }
    default:
      return "Workflow";
  }
}
