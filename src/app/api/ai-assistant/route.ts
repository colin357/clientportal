import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/firebaseServer';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

const OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description:
        'Get the client\'s tasks. Can filter by status. Returns a list of tasks with their title, status, due date, instructions, and tag.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'under_review', 'done'],
            description: 'Filter by task status. Omit to get all tasks.',
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
        'Create a new task for the client. Use this when the user wants to add a to-do item, reminder, or action item.',
      parameters: {
        type: 'object',
        properties: {
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
        'Get content items (social posts, blog posts, emails, content ideas). Can filter by type and status.',
      parameters: {
        type: 'object',
        properties: {
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
        'Create a new content idea (social post, blog post, or email campaign). The content will appear in the client\'s Content Review section for approval.',
      parameters: {
        type: 'object',
        properties: {
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
        'Get scheduled content calendar events. Can filter by date range or type. Shows what content is scheduled and when.',
      parameters: {
        type: 'object',
        properties: {
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
        'Schedule content on the calendar. Creates a new calendar event for the client.',
      parameters: {
        type: 'object',
        properties: {
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
        'Get the current client\'s profile information including company name, onboarding answers, industry, brand voice, and other details.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

function uniqueId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function executeTool(
  toolName: string,
  args: Record<string, any>,
  clientId: string,
  db: any
): Promise<any> {
  switch (toolName) {
    case 'get_tasks': {
      const snapshot = await getDocs(collection(db, 'clientTasks'));
      let tasks = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((t: any) => t.clientId === clientId);
      if (args.status) tasks = tasks.filter((t: any) => t.status === args.status);
      tasks.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      return {
        count: tasks.length,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          tag: t.tag,
          dueDate: t.dueDate,
          instructions: t.instructions,
          notes: t.notes,
        })),
      };
    }

    case 'create_task': {
      const snapshot = await getDocs(collection(db, 'clientTasks'));
      const clientTaskCount = snapshot.docs
        .map((d) => d.data())
        .filter((t: any) => t.clientId === clientId).length;

      const task = {
        id: uniqueId(),
        clientId,
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
      if (data.clientId !== clientId) return { error: 'Task not found' };

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
      let items = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((i: any) => i.clientId === clientId);
      if (args.type) items = items.filter((i: any) => i.type === args.type);
      if (args.status) items = items.filter((i: any) => i.status === args.status);
      items.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return {
        count: items.length,
        content: items.slice(0, 20).map((i: any) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          description: i.description,
          status: i.status,
          createdAt: i.createdAt,
          content: i.content?.substring(0, 300) + (i.content?.length > 300 ? '...' : ''),
        })),
      };
    }

    case 'create_content_idea': {
      const item = {
        id: uniqueId(),
        clientId,
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
      let events = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((e: any) => e.clientId === clientId);

      events = events.filter((e: any) => e.date && e.date >= from && e.date <= to);
      if (args.type) events = events.filter((e: any) => e.type === args.type);
      events.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

      return {
        count: events.length,
        dateRange: { from, to },
        events: events.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          type: e.type,
          completed: e.completed || false,
        })),
      };
    }

    case 'create_calendar_event': {
      const event = {
        id: uniqueId(),
        clientId,
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
      const userDoc = await getDoc(doc(db, 'users', clientId));
      if (!userDoc.exists()) return { error: 'Client not found' };
      const data = userDoc.data();
      const { password, ...safe } = data as any;
      return {
        id: clientId,
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

const SYSTEM_PROMPT = `You are the AI assistant for the Own It Social client portal. You help clients manage their marketing tasks, content, and calendar.

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

const MAX_TOOL_ROUNDS = 5;

export async function POST(request: NextRequest) {
  try {
    const { messages, clientId } = await request.json();

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

    const openaiMessages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
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
          tools: OPENAI_TOOLS,
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
          const result = await executeTool(toolName, toolArgs, clientId, db);

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
