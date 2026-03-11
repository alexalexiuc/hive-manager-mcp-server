export interface MealEntry {
  meal_id: string;
  date: string;
  meal_type: string;
  description: string;
  calories: string;
  protein_g?: string;
  carbs_g?: string;
  fat_g?: string;
  notes?: string;
  created_at: string;
}

export interface BodyProfile {
  name?: string;
  age?: string;
  height_cm?: string;
  weight_kg?: string;
  sex?: string;
  activity_level?: string;
  goal_calories_override?: string;
  neck_cm?: string;
  waist_cm?: string;
  hips_cm?: string;
  notes?: string;
  updated_at?: string;
}
