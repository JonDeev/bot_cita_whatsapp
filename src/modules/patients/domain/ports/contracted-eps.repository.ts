export interface ContractedEpsRepository {
  isCodeAllowed(epsCode: string): Promise<boolean>;
}
