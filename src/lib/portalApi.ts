// Shared helpers for the portal management API (/api/portal/*).
//
// These endpoints let the team update the portal programmatically via simple
// HTTP requests: add client tasks, manage content calendars, read data, etc.
// They all share the same conventions:
//
//   - Clients can be referenced by `clientId`, `clientEmail` (case-insensitive)
//     or `companyName` (case-insensitive) — checked in that order.
//   - If the PORTAL_API_KEY env var is set, every request must include it in
//     an `x-api-key` header (or `?apiKey=` query param). If it's unset the
//     endpoints are open, matching the rest of the app's current posture.

import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, Firestore } from 'firebase/firestore';
import { getServerDb } from '@/lib/firebaseServer';

export type PortalClient = {
  id: string;
  email?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  approvalGroup?: string;
  [key: string]: any;
};

// Returns a NextResponse error if the request is not authorized, or null if OK.
export function checkApiKey(request: NextRequest): NextResponse | null {
  const requiredKey = process.env.PORTAL_API_KEY;
  if (!requiredKey) return null;

  const provided =
    request.headers.get('x-api-key') ||
    request.nextUrl.searchParams.get('apiKey') ||
    '';
  if (provided === requiredKey) return null;

  return NextResponse.json(
    { error: 'Unauthorized. Provide a valid x-api-key header.' },
    { status: 401 }
  );
}

export function requireDb(): { db: Firestore } | { error: NextResponse } {
  const db = getServerDb();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: 'Firebase is not configured on the server' },
        { status: 500 }
      ),
    };
  }
  return { db };
}

export const asString = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : '';

export type ClientLookup = {
  byId: Map<string, PortalClient>;
  byEmail: Map<string, PortalClient>;
  byCompany: Map<string, PortalClient>;
  all: PortalClient[];
};

// Load all clients once and build lookup maps for id / email / company.
export async function loadClients(db: Firestore): Promise<ClientLookup> {
  const snapshot = await getDocs(collection(db, 'users'));
  const byId = new Map<string, PortalClient>();
  const byEmail = new Map<string, PortalClient>();
  const byCompany = new Map<string, PortalClient>();
  const all: PortalClient[] = [];

  snapshot.docs.forEach((d) => {
    const user = { ...d.data(), id: d.id } as PortalClient;
    all.push(user);
    byId.set(d.id, user);
    if (user.email) byEmail.set(String(user.email).toLowerCase(), user);
    if (user.companyName)
      byCompany.set(String(user.companyName).toLowerCase(), user);
  });

  return { byId, byEmail, byCompany, all };
}

export function resolveClient(
  lookup: ClientLookup,
  ref: { clientId?: string; clientEmail?: string; companyName?: string }
): PortalClient | null {
  const id = asString(ref.clientId);
  if (id && lookup.byId.has(id)) return lookup.byId.get(id)!;
  const email = asString(ref.clientEmail).toLowerCase();
  if (email && lookup.byEmail.has(email)) return lookup.byEmail.get(email)!;
  const company = asString(ref.companyName).toLowerCase();
  if (company && lookup.byCompany.has(company))
    return lookup.byCompany.get(company)!;
  return null;
}

// Resolve a client from ?clientId= / ?clientEmail= / ?companyName= query
// params. Returns undefined when no client filter was provided at all.
export function resolveClientFromQuery(
  lookup: ClientLookup,
  searchParams: URLSearchParams
): PortalClient | null | undefined {
  const ref = {
    clientId: searchParams.get('clientId') || '',
    clientEmail: searchParams.get('clientEmail') || '',
    companyName: searchParams.get('companyName') || '',
  };
  if (!ref.clientId && !ref.clientEmail && !ref.companyName) return undefined;
  return resolveClient(lookup, ref);
}

export const CLIENT_NOT_FOUND = NextResponse.json(
  { error: 'Client not found. Provide a valid clientId, clientEmail, or companyName.' },
  { status: 404 }
);

// YYYY-MM-DD validation for dueDate / calendar dates.
export const isDateString = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function uniqueId(index: number): string {
  return `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
}
