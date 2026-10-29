"use client";

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
  timestamp: string;
  attachments?: Attachment[];
}

const STARTER_PROMPTS = [
  {
    title: "Solve linear systems with no solutions",
    category: "Math · Algebra",
    prompt: "How do I recognize when a system of two linear equations has no solution on the digital SAT?",
  },
  {
    title: "Contrast vs. concession transitions",
    category: "Reading & Writing",
    prompt: "How do I tell the difference between contrast transitions (like 'in contrast') and concession transitions (like 'nevertheless') on the Digital SAT? Give me short concrete examples and a quick rule.",
  },
  {
    title: "Circle equations in (x − 3)² + (y + 2)² = 25",
    category: "Math · Geometry",
    prompt: "How do I find the center and radius of (x − 3)² + (y + 2)² = 25 on the Digital SAT?",
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
  provider: "google" | "anthropic" | "openai" | "deepseek";
  desc: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: "Gemini 3.5 Flash",
    name: "Gemini 3.5 Flash",
    badge: "Free & Fast",
    provider: "google",
    desc: "Default · Instant math breakdowns & SAT strategies",
  },
  {
    id: "Gemini 2.5 Pro",
    name: "Gemini 2.5 Pro",
    badge: "Deep Reasoning",
    provider: "google",
    desc: "Advanced algebra, tricky geometry & complex figures",
  },
  {
    id: "Claude 3.5 Sonnet",
    name: "Claude 3.5 Sonnet",
    badge: "Top for Reading",
    provider: "anthropic",
    desc: "Nuanced transitions, textual evidence & rhetoric",
  },
  {
    id: "GPT-4o",
    name: "GPT-4o",
    badge: "Flagship",
    provider: "openai",
    desc: "High-precision Digital SAT problem solver",
  },
  {
    id: "GPT-4o Mini",
    name: "GPT-4o Mini",
    badge: "Speed & Grammar",
    provider: "openai",
    desc: "Fast punctuation & grammar conventions check",
  },
  {
    id: "DeepSeek R1",
    name: "DeepSeek R1",
    badge: "Math Specialist",
    provider: "deepseek",
    desc: "Deep step-by-step mathematical reasoning",
  },
];

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModel, setSelectedModel] = useState("Gemini 3.5 Flash");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [modelMenuPlacement, setModelMenuPlacement] = useState<"above" | "below">("above");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const isInitial = messages.length === 0;

  // Close model popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
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

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend !== undefined ? textToSend : inputText).trim();
      if (!text && attachments.length === 0) return;
      if (loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        model: selectedModel,
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
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            model: selectedModel,
            history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || data.error || "Sorry, I had trouble formulating a response.",
          model: data.model || selectedModel,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Network error: Unable to reach the coaching server. Please check your connection.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [inputText, attachments, loading, messages, selectedModel]
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
        <span className="redcoach-model-popover-title">AI Engine</span>
        <span className="redcoach-model-popover-badge">Multi-Model</span>
      </div>
      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        {AVAILABLE_MODELS.map((m) => {
          const isSelected = selectedModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedModel(m.id);
                setShowModelMenu(false);
              }}
              className={`redcoach-model-opt ${isSelected ? "active" : ""}`}
            >
              <div className="redcoach-model-opt-info">
                <div className="redcoach-model-opt-name">
                  <span>{m.name}</span>
                  <span className="redcoach-model-opt-tag">{m.badge}</span>
                </div>
                <div className="redcoach-model-opt-desc">{m.desc}</div>
              </div>
              {isSelected && <Check size={16} className="redcoach-model-opt-check" />}
            </button>
          );
        })}
      </div>
      <div className="redcoach-model-popover-footer">
        Gemini is free and active. Other providers activate when API keys are added in Vercel settings.
      </div>
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
              Your Digital SAT AI companion · Instant math step-by-step breakdowns, grammar rules &amp; test strategies
            </p>
          </div>

          {/* Centered AI Chatbox (Matching the exact UI design) */}
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
              placeholder="Type your thoughts..."
              className="redcoach-textarea"
              rows={1}
            />

            {/* Bottom Actions Bar */}
            <div className="redcoach-actions-bar">
              {/* Left Circular Buttons */}
              <div className="redcoach-actions-left">
                {/* 1. Sparkles Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuPlacement("above");
                      setShowModelMenu((v) => !v);
                    }}
                    className={`redcoach-circle-btn ${showModelMenu && modelMenuPlacement === "above" ? "active" : ""}`}
                    title={`AI Model: ${selectedModel} (click to change)`}
                    aria-label="Switch AI model"
                  >
                    <Sparkles size={16} />
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
                      <span>{selectedModel}</span>
                      <ChevronDown size={12} />
                    </button>
                    {showModelMenu && modelMenuPlacement === "below" && renderModelMenu("below")}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Instant plain-text SAT math breakdowns &amp; test strategies
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
                          <img key={att.id} src={att.url} alt={att.name} className="redcoach-msg-img" />
                        ))}
                      </div>
                    )}

                    <div className="redcoach-bubble-text">{m.content}</div>

                    <div className="redcoach-bubble-meta">
                      {m.model && <span>{m.model}</span>}
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
                  <span className="font-medium text-sm">redCoach is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Docked Input Card (Identical layout to the center card) */}
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
                placeholder="Type your thoughts..."
                className="redcoach-textarea"
                rows={1}
              />

              {/* Bottom Actions Bar */}
              <div className="redcoach-actions-bar">
                {/* Left Circular Buttons */}
                <div className="redcoach-actions-left">
                  {/* 1. Sparkles Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuPlacement("above");
                        setShowModelMenu((v) => !v);
                      }}
                      className={`redcoach-circle-btn ${showModelMenu && modelMenuPlacement === "above" ? "active" : ""}`}
                      title={`AI Model: ${selectedModel} (click to change)`}
                      aria-label="Switch AI model"
                    >
                      <Sparkles size={16} />
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
