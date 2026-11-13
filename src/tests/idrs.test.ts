import { describe, expect, it } from "vitest";
import { calculateIdrsAndPrevention } from "../config/idrs";

describe("Indian Diabetes Risk Score (MDRF IDRS) & Prevention Check", () => {
  it("scores <30 as Low risk band", () => {
    const res = calculateIdrsAndPrevention({
      age: 29, // 0
      sex: "female",
      waistCm: 76, // <80 -> 0
      activityLevel: "moderate", // 10
      familyHistory: "none", // 0
      sleepHours: 7.5,
      dietPattern: "balanced_home",
      tobaccoUse: "none",
      stressLevel: "low",
    });

    expect(res.idrsScore).toBe(10);
    expect(res.riskBand).toBe("Low");
    expect(res.topActions.length).toBe(3);
  });

  it("scores 30 to 50 as Moderate risk band", () => {
    const res = calculateIdrsAndPrevention({
      age: 42, // 20
      sex: "male",
      waistCm: 94, // 90-99 -> 10
      activityLevel: "moderate", // 10
      familyHistory: "one_parent", // 10
      sleepHours: 6.5,
      dietPattern: "refined_carbs_frequent",
      tobaccoUse: "none",
      stressLevel: "moderate",
    });

    expect(res.idrsScore).toBe(50);
    expect(res.riskBand).toBe("Moderate");
  });

  it("scores >=60 as High risk band with published MDRF cut-offs", () => {
    const res = calculateIdrsAndPrevention({
      age: 54, // 30
      sex: "female",
      waistCm: 92, // >=90 -> 20
      activityLevel: "sedentary", // 30
      familyHistory: "both_parents", // 20
      sleepHours: 5.5,
      dietPattern: "high_salt_fried_snacks",
      tobaccoUse: "smokeless",
      stressLevel: "high",
    });

    expect(res.idrsScore).toBe(100);
    expect(res.riskBand).toBe("High");
    expect(res.topActions.length).toBe(3);
  });
});
