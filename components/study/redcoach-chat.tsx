"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, RotateCcw, User, Key, X, Check } from "lucide-react";
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

interface SavedApiKeys {
  groq: string;
  mistral: string;
  gemma: string;
  gemini: string;
}

interface ServerKeyStatus {
  gemini: boolean;
  groq: boolean;
  mistral: boolean;
  gemma: boolean;
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
    id: "Gemma 3 27B",
    name: "Gemma 3 27B",
    badge: "Open Weights",
    provider: "gemma",
    envVar: "GEMMA_API_KEY",
    desc: "Google's open Gemma instruction model for SAT tutoring",
  },
];

const MODEL_NAMES = AVAILABLE_MODELS.map((m) => m.id);
const EFFORT_LEVELS = ["Low", "Medium", "Max Effort"];

const LOCAL_KEYS_STORAGE = "redbookprep-ai-keys";
const LOCAL_MODEL_STORAGE = "redbookprep-selected-model";

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("Gemini 3.5 Flash");
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [keysSavedBanner, setKeysSavedBanner] = useState(false);

  const [serverConfigured, setServerConfigured] = useState<ServerKeyStatus>({
    gemini: false,
    groq: false,
    mistral: false,
    gemma: false,
  });

  const [localKeys, setLocalKeys] = useState<SavedApiKeys>({
    groq: "",
    mistral: "",
    gemma: "",
    gemini: "",
  });

  const [draftKeys, setDraftKeys] = useState<SavedApiKeys>({
    groq: "",
    mistral: "",
    gemma: "",
    gemini: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createdUrlsRef = useRef<string[]>([]);

  const isInitial = messages.length === 0;

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(LOCAL_MODEL_STORAGE);
      if (savedModel && AVAILABLE_MODELS.some((m) => m.id === savedModel)) {
        setSelectedModel(savedModel);
      }
      const rawKeys = localStorage.getItem(LOCAL_KEYS_STORAGE);
      if (rawKeys) {
        const parsed = JSON.parse(rawKeys);
        const normalized: SavedApiKeys = {
          groq: parsed.groq || "",
          mistral: parsed.mistral || "",
          gemma: parsed.gemma || "",
          gemini: parsed.gemini || "",
        };
        setLocalKeys(normalized);
        setDraftKeys(normalized);
      }
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

  const handleSaveLocalKeys = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: SavedApiKeys = {
      groq: draftKeys.groq.trim(),
      mistral: draftKeys.mistral.trim(),
      gemma: draftKeys.gemma.trim(),
      gemini: draftKeys.gemini.trim(),
    };
    setLocalKeys(cleaned);
    try {
      localStorage.setItem(LOCAL_KEYS_STORAGE, JSON.stringify(cleaned));
    } catch {}
    setKeysSavedBanner(true);
    setTimeout(() => {
      setKeysSavedBanner(false);
      setShowKeysModal(false);
    }, 650);
  };

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
        const activeApiKeys: Record<string, string> = {};
        if (localKeys.groq) activeApiKeys.groq = localKeys.groq;
        if (localKeys.mistral) activeApiKeys.mistral = localKeys.mistral;
        if (localKeys.gemma) activeApiKeys.gemma = localKeys.gemma;
        if (localKeys.gemini) activeApiKeys.gemini = localKeys.gemini;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: effectivePrompt,
            model: chosenModel,
            effort: chosenEffort,
            history: historySnapshot,
            apiKeys: activeApiKeys,
          }),
        });

        const data = await res.json();
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || data.error || "Sorry, I had trouble formulating a response.",
          model: data.model || chosenModel,
          effort: chosenEffort,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
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
    [handleModelChange, loading, localKeys, messages, selectedModel]
  );

  const handleResetChat = () => {
    createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    createdUrlsRef.current = [];
    setMessages([]);
  };

  const activeProviderCount = [
    Boolean(localKeys.gemini.trim() || serverConfigured.gemini),
    Boolean(localKeys.groq.trim() || serverConfigured.groq),
    Boolean(localKeys.mistral.trim() || serverConfigured.mistral),
    Boolean(localKeys.gemma.trim() || localKeys.gemini.trim() || serverConfigured.gemma),
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

          <div className="redcoach-hero-foot">
            <button
              type="button"
              className="redcoach-keys-trigger"
              onClick={() => {
                setDraftKeys(localKeys);
                setShowKeysModal(true);
              }}
            >
              <Key size={12} />
              <span>API Keys</span>
              <span className="redcoach-keys-count">{activeProviderCount}/4 active</span>
            </button>
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
              <button
                type="button"
                className="redcoach-action-pill"
                onClick={() => {
                  setDraftKeys(localKeys);
                  setShowKeysModal(true);
                }}
              >
                <Key size={13} />
                <span>API Keys</span>
              </button>
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

      {/* ============================================================== */}
      {/* API KEYS CONFIGURATION MODAL                                   */}
      {/* ============================================================== */}
      {showKeysModal && (
        <div
          className="redcoach-modal-backdrop"
          onClick={() => setShowKeysModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Configure AI Provider API Keys"
        >
          <div className="redcoach-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="redcoach-modal-head">
              <div>
                <h3>AI Provider API Keys</h3>
                <p> Stored locally in your browser or via Vercel Environment Variables.</p>
              </div>
              <button
                type="button"
                className="redcoach-modal-close"
                aria-label="Close API Keys dialog"
                onClick={() => setShowKeysModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLocalKeys} className="redcoach-modal-form">
              <label className="redcoach-modal-field">
                <span>
                  Groq API Key
                  {Boolean(localKeys.groq.trim() || serverConfigured.groq) && (
                    <em className="redcoach-key-ready">Active</em>
                  )}
                </span>
                <input
                  type="password"
                  placeholder={serverConfigured.groq ? "Configured on server" : "gsk_..."}
                  value={draftKeys.groq}
                  onChange={(e) => setDraftKeys((p) => ({ ...p, groq: e.target.value }))}
                />
              </label>

              <label className="redcoach-modal-field">
                <span>
                  Mistral API Key
                  {Boolean(localKeys.mistral.trim() || serverConfigured.mistral) && (
                    <em className="redcoach-key-ready">Active</em>
                  )}
                </span>
                <input
                  type="password"
                  placeholder={
                    serverConfigured.mistral ? "Configured on server" : "Mistral API key..."
                  }
                  value={draftKeys.mistral}
                  onChange={(e) => setDraftKeys((p) => ({ ...p, mistral: e.target.value }))}
                />
              </label>

              <label className="redcoach-modal-field">
                <span>
                  Gemma API Key
                  {Boolean(
                    localKeys.gemma.trim() || localKeys.gemini.trim() || serverConfigured.gemma
                  ) && <em className="redcoach-key-ready">Active</em>}
                </span>
                <input
                  type="password"
                  placeholder={
                    serverConfigured.gemma ? "Configured via Google key" : "AIza... or gsk_..."
                  }
                  value={draftKeys.gemma}
                  onChange={(e) => setDraftKeys((p) => ({ ...p, gemma: e.target.value }))}
                />
              </label>

              <label className="redcoach-modal-field">
                <span>
                  Gemini API Key
                  {Boolean(localKeys.gemini.trim() || serverConfigured.gemini) && (
                    <em className="redcoach-key-ready">Active</em>
                  )}
                </span>
                <input
                  type="password"
                  placeholder={serverConfigured.gemini ? "Configured on server" : "AIza..."}
                  value={draftKeys.gemini}
                  onChange={(e) => setDraftKeys((p) => ({ ...p, gemini: e.target.value }))}
                />
              </label>

              <div className="redcoach-modal-foot">
                <small>
                  Vercel env vars: <code>GROQ_API_KEY</code>, <code>MISTRAL_API_KEY</code>,{" "}
                  <code>GEMMA_API_KEY</code>, <code>GEMINI_API_KEY</code>
                </small>
                <button type="submit" className="redcoach-modal-save">
                  {keysSavedBanner ? (
                    <>
                      <Check size={14} /> Saved
                    </>
                  ) : (
                    "Save keys"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
