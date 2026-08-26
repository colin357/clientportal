// ============================================================================
// /api/portal/tasks — manage client tasks via the API
// ----------------------------------------------------------------------------
// GET    — list tasks. Optional filters: clientId / clientEmail / companyName,
//          and ?status=todo|in_progress|under_review|done
// POST   — create one or more tasks. Body is a single task object, a bare
//          array of tasks, or { "tasks": [...] }. Each task needs a client
//          reference (clientId / clientEmail / companyName) and a title.
// PATCH  — update an existing task by id: { "id": "...", ...fieldsToChange }
// DELETE — delete a task: ?id=... or body { "id": "..." }
//
// Task fields (matching the portal UI's clientTasks documents):
//   title        (required on create)
//   instructions (optional, shown to the client)
//   tag          (optional, e.g. "Content", "Onboarding"; default "General")
//   status       (optional: todo | in_progress | under_review | done;
//                 default "todo")
//   dueDate      (optional, "YYYY-MM-DD")
//   dueInDays    (optional alternative to dueDate: days from today)
//   linkPage     (optional deep link into the portal: onboarding-form |
//                 content | settings | social | calendar | crm | ai-generator)
//   notes        (optional, free text)
//   order        (optional number; defaults after the client's existing tasks)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  asString,
  checkApiKey,
  CLIENT_NOT_FOUND,
  isDateString,
  loadClients,
  requireDb,
  resolveClient,
  resolveClientFromQuery,
  uniqueId,
} from '@/lib/portalApi';

const TASK_STATUSES = ['todo', 'in_progress', 'under_review', 'done'];

const TASK_LINK_LABELS: Record<string, string> = {
  content: 'Content Review',
  settings: 'Settings',
  social: 'Social Media',
  calendar: 'Calendar',
  crm: 'CRM',
  'ai-generator': 'AI Generator',
};

// Mirrors buildTaskLink in the portal UI.
function buildTaskLink(page: string) {
  if (!page) return null;
  if (page === 'onboarding-form')
    return { type: 'onboarding-form', label: 'Open Onboarding Form' };
  const label = TASK_LINK_LABELS[page] || page;
  return { type: 'page', page, label: `Open ${label}` };
}

const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export async function GET(request: NextRequest) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const dbResult = requireDb();
  if ('error' in dbResult) return dbResult.error;
  const { db } = dbResult;

  const lookup = await loadClients(db);
  const client = resolveClientFromQuery(lookup, request.nextUrl.searchParams);
  if (client === null) return CLIENT_NOT_FOUND;

  const statusFilter = asString(request.nextUrl.searchParams.get('status'));

  const snapshot = await getDocs(collection(db, 'clientTasks'));
  let tasks = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

  if (client) tasks = tasks.filter((t) => t.clientId === client.id);
  if (statusFilter) tasks = tasks.filter((t) => t.status === statusFilter);

  tasks.sort(
    (a, b) =>
      (a.clientId || '').localeCompare(b.clientId || '') ||
      (a.order || 0) - (b.order || 0)
  );

  return NextResponse.json({ count: tasks.length, tasks });
}

