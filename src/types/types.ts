import { Request } from "express";

export type ExtendedRequest = Request & {
    userId?: String;
    month: Number;
    year: Number;
  };