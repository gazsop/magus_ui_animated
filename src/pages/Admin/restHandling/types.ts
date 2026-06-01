import { Application } from "@shared/contracts";

export type TCloseProps = {
  close: () => void;
};

export type TRestRequest = <T, K extends object = {}>(args: {
  endPoint: string;
  method?: "GET" | "POST";
  body?: K;
}) => Promise<Application.IResponseDataSuccess<T>>;

export type TSetError = (value: string | null) => void;

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
