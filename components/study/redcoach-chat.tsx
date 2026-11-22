"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, RotateCcw, User, Zap, Bookmark, Brain, Shuffle } from "lucide-react";
import { PromptInput } from "@/components/ui/ai-chat-input";

interface MessageAttachment {
  id: string;
  url: string;
  name: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  effort?: string;
  timestamp: string;
  attachments?: MessageAttachment[];
}

interface ServerKeyStatus {
  gemini: boolean;
  groq: boolean;
  mistral: boolean;
  gemma: boolean;
}

interface SparksQuota {
  remaining: number;
  limit: number;
}

const STARTER_PROMPTS = [
  {
    label: "Linear systems with no solution",
    prompt:
      "How do I recognize when a system of two linear equations has no solution on the Digital SAT?",
  },
  {
    label: "Contrast vs. concession",
    prompt:
      "How do I tell the difference between contrast transitions (like 'in contrast') and concession transitions (like 'nevertheless') on the Digital SAT? Give me short concrete examples and a quick rule.",
  },
  {
    label: "Circle center & radius",
    prompt:
      "How do I find the center and radius of (x − 3)² + (y + 2)² = 25 on the Digital SAT?",
  },
  {
    label: "Best Desmos SAT tricks",
    prompt: "What are the most powerful Desmos tricks for Digital SAT math questions?",
  },
];

export interface AIModelOption {
  id: string;
  name: string;
  badge: string;
  provider: "gemini" | "groq" | "mistral" | "gemma";
  envVar: string;
  desc: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: "Gemini 3.5 Flash",
    name: "Gemini 3.5 Flash",
    badge: "Default · Fast",
    provider: "gemini",
    envVar: "GEMINI_API_KEY",
    desc: "Instant SAT math breakdowns & test strategies",
  },
  {
    id: "Groq · Llama 3.3 70B",
    name: "Groq · Llama 3.3 70B",
    badge: "Ultra-Fast LPU",
    provider: "groq",
    envVar: "GROQ_API_KEY",
    desc: "Near-instant step-by-step algebra & grammar checks",
  },
  {
    id: "Groq · Llama 4 Maverick",
    name: "Groq · Llama 4 Maverick",
    badge: "MoE Reasoning",
    provider: "groq",
    envVar: "GROQ_API_KEY",
    desc: "Nuanced Reading & Writing passage logic on Groq",
  },
  {
    id: "Mistral Large",
    name: "Mistral Large",
    badge: "Flagship",
    provider: "mistral",
    envVar: "MISTRAL_API_KEY",
    desc: "High-precision rhetoric, transitions & multi-step math",
  },
  {
    id: "Mistral Small",
    name: "Mistral Small",
    badge: "Low Latency",
    provider: "mistral",
    envVar: "MISTRAL_API_KEY",
    desc: "Rapid punctuation, conciseness & quick concept drills",
  },
  {
    id: "Gemma 4",
    name: "Gemma 4",
    badge: "MoE · 26B-A4B",
    provider: "gemma",
    envVar: "GEMMA_API_KEY",
    desc: "Google's open Gemma 4 (gemma-4-26b-a4b-it) model for SAT tutoring",
  },
];

const MODEL_NAMES = AVAILABLE_MODELS.map((m) => m.id);
const EFFORT_LEVELS = ["Low", "Medium", "Max Effort"];

const LOCAL_MODEL_STORAGE = "redbookprep-selected-model";
const LOCAL_MEMORY_STORAGE = "redbookprep-student-memory-v1";
const LOCAL_THREADS_STORAGE = "redbookprep-ai-threads-v1";

const PERSONAS = [
  { id: "direct", label: "Direct Coach" },
  { id: "socratic", label: "Socratic" },
  { id: "eli5", label: "Explain Like I'm 5" },
  { id: "speedrun", label: "15s Speedrun" },
] as const;

type PersonaId = (typeof PERSONAS)[number]["id"];

