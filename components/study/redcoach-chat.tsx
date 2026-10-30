"use client";

import { COACH_MODELS, FAILURE_MESSAGES, resolveModel, type Attempt } from "../../lib/redcoach-models";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Mic,
  MicOff,
  Image as ImageIcon,
  Send,
  RotateCcw,
  User,
  ArrowRight,
  X,
  Check,
  ChevronDown,
  Key,
} from "lucide-react";

interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  effort?: string;
  notice?: string;
  modelId?: string;
  error?: boolean;
  timestamp: string;
  attachments?: Attachment[];
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
    title: "Solve linear systems with no solutions",
    category: "Math · Algebra",
    prompt:
      "How do I recognize when a system of two linear equations has no solution on the digital SAT?",
  },
  {
    title: "Contrast vs. concession transitions",
    category: "Reading & Writing",
    prompt:
      "How do I tell the difference between contrast transitions (like 'in contrast') and concession transitions (like 'nevertheless') on the Digital SAT? Give me short concrete examples and a quick rule.",
  },
  {
    title: "Circle equations in (x − 3)² + (y + 2)² = 25",
    category: "Math · Geometry",
    prompt:
      "How do I find the center and radius of (x − 3)² + (y + 2)² = 25 on the Digital SAT?",
  },
  {
    title: "Desmos graphing calculator tips",
    category: "SAT Strategy",
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

export const AVAILABLE_MODELS: readonly AIModelOption[] = COACH_MODELS;

const LOCAL_KEYS_STORAGE = "redbookprep-ai-keys";
const LOCAL_MODEL_STORAGE = "redbookprep-selected-model";

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(COACH_MODELS[0].id);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [modelMenuPlacement, setModelMenuPlacement] = useState<"above" | "below">("above");

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const isInitial = messages.length === 0;
  const selectedLabel = resolveModel(selectedModel)?.name || selectedModel;
  const [modelChecks, setModelChecks] = useState<Record<string, Attempt & { checkedAt: string }>>({});

  // Load saved model & local API keys, plus check server-configured env vars
  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(LOCAL_MODEL_STORAGE);
      if (savedModel && resolveModel(savedModel)) {
        setSelectedModel(resolveModel(savedModel)!.id);
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

  const isProviderReady = useCallback(
    (provider: AIModelOption["provider"]) => {
      if (provider === "groq") return Boolean(localKeys.groq.trim() || serverConfigured.groq);
      if (provider === "mistral")
        return Boolean(localKeys.mistral.trim() || serverConfigured.mistral);
      if (provider === "gemma")
        return Boolean(
          localKeys.gemma.trim() || localKeys.gemini.trim() || serverConfigured.gemma
        );
      return Boolean(localKeys.gemini.trim() || serverConfigured.gemini);
    },
    [localKeys, serverConfigured]
  );

  // Close model popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
        setShowKeyForm(false);
      }
    }
    if (showModelMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModelMenu]);

  // Auto-scroll message stream
  useEffect(() => {
    if (!isInitial) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isInitial]);

  // Auto-resize textarea height
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const nextHeight = Math.min(textareaRef.current.scrollHeight, 180);
    textareaRef.current.style.height = `${Math.max(nextHeight, 48)}px`;
  }, [inputText]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [attachments]);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelMenu(false);
    setShowKeyForm(false);
    try {
      localStorage.setItem(LOCAL_MODEL_STORAGE, modelId);
    } catch {}
  };

  const handleSaveLocalKeys = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: SavedApiKeys = {
      groq: draftKeys.groq.trim(),
      mistral: draftKeys.mistral.trim(),
      gemma: draftKeys.gemma.trim(),
      gemini: draftKeys.gemini.trim(),
    };
    setModelChecks({});
    setLocalKeys(cleaned);
    try {
      localStorage.setItem(LOCAL_KEYS_STORAGE, JSON.stringify(cleaned));
    } catch {}
    setShowKeyForm(false);
  };

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend !== undefined ? textToSend : inputText).trim();
      if (!text && attachments.length === 0) return;
      if (loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        model: selectedLabel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: [...attachments],
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setAttachments([]);
      setLoading(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }

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
            message: text,
            model: selectedModel,
            history: messages.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.content })),
            apiKeys: activeApiKeys,
          }),
        });

        const data = await res.json();
        if (Array.isArray(data.checks)) {
          setModelChecks((prev) => {
            const next = { ...prev };
            for (const check of data.checks) next[check.modelId] = check;
            return next;
          });
        }
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || data.error || "Sorry, I had trouble formulating a response.",
          model: data.model || selectedLabel,
          modelId: data.modelId,
          notice: data.notice,
          error: !res.ok,
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
              "Network error: Unable to reach the coaching server. Please check your connection.",
              error: true,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [inputText, attachments, loading, messages, selectedModel, selectedLabel, localKeys]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your question.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const newAttachments = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setAttachments((prev) => [...prev, ...newAttachments].slice(0, 4));
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleResetChat = () => {
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setMessages([]);
    setInputText("");
  };

  const renderModelMenu = (placement: "above" | "below" = "above") => (
    <div
      ref={modelMenuRef}
      className={`redcoach-model-popover ${placement === "below" ? "placement-below" : ""}`}
    >
      <div className="redcoach-model-popover-header">
        <span className="redcoach-model-popover-title">
          {showKeyForm ? "Configure API Keys" : "Select AI Model"}
        </span>
        <button
          type="button"
          onClick={() => {
            setDraftKeys(localKeys);
            setShowKeyForm((v) => !v);
          }}
          className="redcoach-key-toggle-btn"
        >
          <Key size={11} />
          <span>{showKeyForm ? "Back to models" : "API Keys"}</span>
        </button>
      </div>

      {showKeyForm ? (
        <form onSubmit={handleSaveLocalKeys} className="redcoach-key-form">
          <label className="redcoach-key-field">
            <span>
              Groq API Key{" "}
              {serverConfigured.groq && <em className="redcoach-env-ok">Key configured</em>}
            </span>
            <input
              type="password"
              placeholder={serverConfigured.groq ? "Configured in Vercel" : "gsk_..."}
              value={draftKeys.groq}
              onChange={(e) => setDraftKeys((p) => ({ ...p, groq: e.target.value }))}
            />
          </label>
          <label className="redcoach-key-field">
            <span>
              Mistral API Key{" "}
              {serverConfigured.mistral && <em className="redcoach-env-ok">Key configured</em>}
            </span>
            <input
              type="password"
              placeholder={serverConfigured.mistral ? "Configured in Vercel" : "Mistral API key..."}
              value={draftKeys.mistral}
              onChange={(e) => setDraftKeys((p) => ({ ...p, mistral: e.target.value }))}
            />
          </label>
          <label className="redcoach-key-field">
            <span>
              Gemma API Key{" "}
              {serverConfigured.gemma && <em className="redcoach-env-ok">Key configured</em>}
            </span>
            <input
              type="password"
              placeholder={
                serverConfigured.gemma ? "Google AI Studio key configured" : "Google AI Studio key (AIza...)"
              }
              value={draftKeys.gemma}
              onChange={(e) => setDraftKeys((p) => ({ ...p, gemma: e.target.value }))}
            />
          </label>
          <label className="redcoach-key-field">
            <span>
              Gemini API Key{" "}
              {serverConfigured.gemini && <em className="redcoach-env-ok">Key configured</em>}
            </span>
            <input
              type="password"
              placeholder={serverConfigured.gemini ? "Configured in Vercel" : "AIza..."}
              value={draftKeys.gemini}
              onChange={(e) => setDraftKeys((p) => ({ ...p, gemini: e.target.value }))}
            />
          </label>
          <div className="redcoach-key-actions">
            <button type="submit" className="redcoach-key-save-btn">
              Save keys in browser
            </button>
          </div>
          <div className="redcoach-model-popover-footer">
            For site-wide access, add <code>GROQ_API_KEY</code>, <code>MISTRAL_API_KEY</code>, and{" "}
            <code>GEMMA_API_KEY</code> in Vercel Environment Variables.
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = selectedModel === m.id;
              const configured = isProviderReady(m.provider);
              const check = modelChecks[m.id];
              const ready = check?.status === "ok";
              const status = check
                ? check.status === "ok" ? "Last request succeeded" : FAILURE_MESSAGES[check.status]
                : configured ? "Key configured · not tested" : "Key needed";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectModel(m.id)}
                  className={`redcoach-model-opt ${isSelected ? "active" : ""}`}
                >
                  <div className="redcoach-model-opt-info">
                    <div className="redcoach-model-opt-name">
                      <span
                        className={`redcoach-status-dot ${ready ? "is-ready" : "needs-key"}`}
                        title={check ? `${status} (${new Date(check.checkedAt).toLocaleTimeString()})` : status}
                      />
                      <span>{m.name}</span>
                      <span className="redcoach-model-opt-tag">{m.badge}</span>
                    </div>
                    <div className="redcoach-model-opt-desc">{m.desc}</div>
                    <div className="redcoach-model-opt-desc">{status}</div>
                  </div>
                  {isSelected && <Check size={16} className="redcoach-model-opt-check" />}
                </button>
              );
            })}
          </div>
          <div className="redcoach-model-popover-footer">
            Green dot = last request succeeded in this session. Send a question to test a model.
            A configured key alone does not verify access.
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`redcoach-page-wrapper ${isInitial ? "is-initial" : "is-active"}`}>
      {/* Ambient gradient glow matching the reference design */}
      <div className="redcoach-ambient-bg" aria-hidden="true" />

      {/* ============================================================ */}
      {/* 1. INITIAL STATE: Centered hero with only the chatbox        */}
      {/* ============================================================ */}
      {isInitial ? (
        <div className="redcoach-initial-container">
          {/* Welcoming Header */}
          <div className="redcoach-initial-hero">
            <div className="redcoach-initial-avatar">
              <Sparkles size={28} />
            </div>
            <h1 className="redcoach-initial-title">Ask redCoach</h1>
            <p className="redcoach-initial-subtitle">
              Your Digital SAT AI companion · Powered by Gemini, Groq, Mistral &amp; Gemma
            </p>
          </div>

          {/* Centered AI Chatbox */}
          <div className="redcoach-chatbox-card">
            {/* Attachment preview thumbnails */}
            {attachments.length > 0 && (
              <div className="redcoach-attachments-strip">
                {attachments.map((att) => (
                  <div key={att.id} className="redcoach-attachment-thumb">
                    <img src={att.url} alt={att.name} />
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="redcoach-attachment-remove"
                      aria-label="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your SAT question or paste a problem..."
              className="redcoach-textarea"
              rows={1}
            />

            {/* Bottom Actions Bar */}
            <div className="redcoach-actions-bar">
              {/* Left Circular Buttons + Model Pill */}
              <div className="redcoach-actions-left">
                {/* 1. Sparkles Model Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuPlacement("above");
                      setShowModelMenu((v) => !v);
                    }}
                    className="redcoach-model-badge-btn"
                    title="Switch AI model (Gemini, Groq, Mistral, Gemma)"
                  >
                    <Sparkles size={13} />
                    <span>{selectedLabel}</span>
                    <ChevronDown size={12} />
                  </button>
                  {showModelMenu && modelMenuPlacement === "above" && renderModelMenu("above")}
                </div>

                {/* 2. Microphone Button */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`redcoach-circle-btn ${isListening ? "is-recording" : ""}`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                {/* 3. Image / Gallery Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="redcoach-circle-btn"
                  title="Upload SAT problem screenshot or diagram"
                >
                  <ImageIcon size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Right Pill Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && attachments.length === 0}
                className="redcoach-send-pill"
                title="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* Suggested Starter Questions */}
          <div className="redcoach-initial-starters">
            <span className="redcoach-starters-label">Try asking:</span>
            <div className="redcoach-chips-row">
              {STARTER_PROMPTS.map((sp) => (
                <button
                  key={sp.title}
                  type="button"
                  onClick={() => handleSendMessage(sp.prompt)}
                  className="redcoach-chip-btn"
                >
                  <span>{sp.title}</span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* 2. ACTIVE STATE: Full-width pane with conversation stream    */
        /* ============================================================ */
        <div className="redcoach-active-workspace">
          {/* Top Bar */}
          <div className="redcoach-top-bar">
            <div className="redcoach-top-left">
              <div className="redcoach-top-avatar">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-inherit leading-none">Ask redCoach</h2>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuPlacement("below");
                        setShowModelMenu((v) => !v);
                      }}
                      className="redcoach-model-badge-btn"
                      title="Switch AI model"
                    >
                      <Sparkles size={12} />
                      <span>{selectedLabel}</span>
                      <ChevronDown size={12} />
                    </button>
                    {showModelMenu && modelMenuPlacement === "below" && renderModelMenu("below")}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Concise plain-text SAT math breakdowns &amp; test strategies
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetChat}
              className="redcoach-new-chat-btn"
              title="Start a new question / reset conversation"
            >
              <RotateCcw size={14} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Conversation Stream */}
          <div className="redcoach-stream-scroll">
            {messages.map((m) => {
              const isBot = m.role === "assistant";
              return (
                <div key={m.id} className={`redcoach-msg-row ${isBot ? "is-bot" : "is-user"}`}>
                  <div className="redcoach-msg-avatar">
                    {isBot ? <Sparkles size={16} /> : <User size={16} />}
                  </div>

                  <div className="redcoach-bubble">
                    {/* Render any attached images */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="redcoach-msg-attachments">
                        {m.attachments.map((att) => (
                          <img
                            key={att.id}
                            src={att.url}
                            alt={att.name}
                            className="redcoach-msg-img"
                          />
                        ))}
                      </div>
                    )}

                    {m.notice && <p className="text-sm mb-2" role="status">{m.notice}</p>}
                    <div className="redcoach-bubble-text" role={m.error ? "alert" : undefined}>{m.content}</div>

                    <div className="redcoach-bubble-meta">
                      {m.model && <span title={m.modelId ? `Provider model: ${m.modelId}` : undefined}>{m.model}{m.modelId ? ` · ${m.modelId}` : ""}</span>}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Thinking state: "redCoach is thinking..." */}
            {loading && (
              <div className="redcoach-msg-row is-bot">
                <div className="redcoach-msg-avatar">
                  <Sparkles size={16} />
                </div>
                <div className="redcoach-bubble redcoach-thinking-bubble">
                  <span className="redcoach-pulse-dot" />
                  <span className="font-medium text-sm">
                    redCoach ({selectedLabel}) is thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Docked Input Card */}
          <div className="redcoach-bottom-dock">
            <div className="redcoach-chatbox-card">
              {/* Attachment preview thumbnails */}
              {attachments.length > 0 && (
                <div className="redcoach-attachments-strip">
                  {attachments.map((att) => (
                    <div key={att.id} className="redcoach-attachment-thumb">
                      <img src={att.url} alt={att.name} />
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="redcoach-attachment-remove"
                        aria-label="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input Textarea */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question..."
                className="redcoach-textarea"
                rows={1}
              />

              {/* Bottom Actions Bar */}
              <div className="redcoach-actions-bar">
                {/* Left Circular Buttons + Model Pill */}
                <div className="redcoach-actions-left">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuPlacement("above");
                        setShowModelMenu((v) => !v);
                      }}
                      className="redcoach-model-badge-btn"
                      title={`AI Model: ${selectedLabel} (click to change)`}
                    >
                      <Sparkles size={13} />
                      <span>{selectedLabel}</span>
                      <ChevronDown size={12} />
                    </button>
                    {showModelMenu && modelMenuPlacement === "above" && renderModelMenu("above")}
                  </div>

                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`redcoach-circle-btn ${isListening ? "is-recording" : ""}`}
                    title={isListening ? "Stop listening" : "Voice input"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="redcoach-circle-btn"
                    title="Upload SAT problem screenshot or diagram"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Right Pill Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!inputText.trim() && attachments.length === 0) || loading}
                  className="redcoach-send-pill"
                  title="Send message"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
