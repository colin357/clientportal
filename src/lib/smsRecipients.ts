// Who receives a client's portal text messages.
//
// A client's texts go to their own phone number plus any "additional
// recipients" the team added on the client's details page in the admin
// portal. Those extras live on the client's user doc as:
//
//   additionalSmsRecipients: [{ id, name, phoneNumber }]
//
// Shared by the admin UI (src/app/page.tsx) and the server-side senders so
// both fan out to the same list.

export type SmsRecipient = {
  name: string;
  phoneNumber: string;
  primary: boolean;
};

export type AdditionalSmsRecipient = {
  id: string;
  name?: string;
  phoneNumber?: string;
};

export const formatPhoneE164 = (phone: string): string => {
  // Remove all non-digit characters
  const digits = String(phone || '').replace(/\D/g, '');

  // If it's already 11 digits starting with 1, format it
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it's 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it already starts with +1, return as is
  if (String(phone || '').startsWith('+1')) {
    return phone;
  }

  // Default: assume 10 digits and add +1
  return `+1${digits.slice(-10)}`;
};

// Primary contact first, then the additional recipients. Numbers are
// normalized to E.164 and de-duplicated; anything without at least 10 digits
// is dropped so blank / placeholder values never reach Twilio.
export function getClientSmsRecipients(client: any): SmsRecipient[] {
  if (!client) return [];

  const entries = [
    {
      name: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.companyName || '',
      phoneNumber: client.phoneNumber,
      primary: true,
    },
    ...((client.additionalSmsRecipients || []) as AdditionalSmsRecipient[]).map((r) => ({
      name: (r?.name || '').trim(),
      phoneNumber: r?.phoneNumber,
      primary: false,
    })),
  ];

  const seen = new Set<string>();
  const recipients: SmsRecipient[] = [];
  for (const entry of entries) {
    const raw = String(entry.phoneNumber || '').trim();
    if (raw.replace(/\D/g, '').length < 10) continue;
    const phoneNumber = formatPhoneE164(raw);
    if (seen.has(phoneNumber)) continue;
    seen.add(phoneNumber);
    recipients.push({ name: entry.name, phoneNumber, primary: entry.primary });
  }
  return recipients;
}

// Just the phone numbers, for callers that only need To: values.
export function getClientSmsNumbers(client: any): string[] {
  return getClientSmsRecipients(client).map((r) => r.phoneNumber);
}