interface SavedThread {
  id: string;
  title: string;
  bookmarked: boolean;
  updatedAt: string;
  messages: Message[];
}

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
  const [threads, setThreads] = useState<SavedThread[]>([]);
  const [persona, setPersona] = useState<PersonaId>("direct");
  const [memoryNote, setMemoryNote] = useState("");
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("Gemini 3.5 Flash");
  const [sparks, setSparks] = useState<SparksQuota>({ remaining: 10, limit: 10 });

  const [serverConfigured, setServerConfigured] = useState<ServerKeyStatus>({
    gemini: false,
    groq: false,
    mistral: false,
    gemma: false,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createdUrlsRef = useRef<string[]>([]);

  const isInitial = messages.length === 0;

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(LOCAL_MODEL_STORAGE);
      const migratedModel = savedModel === "Gemma 3 27B" ? "Gemma 4" : savedModel;
      if (migratedModel && AVAILABLE_MODELS.some((m) => m.id === migratedModel)) {
        setSelectedModel(migratedModel);
      }
      const savedMem = localStorage.getItem(LOCAL_MEMORY_STORAGE);
      if (savedMem) setMemoryNote(savedMem);
      const savedThreads = JSON.parse(localStorage.getItem(LOCAL_THREADS_STORAGE) || "[]");
      if (Array.isArray(savedThreads)) setThreads(savedThreads);
      localStorage.removeItem("redbookprep-ai-keys");
    } catch {}

    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.configured) {
          setServerConfigured({
            gemini: Boolean(data.configured.gemini),
            groq: Boolean(data.configured.groq),
            mistral: Boolean(data.configured.mistral),
            gemma: Boolean(data.configured.gemma),
          });
        }
        if (data?.sparks && typeof data.sparks.remaining === "number") {
          setSparks({
            remaining: data.sparks.remaining,
            limit: data.sparks.limit || 10,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isInitial) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isInitial]);

  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
    };
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem(LOCAL_MODEL_STORAGE, modelId);
    } catch {}
  }, []);

  const sendPrompt = useCallback(
    async (
      rawText: string,
      meta?: { model?: string; effort?: string; attachments?: File[] }
    ) => {
      if (loading) return;
      const trimmed = rawText.trim();
      const files = meta?.attachments ?? [];
      if (!trimmed && files.length === 0) return;

      const chosenModel = meta?.model || selectedModel;
      const chosenEffort = meta?.effort || "Medium";
      if (chosenModel !== selectedModel) {
        handleModelChange(chosenModel);
      }

      const msgAttachments: MessageAttachment[] = files.map((file) => {
        const url = URL.createObjectURL(file);
        createdUrlsRef.current.push(url);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          name: file.name,
        };
      });

      const effectivePrompt =
        trimmed ||
        "Please help me analyze and solve this Digital SAT question step by step.";

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed || `Attached ${files.length} image${files.length > 1 ? "s" : ""}`,
        model: chosenModel,
        effort: chosenEffort,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: msgAttachments.length > 0 ? msgAttachments : undefined,
      };

      const historySnapshot = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: effectivePrompt,
            model: chosenModel,
            effort: chosenEffort,
            persona,
            memorySummary: memoryNote,
            history: historySnapshot,
          }),
        });

        const data = await res.json();
        if (data?.sparks && typeof data.sparks.remaining === "number") {
          setSparks({
            remaining: data.sparks.remaining,
            limit: data.sparks.limit || 10,
          });
        }
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || data.error || "Sorry, I had trouble formulating a response.",
          model: data.model || chosenModel,
          effort: chosenEffort,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => {
          const nextMsgs = [...prev, botMsg];
          try {
            const firstTitle = (nextMsgs[0]?.content || "SAT Coaching Thread").slice(0, 48);
            setThreads((oldThreads) => {
              const existing = oldThreads.find((t) => t.id === threadId);
              const updated: SavedThread = {
                id: threadId,
                title: existing?.title || firstTitle,
                bookmarked: existing?.bookmarked || false,
                updatedAt: new Date().toISOString(),
                messages: nextMsgs,
              };
              const merged = [updated, ...oldThreads.filter((t) => t.id !== threadId)].slice(0, 25);
              localStorage.setItem(LOCAL_THREADS_STORAGE, JSON.stringify(merged));
              return merged;
            });
          } catch {}
          return nextMsgs;
        });
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Network error: Unable to reach redCoach right now. Please check your connection and try again.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [handleModelChange, loading, messages, selectedModel]
  );

  const handleResetChat = () => {
    createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    createdUrlsRef.current = [];
    setMessages([]);
    setThreadId(crypto.randomUUID());
  };

  const toggleBookmarkThread = () => {
    setThreads((old) => {
      const next = old.map((t) => (t.id === threadId ? { ...t, bookmarked: !t.bookmarked } : t));
      try {
        localStorage.setItem(LOCAL_THREADS_STORAGE, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const activeProviderCount = [
    serverConfigured.gemini,
    serverConfigured.groq,
    serverConfigured.mistral,
    serverConfigured.gemma,
  ].filter(Boolean).length;

  return (
    <div className={`redcoach-horizon-stage ${isInitial ? "is-initial" : "is-active"}`}>
      {isInitial ? (
        /* ============================================================== */
        /* 1. CENTERED HORIZON STAGE (21st.dev PromptInput Hero)          */
        /* ============================================================== */
        <div className="redcoach-hero-center">
          <div className="redcoach-hero-heading">
            <span className="redcoach-hero-pill">
              <Sparkles size={13} />
              <span>redCoach AI</span>
            </span>
            <h1>What SAT skill are we tackling?</h1>
            <p>
              Instant step-by-step Digital SAT Math, Reading &amp; Writing coaching.
            </p>
          </div>

          <div className="redcoach-prompt-mount">
            <PromptInput
              models={MODEL_NAMES}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              efforts={EFFORT_LEVELS}
              placeholder="Ask anything about the Digital SAT..."
              collapsedMaxWidth={340}
              expandedMaxWidth={500}
              disabled={loading}
              onSubmit={(val, meta) => sendPrompt(val, meta)}
            />
          </div>

          <div className="redcoach-starter-row" aria-label="Suggested SAT questions">
            {STARTER_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="redcoach-glass-pill"
                onClick={() =>
                  sendPrompt(item.prompt, { model: selectedModel, effort: "Medium" })
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="redcoach-hero-foot" style={{ display: "grid", gap: "10px", justifyItems: "center" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`redcoach-glass-pill ${persona === p.id ? "is-active-persona" : ""}`}
                  aria-pressed={persona === p.id}
                  onClick={() => setPersona(p.id)}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className="redcoach-glass-pill"
                onClick={() => setShowMemoryDrawer((v) => !v)}
              >
                <Brain size={12} /> Study Memory
              </button>
            </div>
            {showMemoryDrawer && (
              <div className="rb-coach-memory-box">
                <textarea
                  rows={2}
                  placeholder="Tell redCoach what to always remember (e.g. 'I miss discriminant questions & semicolon clauses')..."
                  value={memoryNote}
                  onChange={(e) => {
                    setMemoryNote(e.target.value);
                    try {
                      localStorage.setItem(LOCAL_MEMORY_STORAGE, e.target.value);
                    } catch {}
                  }}
                />
              </div>
            )}
            {threads.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                {threads.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="redcoach-keys-trigger"
                    onClick={() => {
                      setThreadId(t.id);
                      setMessages(t.messages);
                    }}
                  >
                    {t.bookmarked && <Bookmark size={11} className="fill-current" />}
                    <span>Resume: {t.title}</span>
                  </button>
                ))}
              </div>
            )}
            <span className="redcoach-keys-trigger" aria-label="Weekly AI Sparks allowance">
              <Zap size={12} />
              <span>{sparks.remaining}/{sparks.limit} Sparks this week</span>
              {activeProviderCount > 0 && (
                <span className="redcoach-keys-count">{activeProviderCount} models live</span>
              )}
            </span>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* 2. FULL CONVERSATION WORKSPACE + BOTTOM-DOCKED PROMPT INPUT    */
        /* ============================================================== */
        <div className="redcoach-conversation-shell">
          <div className="redcoach-FloatingBar">
            <div className="redcoach-FloatingBar-title">
              <span className="redcoach-mini-badge">
                <Sparkles size={13} />
              </span>
              <span>redCoach</span>
              <small>{selectedModel}</small>
            </div>
            <div className="redcoach-FloatingBar-actions">
              <select
                aria-label="Coaching persona"
                className="redcoach-action-pill"
                value={persona}
                onChange={(e) => setPersona(e.target.value as PersonaId)}
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="redcoach-action-pill"
                onClick={toggleBookmarkThread}
                title="Bookmark this conversation"
              >
                <Bookmark size={13} className={threads.find((t) => t.id === threadId)?.bookmarked ? "fill-current" : ""} />
              </button>
              <span className="redcoach-action-pill" aria-label="Remaining weekly Sparks">
                <Zap size={13} />
                <span>{sparks.remaining}/{sparks.limit} Sparks</span>
              </span>
              <button
                type="button"
                className="redcoach-action-pill"
                onClick={handleResetChat}
              >
                <RotateCcw size={13} />
                <span>New chat</span>
              </button>
            </div>
          </div>

          <div className="redcoach-stream" role="log" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`redcoach-turn ${msg.role === "user" ? "is-user" : "is-bot"}`}
              >
                <div className="redcoach-turn-avatar" aria-hidden="true">
                  {msg.role === "assistant" ? <Sparkles size={15} /> : <User size={15} />}
                </div>
                <div className="redcoach-turn-bubble">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="redcoach-turn-images">
                      {msg.attachments.map((att) => (
                        <img
                          key={att.id}
                          src={att.url}
                          alt={att.name}
                          className="redcoach-turn-img"
                        />
                      ))}
                    </div>
                  )}
                  <div className="redcoach-turn-text">{msg.content}</div>
                  <div className="redcoach-turn-meta">
                    {msg.model && <span>{msg.model}</span>}
                    {msg.effort && <span>· {msg.effort}</span>}
                    <span>· {msg.timestamp}</span>
                    {msg.role === "assistant" && (
                      <button
                        type="button"
                        className="rb-remix-btn"
                        onClick={() =>
                          sendPrompt(
                            "Create one brand-new original Digital SAT remix problem testing this exact same concept, with 4 choices A-D (do not reveal the answer until I reply).",
                            { model: selectedModel, effort: "Medium" }
                          )
                        }
                      >
                        <Shuffle size={11} /> Remix similar question
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="redcoach-turn is-bot">
                <div className="redcoach-turn-avatar" aria-hidden="true">
                  <Sparkles size={15} />
                </div>
                <div className="redcoach-turn-bubble is-thinking">
                  <span className="redcoach-thinking-dot" />
                  <span>redCoach is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="redcoach-bottom-dock">
            <PromptInput
              models={MODEL_NAMES}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              efforts={EFFORT_LEVELS}
              placeholder="Ask a follow-up question..."
              collapsedMaxWidth={380}
              expandedMaxWidth={560}
              disabled={loading}
              onSubmit={(val, meta) => sendPrompt(val, meta)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
