import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const where: any = { companyId };
    if (category && category !== 'all') {
      where.category = category;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (entityId) {
      where.entityId = entityId;
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' }
    });

    // Calculate storage stats
    const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const categoryBreakdown = documents.reduce((acc: any, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ 
      documents,
      stats: {
        totalDocuments: documents.length,
        totalSize,
        categoryBreakdown
      }
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyId,
      fileName,
      fileUrl,
      fileSize,
      fileType,
      category,
      entityType,
      entityId,
      tags,
      description,
      uploadedBy
    } = body;

    // Validation
    if (!companyId || !fileName || !fileUrl) {
      return NextResponse.json({ 
        error: 'Missing required fields: companyId, fileName, fileUrl' 
      }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        companyId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        fileType: fileType || 'application/pdf',
        category: category || 'other',
        entityType,
        entityId,
        tags: tags || [],
        description,
        uploadedBy,
        version: 1,
        status: 'active'
      }
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Failed to upload document', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, action, userId, ...updateData } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    let data: any = { ...updateData };

    switch (action) {
      case 'archive':
        data = { status: 'archived', archivedBy: userId, archivedAt: new Date() };
        break;
      case 'restore':
        data = { status: 'active' };
        break;
      case 'delete':
        data = { status: 'deleted', deletedBy: userId, deletedAt: new Date() };
        break;
      case 'update_tags':
        data = { tags: updateData.tags };
        break;
      case 'update_category':
        data = { category: updateData.category };
        break;
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data
    });

    return NextResponse.json({ document });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Failed to update document', details: error.message }, { status: 500 });
  }
}

// Search documents
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, searchTerm } = body;

    if (!companyId || !searchTerm) {
      return NextResponse.json({ error: 'Company ID and search term required' }, { status: 400 });
    }

    // Search in fileName, description, and tags
    const documents = await prisma.document.findMany({
      where: {
        companyId,
        status: 'active',
        OR: [
          { fileName: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { tags: { hasSome: [searchTerm] } }
        ]
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return NextResponse.json({ documents, count: documents.length });
  } catch (error: any) {
    console.error('Error searching documents:', error);
    return NextResponse.json({ error: 'Failed to search documents', details: error.message }, { status: 500 });
  }
}

