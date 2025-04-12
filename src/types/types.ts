import { Request } from "express";

export type ExtendedRequest = Request & {
    userId?: string;
    month?: number;
    year?: number;
    password?: string;
    id?: any;
  };