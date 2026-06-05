export interface EligibleSpecialtyRecord {
  code: string;
  name: string;
  cups: string | null;
}

export interface PatientSpecialtyEligibilityFilters {
  epsCode: string;
  userType: string;
  sex: 'F' | 'M' | 'I';
}

export interface PatientSpecialtyEligibilityRepository {
  findEligibleSpecialties(
    filters: PatientSpecialtyEligibilityFilters,
  ): Promise<EligibleSpecialtyRecord[]>;
}
