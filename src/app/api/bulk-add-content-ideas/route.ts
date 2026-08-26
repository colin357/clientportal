import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getServerDb } from '@/lib/firebaseServer';

// ============================================================================
// POST /api/bulk-add-content-ideas
// ----------------------------------------------------------------------------
// Mass-add content ideas to clients' portals in a single request, instead of
// entering them one by one in the admin UI. No authentication is required.
//
// Each idea is matched to a client by one of (checked in this order):
//   - clientId      : the client's user document id
//   - clientEmail   : the client's email (case-insensitive)
//   - companyName   : the client's company name (case-insensitive)
//
// Two request body shapes are supported:
//
//   1) Flat list — each idea carries its own client reference:
//      {
//        "ideas": [
//          { "clientEmail": "jane@x.com", "title": "...", "content": "...",
//            "description": "...", "type": "social", "fileLink": "..." },
//          ...
//        ]
//      }
//
//   2) Grouped by client — handy for the weekly "8 ideas per client" workflow:
//      {
//        "clients": [
//          {
//            "clientEmail": "jane@x.com",
//            "ideas": [ { "title": "...", "content": "..." }, ... ]
//          },
//          ...
//        ]
//      }
//
// A bare array in the request body is treated as the flat "ideas" list.
//
// Per idea fields:
//   - title       (required)
//   - content     (required)
//   - description (optional)
//   - type        (optional, default "content-idea"; e.g. social/blog/email)
//   - fileLink    (optional)
//   - status      (optional; defaults to the client's approval group behavior:
//                  auto-approve clients get "approved", others get "pending")
//
// Response: a per-item summary so partial failures are visible.
// ============================================================================

type RawIdea = {
  clientId?: string;
  clientEmail?: string;
  companyName?: string;
  title?: string;
  content?: string;
  description?: string;
  type?: string;
  fileLink?: string;
  status?: string;
};

const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// Flatten either supported body shape into a single list of raw ideas, each
// carrying its own client reference.
function normalizeIdeas(body: any): RawIdea[] {
  const ideas: RawIdea[] = [];

  const list = Array.isArray(body) ? body : body?.ideas;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && typeof item === 'object') ideas.push(item as RawIdea);
    }
  }

  if (Array.isArray(body?.clients)) {
    for (const client of body.clients) {
      if (!client || typeof client !== 'object') continue;
      const { ideas: clientIdeas, ...clientRef } = client;
      if (!Array.isArray(clientIdeas)) continue;
      for (const item of clientIdeas) {
        if (item && typeof item === 'object') {
          // Idea-level client fields win over the group-level reference.
          ideas.push({ ...clientRef, ...item } as RawIdea);
        }
      }
    }
  }

  return ideas;
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = getServerDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Firebase is not configured on the server' },
      { status: 500 }
    );
  }

  const rawIdeas = normalizeIdeas(body);
  if (rawIdeas.length === 0) {
    return NextResponse.json(
      {
        error:
          'No content ideas found. Provide an "ideas" array, a "clients" array, or a bare array of ideas.',
      },
      { status: 400 }
    );
  }

  // Load clients once and build lookup maps for id / email / company.
  let usersSnapshot;
  try {
    usersSnapshot = await getDocs(collection(db, 'users'));
  } catch (e: any) {
    console.error('bulk-add-content-ideas: failed to load users', e);
    return NextResponse.json(
      { error: 'Failed to load clients from the database' },
      { status: 500 }
    );
  }

  const byId = new Map<string, any>();
  const byEmail = new Map<string, any>();
  const byCompany = new Map<string, any>();
  usersSnapshot.docs.forEach((d) => {
    const user = { ...d.data(), id: d.id } as any;
    byId.set(d.id, user);
    if (user.email) byEmail.set(String(user.email).toLowerCase(), user);
    if (user.companyName) byCompany.set(String(user.companyName).toLowerCase(), user);
  });

  const resolveClient = (idea: RawIdea) => {
    const id = asString(idea.clientId);
    if (id && byId.has(id)) return byId.get(id);
    const email = asString(idea.clientEmail).toLowerCase();
    if (email && byEmail.has(email)) return byEmail.get(email);
    const company = asString(idea.companyName).toLowerCase();
    if (company && byCompany.has(company)) return byCompany.get(company);
    return null;
  };

  const createdAt = new Date().toISOString();
  const results: Array<{
    index: number;
    status: 'created' | 'skipped';
    contentId?: string;
    clientId?: string;
    clientName?: string;
    title?: string;
    error?: string;
  }> = [];

  // Build valid content documents; record validation problems as skips.
  const toWrite: Array<{ index: number; item: any; client: any }> = [];
  rawIdeas.forEach((idea, index) => {
    const client = resolveClient(idea);
    if (!client) {
      results.push({
        index,
        status: 'skipped',
        title: asString(idea.title) || undefined,
        error:
          'Client not found. Provide a valid clientId, clientEmail, or companyName.',
      });
      return;
    }

    const title = asString(idea.title);
    const content = asString(idea.content);
    if (!title || !content) {
      results.push({
        index,
        status: 'skipped',
        clientId: client.id,
        clientName: client.companyName,
        title: title || undefined,
        error: 'Each idea requires a non-empty "title" and "content".',
      });
      return;
    }

    const status =
      asString(idea.status) ||
      (client.approvalGroup === 'auto-approve' ? 'approved' : 'pending');

    const id = `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
    const contentDoc = {
      id,
      clientId: client.id,
      type: asString(idea.type) || 'content-idea',
      title,
      description: asString(idea.description),
      content,
      fileLink: asString(idea.fileLink),
      status,
      createdAt,
    };

    toWrite.push({ index, item: contentDoc, client });
  });

  // Persist all valid ideas in parallel, capturing per-item failures.
  await Promise.all(
    toWrite.map(async ({ index, item, client }) => {
      try {
        await setDoc(doc(db, 'content', item.id), item);
        results.push({
          index,
          status: 'created',
          contentId: item.id,
          clientId: client.id,
          clientName: client.companyName,
          title: item.title,
        });
      } catch (e: any) {
        console.error(`bulk-add-content-ideas: failed to save idea #${index}`, e);
        results.push({
          index,
          status: 'skipped',
          clientId: client.id,
          clientName: client.companyName,
          title: item.title,
          error: 'Failed to save to the database.',
        });
      }
    })
  );

  results.sort((a, b) => a.index - b.index);
  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.length - created;

  return NextResponse.json({
    success: true,
    received: rawIdeas.length,
    created,
    skipped,
    results,
  });
}
