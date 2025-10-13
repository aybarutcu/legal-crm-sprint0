import type { ActionType } from "@prisma/client";
import type { IActionHandler } from "./types";
import { ActionRegistryError } from "./errors";

class ActionRegistry {
  private readonly handlers = new Map<ActionType, IActionHandler>();

  register<TConfig, TData>(handler: IActionHandler<TConfig, TData>): void {
    if (this.handlers.has(handler.type)) {
      throw new ActionRegistryError(`Handler already registered for type ${handler.type}`);
    }
    this.handlers.set(handler.type, handler as IActionHandler);
  }

  override<TConfig, TData>(handler: IActionHandler<TConfig, TData>): void {
    this.handlers.set(handler.type, handler as IActionHandler);
  }

  get<TConfig = unknown, TData = unknown>(type: ActionType): IActionHandler<TConfig, TData> {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new ActionRegistryError(`No handler registered for type ${type}`);
    }
    return handler as IActionHandler<TConfig, TData>;
  }

  list(): IActionHandler[] {
    return Array.from(this.handlers.values());
  }
}

export const actionRegistry = new ActionRegistry();
