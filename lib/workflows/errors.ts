export class ActionHandlerError extends Error {
  readonly code: string;

  constructor(message: string, code = "ACTION_HANDLER_ERROR") {
    super(message);
    this.name = "ActionHandlerError";
    this.code = code;
  }
}

export class ActionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionRegistryError";
  }
}

export class WorkflowPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowPermissionError";
    (this as unknown as { status: number }).status = 403;
  }
}

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTransitionError";
    (this as unknown as { status: number }).status = 409;
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowNotFoundError";
    (this as unknown as { status: number }).status = 404;
  }
}
