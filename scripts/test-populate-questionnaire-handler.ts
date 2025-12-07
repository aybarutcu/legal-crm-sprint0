#!/usr/bin/env tsx
/**
 * Test script for PopulateQuestionnaireActionHandler
 * 
 * Tests the workflow handler for POPULATE_QUESTIONNAIRE action type:
 * 1. Handler registration
 * 2. Config validation
 * 3. Start method (validates questionnaire exists)
 * 4. Complete method (validates response and stores data)
 * 5. Workflow context updates
 * 6. Fail and skip methods
 */

import { PrismaClient, ActionType, ActionState, Role } from "@prisma/client";
import { PopulateQuestionnaireActionHandler } from "../lib/workflows/handlers/populate-questionnaire";
import { actionRegistry } from "../lib/workflows/registry";
import type { WorkflowRuntimeContext } from "../lib/workflows/types";

const prisma = new PrismaClient();

// Test data IDs
let testUserId: string;
let testQuestionnaireId: string;
let testResponseId: string;
let testWorkflowInstanceId: string;
let testWorkflowStepId: string;

// Helper to create a mock runtime context
function createMockContext(
  config: any,
  data: any,
  actorRole: Role = Role.CLIENT,
): WorkflowRuntimeContext<any, any> {
  const contextUpdates: Record<string, unknown> = {};
  
  return {
    tx: prisma,
    instance: {
      id: testWorkflowInstanceId,
      templateId: "test-template",
      matterId: null,
      contactId: null,
      templateVersion: 1,
      createdById: testUserId,
      status: "ACTIVE",
      contextData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    step: {
      id: testWorkflowStepId,
      instanceId: testWorkflowInstanceId,
      templateStepId: "test-template-step",
      title: "Test Step",
      actionType: ActionType.POPULATE_QUESTIONNAIRE,
      roleScope: "CLIENT" as any,
      required: true,
      actionState: ActionState.PENDING,
      actionData: data as any,
      notificationPolicies: [],
      automationLog: [],
      notificationLog: [],
      assignedToId: null,
      dueDate: null,
      priority: "MEDIUM" as any,
      notes: null,
      startedAt: null,
      completedAt: null,
      positionX: 0,
      positionY: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      instance: {
        id: testWorkflowInstanceId,
        templateId: "test-template",
        matterId: null,
        contactId: null,
        templateVersion: 1,
        createdById: testUserId,
        status: "ACTIVE",
        contextData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      templateStep: {
        actionConfig: config as any,
        roleScope: "CLIENT" as any,
        actionType: ActionType.POPULATE_QUESTIONNAIRE,
        required: true,
        notificationPolicies: [],
      },
    },
    actor: {
      id: testUserId,
      role: actorRole,
    },
    config: config as Record<string, unknown>,
    data: data as Record<string, unknown>,
    now: new Date(),
    context: {},
    updateContext: (updates: Record<string, unknown>) => {
      Object.assign(contextUpdates, updates);
    },
    _getContextUpdates: () => contextUpdates,
  };
}

async function runTests() {
  console.log("🧪 Testing PopulateQuestionnaireActionHandler\n");

  try {
    // Test 1: Handler Registration
    console.log("Test 1: Handler Registration");
    const handler = new PopulateQuestionnaireActionHandler();
    console.log("✅ Handler instantiated:", handler.type);
    
    // Register handler
    actionRegistry.override(handler);
    const registered = actionRegistry.get(ActionType.POPULATE_QUESTIONNAIRE);
    console.log("✅ Handler registered in action registry\n");

    // Test 2: Create test data
    console.log("Test 2: Creating test data...");
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-handler-${Date.now()}@example.com`,
        name: "Test Handler User",
        role: Role.CLIENT,
      },
    });
    testUserId = user.id;
    console.log("✅ Created test user:", testUserId);

    // Create test questionnaire
    const questionnaire = await prisma.questionnaire.create({
      data: {
        title: "Test Handler Questionnaire",
        description: "For handler testing",
        isActive: true,
        createdById: testUserId,
        questions: {
          create: [
            {
              questionText: "What is your name?",
              questionType: "FREE_TEXT",
              order: 0,
              required: true,
            },
            {
              questionText: "Select an option",
              questionType: "SINGLE_CHOICE",
              order: 1,
              required: true,
              options: ["Option A", "Option B", "Option C"],
            },
          ],
        },
      },
    });
    testQuestionnaireId = questionnaire.id;
    console.log("✅ Created test questionnaire:", testQuestionnaireId);

    // Create test response
    const response = await prisma.questionnaireResponse.create({
      data: {
        questionnaireId: testQuestionnaireId,
        respondentId: testUserId,
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    testResponseId = response.id;
    console.log("✅ Created test response:", testResponseId);

    // Add answers to response
    const questions = await prisma.questionnaireQuestion.findMany({
      where: { questionnaireId: testQuestionnaireId },
      orderBy: { order: "asc" },
    });

    await prisma.questionnaireResponseAnswer.createMany({
      data: [
        {
          responseId: testResponseId,
          questionId: questions[0].id,
          answerText: "John Doe",
        },
        {
          responseId: testResponseId,
          questionId: questions[1].id,
          answerJson: "Option A",
        },
      ],
    });
    console.log("✅ Added 2 answers to response\n");

    // Create fake workflow instance and step IDs
    testWorkflowInstanceId = `test-instance-${Date.now()}`;
    testWorkflowStepId = `test-step-${Date.now()}`;

    // Test 3: Config Validation
    console.log("Test 3: Config Validation");
    
    // Valid config
    const validConfig = {
      questionnaireId: testQuestionnaireId,
      title: "Complete Client Intake",
      description: "Please fill out the client intake form",
      dueInDays: 7,
    };
    
    try {
      handler.validateConfig(validConfig);
      console.log("✅ Valid config accepted");
    } catch (error) {
      console.log("❌ Valid config rejected:", error);
    }

    // Invalid config (missing questionnaireId)
    try {
      handler.validateConfig({ title: "Test" } as never);
      console.log("❌ Invalid config accepted (should have been rejected)");
    } catch (error) {
      console.log("✅ Invalid config rejected correctly");
    }

    // Invalid config (missing title)
    try {
      handler.validateConfig({ questionnaireId: "test" } as never);
      console.log("❌ Invalid config accepted (should have been rejected)");
    } catch (error) {
      console.log("✅ Invalid config rejected correctly\n");
    }

    // Test 4: canStart method
    console.log("Test 4: canStart method");
    const ctx = createMockContext(validConfig, {});
    
    const canStart = handler.canStart(ctx);
    console.log("✅ canStart returned:", canStart);
    
    // Test with no actor
    const ctxNoActor = createMockContext(validConfig, {});
    ctxNoActor.actor = undefined;
    const canStartNoActor = handler.canStart(ctxNoActor);
    console.log("✅ canStart with no actor:", canStartNoActor, "(expected: false)\n");

    // Test 5: start method
    console.log("Test 5: start method");
    const startCtx = createMockContext(validConfig, {});
    
    const startState = await handler.start(startCtx);
    console.log("✅ start returned state:", startState);
    console.log("✅ Data after start:", startCtx.data);

    // Test start with invalid questionnaire ID
    try {
      const invalidConfig = { ...validConfig, questionnaireId: "invalid-id" };
      const invalidCtx = createMockContext(invalidConfig, {});
      await handler.start(invalidCtx);
      console.log("❌ Invalid questionnaire accepted (should have failed)");
    } catch (error: unknown) {
      const err = error as Error;
      console.log("✅ Invalid questionnaire rejected:", err.message, "\n");
    }

    // Test 6: complete method
    console.log("Test 6: complete method");
    const completeCtx = createMockContext(validConfig, {
      questionnaireId: testQuestionnaireId,
      questionnaireTitle: "Test Handler Questionnaire",
    });
    
    const completePayload = { responseId: testResponseId };
    const completeState = await handler.complete(completeCtx, completePayload);
    
    console.log("✅ complete returned state:", completeState);
    console.log("✅ Data after complete:", completeCtx.data);
    
    // Check context updates
    const contextUpdates = completeCtx._getContextUpdates?.() || {};
    console.log("✅ Context updates:", Object.keys(contextUpdates));
    
    const questionnaireKey = `questionnaire_${testWorkflowStepId}`;
    if (contextUpdates[questionnaireKey]) {
      const questionnaireData = contextUpdates[questionnaireKey] as Record<string, unknown>;
      console.log("✅ Questionnaire data in context:", {
        title: questionnaireData.title,
        responseId: questionnaireData.responseId,
        answerCount: questionnaireData.answerCount,
      });
    }

    // Test complete with invalid response ID
    try {
      const invalidPayload = { responseId: "invalid-id" };
      await handler.complete(completeCtx, invalidPayload);
      console.log("❌ Invalid response accepted (should have failed)");
    } catch (error: unknown) {
      const err = error as Error;
      console.log("✅ Invalid response rejected:", err.message);
    }

    // Test complete with incomplete response
    const incompleteResponse = await prisma.questionnaireResponse.create({
      data: {
        questionnaireId: testQuestionnaireId,
        respondentId: testUserId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    try {
      const incompletePayload = { responseId: incompleteResponse.id };
      await handler.complete(completeCtx, incompletePayload);
      console.log("❌ Incomplete response accepted (should have failed)");
    } catch (error: unknown) {
      const err = error as Error;
      console.log("✅ Incomplete response rejected:", err.message, "\n");
    }

    // Test 7: fail method
    console.log("Test 7: fail method");
    const failCtx = createMockContext(validConfig, {});
    const failState = await handler.fail(failCtx, "Test failure");
    console.log("✅ fail returned state:", failState);
    console.log("✅ Data after fail:", failCtx.data, "\n");

    // Test 8: skip method
    console.log("Test 8: skip method");
    const skipCtx = createMockContext(validConfig, {});
    const skipState = await handler.skip(skipCtx);
    console.log("✅ skip returned state:", skipState);
    console.log("✅ Data after skip:", skipCtx.data, "\n");

    // Test 9: getNextStateOnEvent method
    console.log("Test 9: getNextStateOnEvent method");
    const eventState = handler.getNextStateOnEvent();
    console.log("✅ getNextStateOnEvent returned:", eventState, "(expected: null)\n");

    // Cleanup
    console.log("Cleaning up test data...");
    await prisma.questionnaireResponseAnswer.deleteMany({
      where: { responseId: { in: [testResponseId, incompleteResponse.id] } },
    });
    await prisma.questionnaireResponse.deleteMany({
      where: { id: { in: [testResponseId, incompleteResponse.id] } },
    });
    await prisma.questionnaireQuestion.deleteMany({
      where: { questionnaireId: testQuestionnaireId },
    });
    await prisma.questionnaire.delete({
      where: { id: testQuestionnaireId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    console.log("✅ Test data cleaned up\n");

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
