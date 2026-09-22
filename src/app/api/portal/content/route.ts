// ============================================================================
// /api/portal/content — read and update content items via the API
// ----------------------------------------------------------------------------
// GET   — list content items. Optional filters:
//           clientId / clientEmail / companyName — one client's content
//           ?status=pending|approved|...          — by status
//           ?type=social|blog|email|content-idea  — by type
// PATCH — update a content item by id: { "id": "...", ...fieldsToChange }
//         (title, content, description, status, type, fileLink)
//
// To CREATE content ideas, use the existing POST /api/bulk-add-content-ideas
// endpoint — it supports flat and grouped-by-client bodies.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import {
  asString,
  checkApiKey,
  CLIENT_NOT_FOUND,
  loadClients,
  requireDb,
  resolveClientFromQuery,
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

  const status = asString(params.get('status'));
  const type = asString(params.get('type'));

  const snapshot = await getDocs(collection(db, 'content'));
  let items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

  if (client) items = items.filter((i) => i.clientId === client.id);
  if (status) items = items.filter((i) => i.status === status);
  if (type) items = items.filter((i) => i.type === type);

  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const enriched = items.map((i) => ({
    ...i,
    clientName: lookup.byId.get(i.clientId)?.companyName || null,
  }));

  return NextResponse.json({ count: enriched.length, content: enriched });
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
    return NextResponse.json({ error: 'Missing content "id".' }, { status: 400 });
  }

  const ref = doc(db, 'content', id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    return NextResponse.json({ error: `Content item "${id}" not found.` }, { status: 404 });
  }

  const updates: Record<string, any> = {};
  for (const field of ['title', 'content', 'description', 'status', 'type', 'fileLink']) {
    if (body[field] !== undefined) {
      const value = asString(body[field]);
      if ((field === 'title' || field === 'content') && !value) {
        return NextResponse.json({ error: `"${field}" cannot be empty.` }, { status: 400 });
      }
      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 });
  }

  updates.updatedAt = new Date().toISOString();
  const updated = { ...existing.data(), ...updates, id };
  await setDoc(ref, updated);

  return NextResponse.json({ success: true, content: updated });
}
