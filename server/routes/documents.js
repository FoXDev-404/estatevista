import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableString, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const createDocumentSchema = z.object({
  owner_type: z.enum(['project', 'unit'], { message: 'Choose a project or unit.' }),
  owner_id: z.string().uuid('Choose a record.'),
  category: nullableString(80),
  file_name: z.string().trim().min(1, 'Choose a file.').max(255),
  data: z.string().min(1, 'The file data is missing.'),
});

function hasPermission(req, permission) {
  const permissions = req.auth?.permissions || [];
  return Boolean(
    req.auth?.user?.full_access ||
      permissions.includes('*') ||
      permissions.includes(permission),
  );
}

function assertPermission(req, ownerType, action) {
  const permission = ownerType === 'unit' ? `units.${action}` : `projects.${action}`;
  if (!hasPermission(req, permission)) {
    throw new ApiError(403, 'You do not have permission to do that.');
  }
}

function safeFileName(value) {
  return String(value)
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9._ -]/g, '')
    .trim()
    .slice(0, 160) || 'document';
}

function parseDataUri(data) {
  const matches = String(data).match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw validationError({ data: 'Upload a valid base64 file.' });
  }

  const mimeType = matches[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw validationError({ data: 'Upload a PDF, Office document, image or text file.' });
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (!buffer.length) {
    throw validationError({ data: 'The uploaded file is empty.' });
  }
  if (buffer.length > MAX_BYTES) {
    throw validationError({ data: 'Use a file smaller than 10 MB.' });
  }

  return { mimeType, buffer, size: buffer.length };
}

export function createDocumentsRouter({ auth, repository }) {
  const router = Router();

  router.get(
    '/',
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const ownerType = String(req.query.owner_type || '');
      const ownerId = String(req.query.owner_id || '');

      if (ownerType) {
        if (!['project', 'unit'].includes(ownerType)) {
          throw validationError({ owner_type: 'Choose a project or unit.' });
        }
        assertPermission(req, ownerType, 'view');
      }
      if (ownerId && !/^[0-9a-f-]{36}$/i.test(ownerId)) {
        throw validationError({ owner_id: 'Choose a valid record.' });
      }

      const rows = await repository.listDocuments(companyId, {
        ownerType: ownerType || null,
        ownerId: ownerId || null,
      });
      res.json({ data: rows });
    }),
  );

  router.post(
    '/',
    auth.requireAuth,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createDocumentSchema, req.body);
      assertPermission(req, input.owner_type, 'edit');

      const owner =
        input.owner_type === 'project'
          ? await repository.getProject(companyId, input.owner_id)
          : await repository.getUnit(companyId, input.owner_id);
      if (!owner) {
        throw new ApiError(404, input.owner_type === 'project' ? 'Project not found.' : 'Unit not found.');
      }

      const file = parseDataUri(input.data);
      const document = await repository.createDocument(companyId, {
        ownerType: input.owner_type,
        ownerId: input.owner_id,
        category: input.category,
        fileName: safeFileName(input.file_name),
        mimeType: file.mimeType,
        sizeBytes: file.size,
        data: file.buffer,
        uploadedBy: req.auth.user.id,
      });

      await repository.writeAudit({
        companyId,
        userId: req.auth.user.id,
        module: 'Document',
        recordId: document.id,
        event: 'created',
        before: null,
        after: {
          owner_type: document.owner_type,
          owner_id: document.owner_id,
          file_name: document.file_name,
          category: document.category,
        },
        ip: clientIp(req),
      });

      res.status(201).json({ data: document });
    }),
  );

  router.delete(
    '/:id',
    auth.requireAuth,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const document = await repository.getDocument(companyId, req.params.id);
      if (!document) throw new ApiError(404, 'Document not found.');
      assertPermission(req, document.owner_type, 'edit');

      await repository.deleteDocument(companyId, document.id);
      await repository.writeAudit({
        companyId,
        userId: req.auth.user.id,
        module: 'Document',
        recordId: document.id,
        event: 'deleted',
        before: {
          owner_type: document.owner_type,
          owner_id: document.owner_id,
          file_name: document.file_name,
          category: document.category,
        },
        after: null,
        ip: clientIp(req),
      });

      res.json({ data: { ok: true } });
    }),
  );

  return router;
}

export default createDocumentsRouter;
