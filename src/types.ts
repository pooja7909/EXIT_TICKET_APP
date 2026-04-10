export type TicketType = 'quiz' | 'circle' | 'reflect' | 'mixed' | 'upload';
export type TicketSource = 'generated' | 'manual' | 'upload' | 'link';
export type TicketStatus = 'active' | 'draft';

export interface Question {
  type: 'mcq' | 'circle' | 'reflect';
  text: string;
  options?: string[];
  correct?: number;
}

export interface Ticket {
  id: string;
  name: string;
  subject: string;
  topic: string;
  cls: string;
  status: TicketStatus;
  type: TicketType;
  source: TicketSource;
  html?: string;
  url?: string;
  learnerAmbitions: string[];
  color: string;
  created: string;
  teacherId: string;
  teacherEmail: string;
  questions?: Question[];
}

export interface StudentAnswer {
  questionIndex: number;
  questionText: string;
  answer: string;
  isCorrect?: boolean;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  ticketName: string;
  studentName: string;
  yearGroup: string;
  answers: StudentAnswer[];
  submittedAt: string;
  teacherId: string;
}
