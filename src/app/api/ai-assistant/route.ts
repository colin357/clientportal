import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/firebaseServer';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

const SHARED_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description:
        'Get tasks. Admins can filter by client. Returns a list of tasks with title, status, due date, instructions, and tag.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to filter by (admin only — omit to see all clients\' tasks)',
          },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'under_review', 'done'],
            description: 'Filter by task status',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description:
        'Create a new task. Admins must specify which client the task is for.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to create the task for (required for admins, ignored for clients)',
          },
          title: { type: 'string', description: 'The task title' },
          instructions: {
            type: 'string',
            description: 'Detailed instructions or notes for the task',
          },
          tag: {
            type: 'string',
            description:
              'Category tag (e.g. "Content", "General", "Onboarding", "Getting Started")',
          },
          dueDate: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_task',
      description:
        'Update an existing task. Can change title, status, instructions, or notes.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task ID to update' },
          title: { type: 'string', description: 'New title' },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'under_review', 'done'],
            description: 'New status',
          },
          instructions: { type: 'string', description: 'New instructions' },
          notes: { type: 'string', description: 'New notes' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_content',
      description:
        'Get content items (social posts, blog posts, emails, content ideas). Can filter by type, status, and client.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to filter by (admin only)',
          },
          type: {
            type: 'string',
            enum: ['social', 'blog', 'email', 'content-idea'],
            description: 'Filter by content type',
          },
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
            description: 'Filter by approval status',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_content_idea',
      description:
        'Create a new content idea (social post, blog post, or email campaign). Appears in the Content Review section for approval.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to create content for (required for admins)',
          },
          type: {
            type: 'string',
            enum: ['social', 'blog', 'email', 'content-idea'],
            description: 'The content type',
          },
          title: { type: 'string', description: 'Content title or headline' },
          description: {
            type: 'string',
            description: 'Brief description or summary',
          },
          content: {
            type: 'string',
            description: 'The full content body',
          },
        },
        required: ['type', 'title', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_calendar_events',
      description:
        'Get scheduled content calendar events. Can filter by date range, type, and client.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to filter by (admin only)',
          },
          from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD). Defaults to today.',
          },
          to: {
            type: 'string',
            description:
              'End date filter (YYYY-MM-DD). Defaults to 30 days from now.',
          },
          type: {
            type: 'string',
            enum: ['social', 'blog', 'email'],
            description: 'Filter by content type',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_calendar_event',
      description:
        'Schedule content on the calendar. Creates a new calendar event.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID to schedule for (required for admins)',
          },
          title: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description' },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format',
          },
          type: {
            type: 'string',
            enum: ['social', 'blog', 'email'],
            description: 'Content type (defaults to "social")',
          },
        },
        required: ['title', 'date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_client_profile',
      description:
        'Get a client\'s profile information including company name, onboarding answers, industry, brand voice, and other details. Admins can specify which client.',
      parameters: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Client ID (admin can specify; clients get their own profile)',
          },
        },
      },
    },
  },
];

const ADMIN_ONLY_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_clients',
      description:
        'List all clients in the portal. Returns their names, company names, and IDs. Use this to find a client ID before performing actions on their behalf.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by name or company (case-insensitive)',
          },
        },
      },
    },
  },
];

function uniqueId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function resolveClientId(
  isAdmin: boolean,
  sessionClientId: string,
  argsClientId?: string
): string {
  if (isAdmin && argsClientId) return argsClientId;
  return sessionClientId;
}

