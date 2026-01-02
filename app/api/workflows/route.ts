import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const entityType = searchParams.get('entityType');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (entityType) {
      where.entityType = entityType;
    }

    const workflows = await prisma.workflow.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ workflows });
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Failed to fetch workflows', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      name,
      description,
      entityType,
      triggerConditions,
      approvalSteps,
      autoApprovalRules,
      notificationSettings,
      createdBy
    } = body;

    // Validation
    if (!companyId || !name || !entityType || !approvalSteps || approvalSteps.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name,
        description,
        entityType,
        triggerConditions: triggerConditions || {},
        approvalSteps,
        autoApprovalRules: autoApprovalRules || {},
        notificationSettings: notificationSettings || {},
        isActive: true,
        createdBy
      }
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    return NextResponse.json({ error: 'Failed to create workflow', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, action, ...updateData } = body;

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
    }

    let data: any = { ...updateData };

    if (action === 'activate') {
      data = { isActive: true };
    } else if (action === 'deactivate') {
      data = { isActive: false };
    }

    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data
    });

    return NextResponse.json({ workflow });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return NextResponse.json({ error: 'Failed to update workflow', details: error.message }, { status: 500 });
  }
}

// Execute workflow - check if entity needs approval
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, entityType, entityId, entityData, userId } = body;

    if (!companyId || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find active workflows for this entity type
    const workflows = await prisma.workflow.findMany({
      where: {
        companyId,
        entityType,
        isActive: true
      }
    });

    if (workflows.length === 0) {
      return NextResponse.json({ 
        requiresApproval: false,
        message: 'No active workflows found'
      });
    }

    // Check trigger conditions
    const matchingWorkflow = workflows.find(workflow => {
      const conditions = workflow.triggerConditions as any;
      
      // Amount-based triggers
      if (conditions.minAmount && entityData.amount < conditions.minAmount) {
        return false;
      }
      if (conditions.maxAmount && entityData.amount > conditions.maxAmount) {
        return false;
      }

      // Category-based triggers
      if (conditions.categories && conditions.categories.length > 0) {
        if (!conditions.categories.includes(entityData.category)) {
          return false;
        }
      }

      // Vendor-based triggers
      if (conditions.vendors && conditions.vendors.length > 0) {
        if (!conditions.vendors.includes(entityData.vendorId)) {
          return false;
        }
      }

      return true;
    });

    if (!matchingWorkflow) {
      return NextResponse.json({ 
        requiresApproval: false,
        message: 'No matching workflow conditions'
      });
    }

    // Check auto-approval rules
    const autoApprovalRules = matchingWorkflow.autoApprovalRules as any;
    let autoApproved = false;

    if (autoApprovalRules.enabled) {
      // Auto-approve if amount is below threshold
      if (autoApprovalRules.maxAmount && entityData.amount <= autoApprovalRules.maxAmount) {
        autoApproved = true;
      }

      // Auto-approve if submitter is in approved list
      if (autoApprovalRules.approvedUsers && autoApprovalRules.approvedUsers.includes(userId)) {
        autoApproved = true;
      }
    }

    if (autoApproved) {
      return NextResponse.json({
        requiresApproval: false,
        autoApproved: true,
        message: 'Auto-approved based on rules'
      });
    }

    // Create approval request
    const approvalSteps = matchingWorkflow.approvalSteps as any[];
    const pendingApprovals = approvalSteps.map((step: any, index: number) => ({
      stepNumber: index + 1,
      approverRole: step.role,
      approverIds: step.userIds || [],
      status: index === 0 ? 'pending' : 'waiting',
      required: step.required !== false
    }));

    return NextResponse.json({
      requiresApproval: true,
      workflowId: matchingWorkflow.id,
      workflowName: matchingWorkflow.name,
      approvalSteps: pendingApprovals,
      message: 'Approval required'
    });
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json({ error: 'Failed to execute workflow', details: error.message }, { status: 500 });
  }
}

