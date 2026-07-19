// ============================================================================
// GET /api/portal/clients — list clients (users) so API callers can find the
// clientId / email / companyName to reference in other portal endpoints.
//
// Optional filters: clientId / clientEmail / companyName (returns just that
// client, with full detail). The list view returns a safe summary only.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
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

  const lookup = await loadClients(db);
  const client = resolveClientFromQuery(lookup, request.nextUrl.searchParams);
  if (client === null) return CLIENT_NOT_FOUND;

  if (client) {
    // Single-client detail (omit anything credential-like just in case).
    const { password, socialLogins, ...safe } = client as any;
    return NextResponse.json({ client: safe });
  }

  const clients = lookup.all
    .map((u) => ({
      id: u.id,
      email: u.email || null,
      companyName: u.companyName || null,
      firstName: u.firstName || null,
      lastName: u.lastName || null,
      approvalGroup: u.approvalGroup || null,
      tags: (u as any).tags || [],
    }))
    .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

  return NextResponse.json({ count: clients.length, clients });
}
