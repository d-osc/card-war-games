export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new AppError(message, 400);
}