async function executeTool(
  toolName: string,
  args: Record<string, any>,
  sessionClientId: string,
  isAdmin: boolean,
  db: any
): Promise<any> {
  switch (toolName) {
    case 'list_clients': {
      if (!isAdmin) return { error: 'Only admins can list clients' };
      const snapshot = await getDocs(collection(db, 'users'));
      let clients = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          companyName: data.companyName || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          onboarded: data.onboarded || false,
          tags: data.tags || [],
        };
      });

      if (args.search) {
        const q = args.search.toLowerCase();
        clients = clients.filter(
          (c) =>
            c.companyName.toLowerCase().includes(q) ||
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        );
      }

      return { count: clients.length, clients };
    }

    case 'get_tasks': {
      const snapshot = await getDocs(collection(db, 'clientTasks'));
      let tasks = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

      const targetClientId = isAdmin ? args.clientId : sessionClientId;
      if (targetClientId) {
        tasks = tasks.filter((t) => t.clientId === targetClientId);
      }
      if (args.status) tasks = tasks.filter((t) => t.status === args.status);
      tasks.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Load client names for admin view
      let clientNames: Record<string, string> = {};
      if (isAdmin && !targetClientId) {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach((d) => {
          const data = d.data() as any;
          clientNames[d.id] = data.companyName || data.firstName || d.id;
        });
      }

      return {
        count: tasks.length,
        tasks: tasks.slice(0, 30).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          tag: t.tag,
          dueDate: t.dueDate,
          instructions: t.instructions,
          notes: t.notes,
          ...(isAdmin && !targetClientId ? { clientName: clientNames[t.clientId] || t.clientId } : {}),
        })),
      };
    }

    case 'create_task': {
      const cid = resolveClientId(isAdmin, sessionClientId, args.clientId);
      if (isAdmin && !args.clientId) {
        return { error: 'Please specify a clientId. Use list_clients to find one.' };
      }

      const snapshot = await getDocs(collection(db, 'clientTasks'));
      const clientTaskCount = snapshot.docs
        .map((d) => d.data())
        .filter((t: any) => t.clientId === cid).length;

      const task = {
        id: uniqueId(),
        clientId: cid,
        title: args.title,
        instructions: args.instructions || '',
        tag: args.tag || 'General',
        status: 'todo',
        link: null,
        dueDate: args.dueDate || null,
        notes: '',
        order: 100 + clientTaskCount,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'clientTasks', task.id), task);
      return { success: true, task: { id: task.id, title: task.title, status: task.status, dueDate: task.dueDate, tag: task.tag } };
    }

    case 'update_task': {
      const taskRef = doc(db, 'clientTasks', args.taskId);
      const existing = await getDoc(taskRef);
      if (!existing.exists()) return { error: 'Task not found' };

      const data = existing.data();
      if (!isAdmin && data.clientId !== sessionClientId) return { error: 'Task not found' };

      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (args.title) updates.title = args.title;
      if (args.status) {
        updates.status = args.status;
        if (args.status === 'done') updates.completedAt = new Date().toISOString();
      }
      if (args.instructions !== undefined) updates.instructions = args.instructions;
      if (args.notes !== undefined) updates.notes = args.notes;

      const updated = { ...data, ...updates };
      await setDoc(taskRef, updated);
      return { success: true, task: { id: args.taskId, title: updated.title, status: updated.status } };
    }

    case 'get_content': {
      const snapshot = await getDocs(collection(db, 'content'));
      let items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

      const targetClientId = isAdmin ? args.clientId : sessionClientId;
      if (targetClientId) {
        items = items.filter((i) => i.clientId === targetClientId);
      }
      if (args.type) items = items.filter((i) => i.type === args.type);
      if (args.status) items = items.filter((i) => i.status === args.status);
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      let clientNames: Record<string, string> = {};
      if (isAdmin && !targetClientId) {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach((d) => {
          const data = d.data() as any;
          clientNames[d.id] = data.companyName || data.firstName || d.id;
        });
      }

      return {
        count: items.length,
        content: items.slice(0, 20).map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          description: i.description,
          status: i.status,
          createdAt: i.createdAt,
          content: i.content?.substring(0, 300) + (i.content?.length > 300 ? '...' : ''),
          ...(isAdmin && !targetClientId ? { clientName: clientNames[i.clientId] || i.clientId } : {}),
        })),
      };
    }

    case 'create_content_idea': {
      const cid = resolveClientId(isAdmin, sessionClientId, args.clientId);
      if (isAdmin && !args.clientId) {
        return { error: 'Please specify a clientId. Use list_clients to find one.' };
      }

      const item = {
        id: uniqueId(),
        clientId: cid,
        type: args.type || 'content-idea',
        title: args.title,
        description: args.description || '',
        content: args.content,
        fileLink: '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'content', item.id), item);
      return { success: true, content: { id: item.id, type: item.type, title: item.title, status: item.status } };
    }

    case 'get_calendar_events': {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const from = args.from || today;
      const to = args.to || thirtyDaysOut;

      const snapshot = await getDocs(collection(db, 'calendarEvents'));
      let events = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];

      const targetClientId = isAdmin ? args.clientId : sessionClientId;
      if (targetClientId) {
        events = events.filter((e) => e.clientId === targetClientId);
      }

      events = events.filter((e) => e.date && e.date >= from && e.date <= to);
      if (args.type) events = events.filter((e) => e.type === args.type);
      events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      let clientNames: Record<string, string> = {};
      if (isAdmin && !targetClientId) {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach((d) => {
          const data = d.data() as any;
          clientNames[d.id] = data.companyName || data.firstName || d.id;
        });
      }

      return {
        count: events.length,
        dateRange: { from, to },
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          type: e.type,
          completed: e.completed || false,
          ...(isAdmin && !targetClientId ? { clientName: clientNames[e.clientId] || e.clientId } : {}),
        })),
      };
    }

    case 'create_calendar_event': {
      const cid = resolveClientId(isAdmin, sessionClientId, args.clientId);
      if (isAdmin && !args.clientId) {
        return { error: 'Please specify a clientId. Use list_clients to find one.' };
      }

      const event = {
        id: uniqueId(),
        clientId: cid,
        title: args.title,
        description: args.description || '',
        date: args.date,
        type: args.type || 'social',
        contentId: null,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'calendarEvents', event.id), event);
      return { success: true, event: { id: event.id, title: event.title, date: event.date, type: event.type } };
    }

    case 'get_client_profile': {
      const cid = resolveClientId(isAdmin, sessionClientId, args.clientId);
      const userDoc = await getDoc(doc(db, 'users', cid));
      if (!userDoc.exists()) return { error: 'Client not found' };
      const data = userDoc.data();
      const { password, ...safe } = data as any;
      return {
        id: cid,
        companyName: safe.companyName,
        firstName: safe.firstName,
        lastName: safe.lastName,
        email: safe.email,
        phoneNumber: safe.phoneNumber,
        onboarded: safe.onboarded,
        industry: safe.onboardingAnswers?.industry,
        targetAudience: safe.onboardingAnswers?.targetAudience,
        brandVoice: safe.onboardingAnswers?.brandVoice,
        specialties: safe.onboardingAnswers?.specialties,
        primaryMarkets: safe.onboardingAnswers?.primaryMarkets,
        pricePoint: safe.onboardingAnswers?.pricePoint,
        clientPainPoints: safe.onboardingAnswers?.clientPainPoints,
        topicsToAvoid: safe.onboardingAnswers?.topicsToAvoid,
        socialLogins: safe.socialLogins,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

const CLIENT_SYSTEM_PROMPT = `You are the AI assistant for the Own It Social client portal. You help clients manage their marketing tasks, content, and calendar.

You have access to tools that let you read and write data in the portal. Use them when the user asks you to do something — don't just describe what they should do.

Guidelines:
- Be conversational, friendly, and concise.
- When creating content ideas, write high-quality marketing copy tailored to the client's industry and audience. Use their onboarding data (call get_client_profile) for personalization.
- When listing items, format them clearly but briefly.
- For dates, today is ${new Date().toISOString().split('T')[0]}.
- If the user asks about something vague, clarify before taking action.
- After creating something, confirm what was created with key details.
- You can handle multiple actions in one conversation turn if the user asks for several things.
- Don't expose internal IDs to the user unless they ask.
- Write like a real person — avoid AI clichés like "dive into", "leverage", "game-changer", etc.`;

const ADMIN_SYSTEM_PROMPT = `You are the AI assistant for the Own It Social admin portal. You help the admin team manage clients, tasks, content, and calendars across ALL clients.

You have access to tools that let you read and write data in the portal. Use them when the user asks you to do something — don't just describe what they should do.

Guidelines:
- Be conversational, friendly, and concise.
- You can see and manage ALL clients. Use list_clients to find a client before taking actions on their behalf.
- When creating content ideas, write high-quality marketing copy tailored to the specific client's industry and audience. Call get_client_profile for personalization.
- When the user refers to a client by name, use list_clients to find them, then use the client's ID for subsequent tool calls.
- When listing items across clients, include the client name for context.
- For dates, today is ${new Date().toISOString().split('T')[0]}.
- If the user asks about something vague, clarify before taking action.
- After creating something, confirm what was created with key details.
- You can handle multiple actions in one conversation turn.
- Don't expose internal IDs to the user unless they ask — use client/company names instead.
- Write like a real person — avoid AI clichés like "dive into", "leverage", "game-changer", etc.`;

const MAX_TOOL_ROUNDS = 8;

export async function POST(request: NextRequest) {
  try {
    const { messages, clientId, isAdmin } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const db = getServerDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = isAdmin ? ADMIN_SYSTEM_PROMPT : CLIENT_SYSTEM_PROMPT;
    const tools = isAdmin
      ? [...SHARED_TOOLS, ...ADMIN_ONLY_TOOLS]
      : SHARED_TOOLS;

    const openaiMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    let finalResponse = '';
    let toolsUsed: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openaiMessages,
          tools,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('OpenAI API error:', err);
        return NextResponse.json(
          { error: 'Failed to get AI response' },
          { status: response.status }
        );
      }

      const data = await response.json();
      const choice = data.choices[0];

      if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls) {
        openaiMessages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          toolsUsed.push(toolName);
          const result = await executeTool(toolName, toolArgs, clientId, !!isAdmin, db);

          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        continue;
      }

      finalResponse = choice.message?.content || '';
      break;
    }

    return NextResponse.json({
      message: finalResponse,
      toolsUsed,
    });
  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
