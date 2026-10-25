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
    title: "Master transition words in reading",
    category: "Reading & Writing",
    prompt: "Give me the top 5 transition word traps on the digital SAT and how to avoid picking the wrong contrast transition.",
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

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedModel, setSelectedModel] = useState("Gemini 3.5 Flash");
  const [showModelMenu, setShowModelMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const isInitial = messages.length === 0;

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
                    onClick={() => setShowModelMenu((v) => !v)}
                    className="redcoach-circle-btn"
                    title={`AI Model: ${selectedModel}`}
                  >
                    <Sparkles size={16} />
                  </button>
                  {showModelMenu && (
                    <div className="redcoach-model-popover">
                      <div className="text-xs font-semibold px-2 py-1 text-muted-foreground">
                        Selected AI Engine
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel("Gemini 3.5 Flash");
                          setShowModelMenu(false);
                        }}
                        className={`redcoach-model-opt ${
                          selectedModel === "Gemini 3.5 Flash" ? "active" : ""
                        }`}
                      >
                        <Sparkles size={14} />
                        <span>Gemini 3.5 Flash (Free &amp; Fast)</span>
                      </button>
                    </div>
                  )}
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
                  <span className="redcoach-badge">Active Session</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Powered by {selectedModel} · Plain-text SAT math &amp; strategy
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
                  <button
                    type="button"
                    onClick={() => setShowModelMenu((v) => !v)}
                    className="redcoach-circle-btn"
                    title={`AI Model: ${selectedModel}`}
                  >
                    <Sparkles size={16} />
                  </button>

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
