import { describe, it, expect, beforeEach, vi } from "vitest";
import { Role, RoleScope, ActionState } from "@prisma/client";
import { ApprovalActionHandler } from "@/lib/workflows/handlers/approval";
import { SignatureActionHandler } from "@/lib/workflows/handlers/signature-client";
import { RequestDocActionHandler } from "@/lib/workflows/handlers/request-doc";
import { PaymentActionHandler } from "@/lib/workflows/handlers/payment-client";
import { ChecklistActionHandler } from "@/lib/workflows/handlers/checklist";
import type { WorkflowRuntimeContext } from "@/lib/workflows/types";

describe("Workflow Handler Role-Based Access Control", () => {
  const mockTx = {} as any;
  const mockInstance = { id: "inst-1", matterId: "matter-1" } as any;
  const mockNow = new Date("2024-01-15T10:00:00.000Z");

  describe("ApprovalActionHandler (APPROVAL)", () => {
    const handler = new ApprovalActionHandler();

    it("should allow ADMIN to start approval", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "admin-1", role: Role.ADMIN },
        config: {},
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow LAWYER to start approval when roleScope is LAWYER", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "lawyer-1", role: Role.LAWYER },
        config: {},
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should NOT allow CLIENT to start lawyer approval", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "client-1", role: Role.CLIENT },
        config: {},
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });

    it("should NOT allow PARALEGAL to start lawyer approval", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "paralegal-1", role: Role.PARALEGAL },
        config: {},
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });

    it("should NOT allow starting without an actor", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: undefined,
        config: {},
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });
  });

  describe("SignatureActionHandler (SIGNATURE)", () => {
    const handler = new SignatureActionHandler();

    it("should allow ADMIN to start signature", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "admin-1", role: Role.ADMIN },
        config: { documentId: "doc-1" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow CLIENT to start signature when roleScope is CLIENT", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "client-1", role: Role.CLIENT },
        config: { documentId: "doc-1" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should NOT allow LAWYER to complete client signature", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "lawyer-1", role: Role.LAWYER },
        config: { documentId: "doc-1" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });

    it("should NOT allow PARALEGAL to complete client signature", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "paralegal-1", role: Role.PARALEGAL },
        config: { documentId: "doc-1" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });
  });

  describe("RequestDocActionHandler (REQUEST_DOC)", () => {
    const handler = new RequestDocActionHandler();

    it("should allow ADMIN to start document request", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "admin-1", role: Role.ADMIN },
        config: { requestText: "Please upload ID" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow CLIENT to complete document upload", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "client-1", role: Role.CLIENT },
        config: { requestText: "Please upload ID" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should NOT allow LAWYER to complete client document upload", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "lawyer-1", role: Role.LAWYER },
        config: { requestText: "Please upload ID" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });
  });

  describe("PaymentActionHandler (PAYMENT)", () => {
    const handler = new PaymentActionHandler();

    it("should allow ADMIN to start payment", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "admin-1", role: Role.ADMIN },
        config: { amount: 1000, currency: "USD" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow CLIENT to complete payment", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "client-1", role: Role.CLIENT },
        config: { amount: 1000, currency: "USD" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should NOT allow LAWYER to complete client payment", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "lawyer-1", role: Role.LAWYER },
        config: { amount: 1000, currency: "USD" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });

    it("should NOT allow PARALEGAL to complete client payment", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "paralegal-1", role: Role.PARALEGAL },
        config: { amount: 1000, currency: "USD" },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });
  });

  describe("ChecklistActionHandler (CHECKLIST)", () => {
    const handler = new ChecklistActionHandler();

    it("should allow ADMIN to start checklist", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "admin-1", role: Role.ADMIN },
        config: { items: ["Item 1", "Item 2"] },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow LAWYER to start checklist with LAWYER roleScope", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: { id: "lawyer-1", role: Role.LAWYER },
        config: { items: ["Item 1", "Item 2"] },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should allow CLIENT to start checklist with CLIENT roleScope", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.CLIENT,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.CLIENT } as any,
        } as any,
        actor: { id: "client-1", role: Role.CLIENT },
        config: { items: ["Item 1", "Item 2"] },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(true);
    });

    it("should NOT allow starting without an actor", () => {
      const ctx: WorkflowRuntimeContext = {
        tx: mockTx,
        instance: mockInstance,
        step: {
          id: "step-1",
          roleScope: RoleScope.LAWYER,
          actionState: ActionState.READY,
          templateStep: { required: true, roleScope: RoleScope.LAWYER } as any,
        } as any,
        actor: undefined,
        config: { items: ["Item 1", "Item 2"] },
        data: {},
        now: mockNow,
        context: {},
        updateContext: vi.fn(),
      };

      const canStart = handler.canStart(ctx);
      expect(canStart).toBe(false);
    });
  });
});
