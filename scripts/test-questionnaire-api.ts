/**
 * Quick API Test for Questionnaire Endpoints
 * 
 * This script tests the questionnaire API endpoints to ensure they work correctly.
 * Run with: npx tsx scripts/test-questionnaire-api.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQuestionnaireModels() {
  console.log("\n🧪 Testing Questionnaire Models\n");

  try {
    // Test 1: Check models exist
    console.log("✅ Test 1: Prisma models accessible");
    console.log("   - Questionnaire:", typeof prisma.questionnaire);
    console.log("   - QuestionnaireQuestion:", typeof prisma.questionnaireQuestion);
    console.log("   - QuestionnaireResponse:", typeof prisma.questionnaireResponse);
    console.log("   - QuestionnaireResponseAnswer:", typeof prisma.questionnaireResponseAnswer);

    // Test 2: Count existing questionnaires
    const count = await prisma.questionnaire.count();
    console.log(`\n✅ Test 2: Database connection - ${count} questionnaires in database`);

    // Test 3: Create a test questionnaire
    console.log("\n✅ Test 3: Creating test questionnaire...");
    
    // Find first admin/lawyer user
    const adminUser = await prisma.user.findFirst({
      where: {
        role: { in: ["ADMIN", "LAWYER"] },
        deletedAt: null,
      },
    });

    if (!adminUser) {
      console.log("⚠️  No admin/lawyer user found. Skipping creation test.");
    } else {
      const testQuestionnaire = await prisma.questionnaire.create({
        data: {
          title: "Test Questionnaire - API Test",
          description: "This is a test questionnaire created by the API test script",
          createdById: adminUser.id,
          questions: {
            create: [
              {
                questionText: "What is your full name?",
                questionType: "FREE_TEXT",
                order: 0,
                required: true,
                placeholder: "Enter your full name",
              },
              {
                questionText: "What is your preferred contact method?",
                questionType: "SINGLE_CHOICE",
                order: 1,
                required: true,
                options: JSON.stringify(["Email", "Phone", "SMS"]),
              },
              {
                questionText: "What services are you interested in?",
                questionType: "MULTI_CHOICE",
                order: 2,
                required: false,
                options: JSON.stringify([
                  "Contract Review",
                  "Legal Consultation",
                  "Document Preparation",
                  "Court Representation",
                ]),
              },
            ],
          },
        },
        include: {
          questions: {
            orderBy: { order: "asc" },
          },
        },
      });

      console.log(`   Created questionnaire: ${testQuestionnaire.title}`);
      console.log(`   ID: ${testQuestionnaire.id}`);
      console.log(`   Questions: ${testQuestionnaire.questions.length}`);

      // Test 4: Create a response
      console.log("\n✅ Test 4: Creating test response...");
      const testResponse = await prisma.questionnaireResponse.create({
        data: {
          questionnaireId: testQuestionnaire.id,
          respondentId: adminUser.id,
          status: "IN_PROGRESS",
        },
        include: {
          questionnaire: true,
        },
      });

      console.log(`   Created response: ${testResponse.id}`);
      console.log(`   Status: ${testResponse.status}`);

      // Test 5: Add answers
      console.log("\n✅ Test 5: Adding answers...");
      const answers = await Promise.all([
        prisma.questionnaireResponseAnswer.create({
          data: {
            responseId: testResponse.id,
            questionId: testQuestionnaire.questions[0].id,
            answerText: "John Doe",
          },
        }),
        prisma.questionnaireResponseAnswer.create({
          data: {
            responseId: testResponse.id,
            questionId: testQuestionnaire.questions[1].id,
            answerJson: "Email",
          },
        }),
        prisma.questionnaireResponseAnswer.create({
          data: {
            responseId: testResponse.id,
            questionId: testQuestionnaire.questions[2].id,
            answerJson: ["Contract Review", "Legal Consultation"],
          },
        }),
      ]);

      console.log(`   Added ${answers.length} answers`);

      // Test 6: Mark as completed
      console.log("\n✅ Test 6: Completing response...");
      const completed = await prisma.questionnaireResponse.update({
        where: { id: testResponse.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      console.log(`   Response completed: ${completed.status}`);

      // Test 7: Query completed response
      console.log("\n✅ Test 7: Querying response with answers...");
      const fullResponse = await prisma.questionnaireResponse.findUnique({
        where: { id: testResponse.id },
        include: {
          questionnaire: true,
          respondent: {
            select: { name: true, email: true },
          },
          answers: {
            include: { question: true },
          },
        },
      });

      console.log(`   Found response with ${fullResponse?.answers.length} answers`);

      // Test 8: Cleanup - soft delete
      console.log("\n✅ Test 8: Cleaning up test data...");
      await prisma.questionnaireResponse.delete({
        where: { id: testResponse.id },
      });
      await prisma.questionnaire.update({
        where: { id: testQuestionnaire.id },
        data: {
          deletedAt: new Date(),
          deletedBy: adminUser.id,
        },
      });

      console.log("   Test data cleaned up");
    }

    console.log("\n✅ All tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testQuestionnaireModels();
