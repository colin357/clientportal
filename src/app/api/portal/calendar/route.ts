// ============================================================================
// /api/portal/calendar — read and update clients' content calendars
// ----------------------------------------------------------------------------
// GET    — read calendar events. Optional filters:
//            clientId / clientEmail / companyName — one client's calendar
//            ?from=YYYY-MM-DD&to=YYYY-MM-DD       — date range (inclusive)
//            ?type=social|blog|email|...           — event type
// POST   — schedule one or more events. Body is a single event object, a bare
//          array, or { "events": [...] }. Each event needs a client reference
//          (clientId / clientEmail / companyName), a date (YYYY-MM-DD), and
//          either a title or a contentId pointing at an existing content item
//          (title/description/type are then copied from that item).
// PATCH  — update an event by id: { "id": "...", ...fieldsToChange }
//          (e.g. move it: { "id": "...", "date": "2026-08-01" })
// DELETE — remove an event: ?id=... or body { "id": "..." }
//
// Event fields (matching the portal UI's calendarEvents documents):
//   date        (required, "YYYY-MM-DD")
//   title       (required unless contentId is given)
//   description (optional)
//   type        (optional, e.g. "social", "blog", "email"; default "social")
//   contentId   (optional link to a document in the content collection)
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

export async function GET(request: NextRequest) {
  const unauthorized = checkApiKey(request);
  if (unauthorized) return unauthorized;

  const dbResult = requireDb();
  if ('error' in dbResult) return dbResult.error;
  const { db } = dbResult;

  const params = request.nextUrl.searchParams;
  const lookup = await loadClients(db);
  const client = resolveClientFromQuery(lookup, params);
  if (client === null) return CLIENT_NOT_FOUND;

  const from = asString(params.get('from'));
  const to = asString(params.get('to'));
  const type = asString(params.get('type'));
  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value && !isDateString(value)) {
      return NextResponse.json(
        { error: `"${name}" must be formatted as YYYY-MM-DD.` },
        { status: 400 }
      );
    }
  }

  const snapshot = await getDocs(collection(db, 'calendarEvents'));
  let events = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

  if (client) events = events.filter((e) => e.clientId === client.id);
  if (from) events = events.filter((e) => e.date && e.date >= from);
  if (to) events = events.filter((e) => e.date && e.date <= to);
  if (type) events = events.filter((e) => e.type === type);

  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Attach client names so the calendar is readable without a second lookup.
  const enriched = events.map((e) => ({
    ...e,
    clientName: lookup.byId.get(e.clientId)?.companyName || null,
  }));

  return NextResponse.json({ count: enriched.length, events: enriched });
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

  const rawEvents: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.events)
    ? body.events
    : body && typeof body === 'object'
    ? [body]
    : [];

  if (rawEvents.length === 0) {
    return NextResponse.json(
      { error: 'No events found. Provide an event object, an "events" array, or a bare array.' },
      { status: 400 }
    );
  }

  const lookup = await loadClients(db);

  // Load content once so events can be created from a contentId.
  const contentSnapshot = await getDocs(collection(db, 'content'));
  const contentById = new Map<string, any>();
  contentSnapshot.docs.forEach((d) =>
    contentById.set(d.id, { ...d.data(), id: d.id })
  );

  const createdAt = new Date().toISOString();
  const results: any[] = [];

  await Promise.all(
    rawEvents.map(async (raw, index) => {
      if (!raw || typeof raw !== 'object') {
        results.push({ index, status: 'skipped', error: 'Invalid event entry.' });
        return;
      }

      const contentId = asString(raw.contentId);
      const contentItem = contentId ? contentById.get(contentId) : null;
      if (contentId && !contentItem) {
        results.push({
          index,
          status: 'skipped',
          error: `Content item "${contentId}" not found.`,
        });
        return;
      }

      // Client comes from the request, or from the linked content item.
      let client = resolveClient(lookup, raw);
      if (!client && contentItem) client = lookup.byId.get(contentItem.clientId) || null;
      if (!client) {
        results.push({
          index,
          status: 'skipped',
          title: asString(raw.title) || undefined,
          error: 'Client not found. Provide a valid clientId, clientEmail, or companyName.',
        });
        return;
      }

      const date = asString(raw.date);
      if (!date || !isDateString(date)) {
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          error: 'Each event requires a "date" formatted as YYYY-MM-DD.',
        });
        return;
      }

      const title = asString(raw.title) || asString(contentItem?.title);
      if (!title) {
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          error: 'Each event requires a "title" (or a contentId to copy it from).',
        });
        return;
      }

      const event = {
        id: asString(raw.id) || uniqueId(index),
        clientId: client.id,
        title,
        description: asString(raw.description) || asString(contentItem?.description),
        date,
        type: asString(raw.type) || asString(contentItem?.type) || 'social',
        contentId: contentId || null,
        createdAt,
      };

      try {
        await setDoc(doc(db, 'calendarEvents', event.id), event);
        results.push({
          index,
          status: 'created',
          eventId: event.id,
          clientId: client.id,
          clientName: client.companyName,
          title,
          date,
        });
      } catch (e: any) {
        console.error(`portal/calendar: failed to save event #${index}`, e);
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
    received: rawEvents.length,
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
    return NextResponse.json({ error: 'Missing event "id".' }, { status: 400 });
  }

  const ref = doc(db, 'calendarEvents', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    return NextResponse.json({ error: `Event "${id}" not found.` }, { status: 404 });
  }

  const updates: Record<string, any> = {};
  if (body.date !== undefined) {
    const date = asString(body.date);
    if (!isDateString(date)) {
      return NextResponse.json({ error: '"date" must be formatted as YYYY-MM-DD.' }, { status: 400 });
    }
    updates.date = date;
  }
  if (body.title !== undefined) {
    const title = asString(body.title);
    if (!title) return NextResponse.json({ error: '"title" cannot be empty.' }, { status: 400 });
    updates.title = title;
  }
  if (body.description !== undefined) updates.description = asString(body.description);
  if (body.type !== undefined) updates.type = asString(body.type);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
  }

  updates.updatedAt = new Date().toISOString();
  const updated = { ...existing.data(), ...updates, id };
  await setDoc(ref, updated);

  return NextResponse.json({ success: true, event: updated });
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
    return NextResponse.json({ error: 'Missing event "id".' }, { status: 400 });
  }

  const ref = doc(db, 'calendarEvents', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    return NextResponse.json({ error: `Event "${id}" not found.` }, { status: 404 });
  }

  await deleteDoc(ref);
  return NextResponse.json({ success: true, deleted: id });
}
