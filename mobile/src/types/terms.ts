export interface TermsDocument {
  version: string;
  text: string;
}

export interface TermsAcceptance {
  termsAccepted: true;
  termsVersion: string;
}
