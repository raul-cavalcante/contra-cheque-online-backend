import { Request } from "express";

export type ExtendedRequest = Request & {
    userId?: String;
    month: Number;
    year: Number;
    password: Number;
    id?: any;
};

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error' | 'timeout';
  progress?: number;
  startedAt: string;
  lastUpdated?: string;
  completedAt?: string;
  result?: any;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  timeoutAt?: string;
}

export interface JobResult {
  totalPages: number;
  processedPages: number;
  results: any[];
  success: boolean;
}