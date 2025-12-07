import { workflowTemplateUpdateSchema } from "@/lib/validation/workflow";

// Test payload from user
const payload = {
  "name": "yeni intake",
  "description": "",
  "isActive": true,
  "steps": [
    {
      "id": "52a265fa-fa9d-459e-8d5d-b6c94c530602",
      "title": "New Task",
      "actionType": "TASK",
      "roleScope": "ADMIN",
      "required": true,
      "actionConfig": {
        "description": "",
        "requiresEvidence": false
      },
      "positionX": -27.05079429668478,
      "positionY": 100,
      "notificationPolicies": []
    },
    {
      "id": "6dca7cdc-b691-49b3-abd6-64ea6bcfe056",
      "title": "New APPROVAL Step",
      "actionType": "APPROVAL",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {},
      "positionX": 270.6491819929664,
      "positionY": -20.751244793312,
      "notificationPolicies": []
    },
    {
      "id": "5f2fc813-00d9-4422-a7d5-2861ebe20780",
      "title": "New SIGNATURE Step",
      "actionType": "SIGNATURE",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {},
      "positionX": 292.4397323569357,
      "positionY": 211.2029540516708,
      "notificationPolicies": []
    },
    {
      "id": "d04d3b14-89a1-4ca6-bebb-c4f75be8fc18",
      "title": "New REQUEST DOC Step",
      "actionType": "REQUEST_DOC",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {
        "requestText": "",
        "documentNames": ["Pasaport Kopyasi", "Dilekce"]
      },
      "positionX": 732.6291313732609,
      "positionY": 65.3131592616906,
      "notificationPolicies": []
    }
  ],
  "dependencies": [
    {
      "id": "cmhb4lhd500063y67fsm8jy45",
      "sourceStepId": "6dca7cdc-b691-49b3-abd6-64ea6bcfe056",
      "targetStepId": "d04d3b14-89a1-4ca6-bebb-c4f75be8fc18",
      "dependencyType": "DEPENDS_ON",
      "dependencyLogic": "ALL",
      "conditionConfig": null
    },
    {
      "id": "cmhb4lhd500073y67srodjzmm",
      "sourceStepId": "5f2fc813-00d9-4422-a7d5-2861ebe20780",
      "targetStepId": "d04d3b14-89a1-4ca6-bebb-c4f75be8fc18",
      "dependencyType": "DEPENDS_ON",
      "dependencyLogic": "ALL",
      "conditionConfig": null
    },
    {
      "id": "cmhb4lhd500083y67b17lggic",
      "sourceStepId": "52a265fa-fa9d-459e-8d5d-b6c94c530602",
      "targetStepId": "6dca7cdc-b691-49b3-abd6-64ea6bcfe056",
      "dependencyType": "DEPENDS_ON",
      "dependencyLogic": "ALL",
      "conditionConfig": null
    },
    {
      "id": "cmhb4lhd500093y6748uqix9p",
      "sourceStepId": "52a265fa-fa9d-459e-8d5d-b6c94c530602",
      "targetStepId": "5f2fc813-00d9-4422-a7d5-2861ebe20780",
      "dependencyType": "DEPENDS_ON",
      "dependencyLogic": "ALL",
      "conditionConfig": null
    }
  ]
};

try {
  const result = workflowTemplateUpdateSchema.parse(payload);
  console.log("✅ Validation passed!");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log("❌ Validation failed!");
  if (error instanceof Error) {
    console.log("\nError message:", error.message);
  }
  // @ts-ignore
  if (error.flatten) {
    // @ts-ignore
    console.log("\nFlattened errors:", JSON.stringify(error.flatten(), null, 2));
  }
}
