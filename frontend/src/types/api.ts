export interface ApiErrorResponse {
  error: string;
  message?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}
