
export interface Loan {
  id: string;
  // Lender Details
  lenderName: string;
  lenderCivility?: 'M.' | 'Mme';
  lenderBirthDate?: string;
  lenderBirthPlace?: string;
  lenderAddress?: string;

  // Borrower Details
  borrowerName: string;
  borrowerCivility?: 'M.' | 'Mme';
  borrowerBirthDate?: string;
  borrowerBirthPlace?: string;
  borrowerAddress?: string;

  // Loan Details
  amount: number;
  currency: string;
  loanDate: string;
  repaymentDate: string;
  status: 'active' | 'paid';
  
  // Contract Data
  contractText?: string;
  borrowerSignature?: string; 
  lenderSignature?: string;
  city: string;
  country: string;
  signedDate: string;
}

export interface CalculationResult {
  daysLate: number;
  interestAmount: number;
  totalDue: number;
  isOverdue: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