export async function POST(request: NextRequest) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const dbResult = requireDb();
  if ('error' in dbResult) return dbResult.error;
  const { db } = dbResult;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawTasks: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.tasks)
    ? body.tasks
    : body && typeof body === 'object'
    ? [body]
    : [];

  if (rawTasks.length === 0) {
    return NextResponse.json(
      { error: 'No tasks found. Provide a task object, a "tasks" array, or a bare array.' },
      { status: 400 }
    );
  }

  const lookup = await loadClients(db);
  const tasksSnapshot = await getDocs(collection(db, 'clientTasks'));
  const existingTasks = tasksSnapshot.docs.map((d) => d.data()) as any[];
  const taskCountByClient = new Map<string, number>();
  for (const t of existingTasks) {
    taskCountByClient.set(t.clientId, (taskCountByClient.get(t.clientId) || 0) + 1);
  }

  const createdAt = new Date().toISOString();
  const results: any[] = [];

  await Promise.all(
    rawTasks.map(async (raw, index) => {
      if (!raw || typeof raw !== 'object') {
        results.push({ index, status: 'skipped', error: 'Invalid task entry.' });
        return;
      }

      const client = resolveClient(lookup, raw);
      if (!client) {
        results.push({
          index,
          status: 'skipped',
          title: asString(raw.title) || undefined,
          error: 'Client not found. Provide a valid clientId, clientEmail, or companyName.',
        });
        return;
      }

      const title = asString(raw.title);
      if (!title) {
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          error: 'Each task requires a non-empty "title".',
        });
        return;
      }

      const status = asString(raw.status) || 'todo';
      if (!TASK_STATUSES.includes(status)) {
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          title,
          error: `Invalid status "${status}". Use one of: ${TASK_STATUSES.join(', ')}.`,
        });
        return;
      }

      let dueDate = asString(raw.dueDate);
      if (dueDate && !isDateString(dueDate)) {
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          title,
          error: 'dueDate must be formatted as YYYY-MM-DD.',
        });
        return;
      }
      if (!dueDate && typeof raw.dueInDays === 'number') {
        dueDate = daysFromNow(raw.dueInDays);
      }

      const nextOrder = 100 + (taskCountByClient.get(client.id) || 0);
      taskCountByClient.set(client.id, (taskCountByClient.get(client.id) || 0) + 1);

      const task = {
        id: asString(raw.id) || uniqueId(index),
        clientId: client.id,
        title,
        instructions: asString(raw.instructions),
        tag: asString(raw.tag) || 'General',
        status,
        link: buildTaskLink(asString(raw.linkPage)),
        dueDate: dueDate || null,
        notes: asString(raw.notes),
        order: typeof raw.order === 'number' ? raw.order : nextOrder,
        createdAt,
      };

      try {
        await setDoc(doc(db, 'clientTasks', task.id), task);
        results.push({
          index,
          status: 'created',
          taskId: task.id,
          clientId: client.id,
          clientName: client.companyName,
          title,
        });
      } catch (e: any) {
        console.error(`portal/tasks: failed to save task #${index}`, e);
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          title,
          error: 'Failed to save to the database.',
        });
      }
    })
  );

  results.sort((a, b) => a.index - b.index);
  const created = results.filter((r) => r.status === 'created').length;

  return NextResponse.json({
    success: true,
    received: rawTasks.length,
    created,
    skipped: results.length - created,
    results,
  });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const dbResult = requireDb();
  if ('error' in dbResult) return dbResult.error;
  const { db } = dbResult;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = asString(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'Missing task "id".' }, { status: 400 });
  }

  const ref = doc(db, 'clientTasks', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    return NextResponse.json({ error: `Task "${id}" not found.` }, { status: 404 });
  }

  const updates: Record<string, any> = {};

  if (body.title !== undefined) {
    const title = asString(body.title);
    if (!title) return NextResponse.json({ error: '"title" cannot be empty.' }, { status: 400 });
    updates.title = title;
  }
  if (body.status !== undefined) {
    const status = asString(body.status);
    if (!TASK_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Use one of: ${TASK_STATUSES.join(', ')}.` },
        { status: 400 }
      );
    }
    updates.status = status;
  }
  if (body.instructions !== undefined) updates.instructions = asString(body.instructions);
  if (body.notes !== undefined) updates.notes = asString(body.notes);
  if (body.tag !== undefined) updates.tag = asString(body.tag);
  if (body.order !== undefined && typeof body.order === 'number') updates.order = body.order;
  if (body.linkPage !== undefined) updates.link = buildTaskLink(asString(body.linkPage));
  if (body.dueDate !== undefined) {
    const dueDate = asString(body.dueDate);
    if (dueDate && !isDateString(dueDate)) {
      return NextResponse.json({ error: 'dueDate must be formatted as YYYY-MM-DD.' }, { status: 400 });
    }
    updates.dueDate = dueDate || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
  }

  updates.updatedAt = new Date().toISOString();
  const updated = { ...existing.data(), ...updates, id };
  await setDoc(ref, updated);

  return NextResponse.json({ success: true, task: updated });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const dbResult = requireDb();
  if ('error' in dbResult) return dbResult.error;
  const { db } = dbResult;

  let id = asString(request.nextUrl.searchParams.get('id'));
  if (!id) {
    try {
      const body = await request.json();
      id = asString(body?.id);
    } catch {
      // no body — fall through to the missing-id error
    }
  }
  if (!id) {
    return NextResponse.json({ error: 'Missing task "id".' }, { status: 400 });
  }

  const ref = doc(db, 'clientTasks', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    return NextResponse.json({ error: `Task "${id}" not found.` }, { status: 404 });
  }

  await deleteDoc(ref);
  return NextResponse.json({ success: true, deleted: id });
}
