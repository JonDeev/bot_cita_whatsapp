export interface EligibleSpecialtyRecord {
  code: string;
  name: string;
  cups: string | null;
}

export interface PatientSpecialtyEligibilityFilters {
  epsCode: string;
  userType: string;
  sex: 'H' | 'M';
}

export interface PatientSpecialtyEligibilityRepository {
  findEligibleSpecialties(
    filters: PatientSpecialtyEligibilityFilters,
  ): Promise<EligibleSpecialtyRecord[]>;
}
