export interface WhatsappSignatureVerifierPort {
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
}
