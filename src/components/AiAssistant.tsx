"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User, Trash2, Sparkles } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
};

const TOOL_LABELS: Record<string, string> = {
  get_tasks: 'Checked tasks',
  create_task: 'Created task',
  update_task: 'Updated task',
  get_content: 'Reviewed content',
  create_content_idea: 'Created content idea',
  get_calendar_events: 'Checked calendar',
  create_calendar_event: 'Added to calendar',
  get_client_profile: 'Read profile',
  list_clients: 'Listed clients',
};

const CLIENT_SUGGESTIONS = [
  'What tasks do I have?',
  'What content is scheduled this week?',
  'Create a social media post idea about market updates',
  'Add a task to review my content calendar',
];

const ADMIN_SUGGESTIONS = [
  'Show me all pending content across clients',
  'What tasks are overdue?',
  'List all clients',
  "What's on the calendar this week?",
];

export default function AiAssistant({ clientId, isAdmin = false }: { clientId: string; isAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, clientId, isAdmin }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Sorry, I couldn\'t process that. Please try again.',
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages([...updatedMessages, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again in a moment.',
        timestamp: new Date(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  const formatContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc pl-4 my-1.5 space-y-0.5">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm">{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+\.\s/.test(trimmed)) {
        inList = true;
        listItems.push(trimmed.replace(/^[-•]\s|^\d+\.\s/, ''));
        continue;
      }

      flushList();

      if (!trimmed) {
        elements.push(<br key={`br-${i}`} />);
        continue;
      }

      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        elements.push(
          <p key={`bold-${i}`} className="font-semibold text-sm mt-2 mb-1">
            {trimmed.slice(2, -2)}
          </p>
        );
        continue;
      }

      const rendered = trimmed.replace(
        /\*\*(.+?)\*\*/g,
        '<strong>$1</strong>'
      );

      elements.push(
        <p key={`p-${i}`} className="text-sm" dangerouslySetInnerHTML={{ __html: rendered }} />
      );
    }

    flushList();
    return elements;
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          title="AI Assistant"
        >
          <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:bottom-6 sm:right-6 sm:w-[420px] h-[100dvh] sm:h-[min(680px,calc(100dvh-48px))] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 text-white sm:rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">AI Assistant</h3>
                <p className="text-[11px] text-zinc-400 leading-tight">Manage your portal with AI</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="p-2 rounded-lg hover:bg-white/10 transition text-zinc-400 hover:text-white"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-zinc-50">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-zinc-400" />
                </div>
                <h4 className="font-semibold text-zinc-700 mb-1.5">How can I help?</h4>
                <p className="text-sm text-zinc-500 mb-6 max-w-[280px]">
                  {isAdmin
                    ? 'I can manage clients, tasks, content, and calendars across your portal.'
                    : 'I can manage tasks, create content ideas, schedule your calendar, and more.'}
                </p>
                <div className="w-full space-y-2">
                  {(isAdmin ? ADMIN_SUGGESTIONS : CLIENT_SUGGESTIONS).map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-sm px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 text-white rounded-2xl rounded-br-md px-3.5 py-2.5'
                      : 'bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-zinc-700'
                  }`}
                >
                  <div className="space-y-0.5">{formatContent(msg.content)}</div>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-100">
                      {[...new Set(msg.toolsUsed)].map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-500 border border-zinc-100"
                        >
                          {TOOL_LABELS[tool] || tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-zinc-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-zinc-200 flex-shrink-0">
            <div className="flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400/20 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 resize-none outline-none max-h-24"
                style={{ minHeight: '24px' }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 transition flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5">
              AI can make mistakes. Verify important actions.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
