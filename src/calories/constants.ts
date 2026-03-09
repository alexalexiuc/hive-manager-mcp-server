export const MEALS_SHEET_NAME = 'meals';
export const PROFILE_SHEET_NAME = 'profile';

export const MEALS_SHEET_HEADERS = [
  'meal_id',
  'date',
  'meal_type',
  'description',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'notes',
  'created_at',
] as const;

export const PROFILE_SHEET_HEADERS = [
  'name',
  'age',
  'height_cm',
  'weight_kg',
  'sex',
  'activity_level',
  'goal_calories_override',
  'neck_cm',
  'waist_cm',
  'hips_cm',
  'notes',
  'updated_at',
] as const;

export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
}

export enum ActivityLevel {
  SEDENTARY = 'sedentary',
  LIGHTLY_ACTIVE = 'lightly_active',
  MODERATELY_ACTIVE = 'moderately_active',
  VERY_ACTIVE = 'very_active',
  EXTRA_ACTIVE = 'extra_active',
}

export enum Sex {
  MALE = 'male',
  FEMALE = 'female',
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
};

export const DEFAULT_MEAL_LIMIT = 50;
export const MAX_MEAL_LIMIT = 500;

export const MEAL_COL = Object.fromEntries(
  MEALS_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof MEALS_SHEET_HEADERS)[number]]: number };

export const PROFILE_COL = Object.fromEntries(
  PROFILE_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof PROFILE_SHEET_HEADERS)[number]]: number };
