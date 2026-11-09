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

// Pretty-print an E.164 US number as (555) 555-5555. Anything that isn't a
// 10-digit US number is returned unchanged.
export function formatPhoneDisplay(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return String(phone || '');
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export type LinkedPhoneSource = 'primary' | 'additional' | 'team' | 'onboarding';

export type LinkedPhoneNumber = {
  name: string;
  phoneNumber: string; // normalized E.164
  display: string;
  source: LinkedPhoneSource;
  sourceLabel: string;
  receivesTexts: boolean;
  recipientId?: string; // additionalSmsRecipients entry id, for removal
  userId?: string; // team member's user id
};

// Every phone number on file for a client, whichever corner of the app it
// came from: the primary contact, the additional text recipients, any team
// member accounts under this client, and the number given on the onboarding
// form (which clients sometimes fill in differently from their login).
//
// De-duplicated by normalized number; the first source to claim a number
// wins, so a team member who is already a text recipient shows up once and
// is marked as receiving texts.
export function getClientPhoneNumbers(client: any, teamMembers: any[] = []): LinkedPhoneNumber[] {
  if (!client) return [];

  const textRecipients = new Set(getClientSmsNumbers(client));

  const candidates: Array<Omit<LinkedPhoneNumber, 'display' | 'receivesTexts'> & { phoneNumber: string }> = [];

  const primaryName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.companyName || 'Primary contact';
  if (client.phoneNumber) {
    candidates.push({
      name: primaryName,
      phoneNumber: client.phoneNumber,
      source: 'primary',
      sourceLabel: 'Primary',
    });
  }

  ((client.additionalSmsRecipients || []) as AdditionalSmsRecipient[]).forEach((r) => {
    if (!r?.phoneNumber) return;
    candidates.push({
      name: (r.name || '').trim() || 'Additional recipient',
      phoneNumber: r.phoneNumber,
      source: 'additional',
      sourceLabel: 'Additional',
      recipientId: r.id,
    });
  });

  teamMembers.forEach((member) => {
    if (!member?.phoneNumber) return;
    candidates.push({
      name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'Team member',
      phoneNumber: member.phoneNumber,
      source: 'team',
      sourceLabel: 'Team member',
      userId: member.id,
    });
  });

  const onboardingPhone = client.onboardingAnswers?.phoneNumber;
  if (onboardingPhone) {
    candidates.push({
      name: client.onboardingAnswers?.contactName || primaryName,
      phoneNumber: onboardingPhone,
      source: 'onboarding',
      sourceLabel: 'Onboarding form',
    });
  }

  const seen = new Set<string>();
  const numbers: LinkedPhoneNumber[] = [];
  for (const candidate of candidates) {
    const raw = String(candidate.phoneNumber || '').trim();
    if (raw.replace(/\D/g, '').length < 10) continue;
    const phoneNumber = formatPhoneE164(raw);
    if (seen.has(phoneNumber)) continue;
    seen.add(phoneNumber);
    numbers.push({
      ...candidate,
      phoneNumber,
      display: formatPhoneDisplay(phoneNumber),
      receivesTexts: textRecipients.has(phoneNumber),
    });
  }
  return numbers;
}
