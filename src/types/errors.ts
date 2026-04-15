export class TwitterError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'TwitterError';
  }
}

export class APIError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}