"use client";

import React, { useState, useRef, useEffect } from "react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Sparkles, Bot, User, Trash2, ArrowRight } from "lucide-react";
import { RedCoachFormattedContent } from "@/components/study/redcoach-formatted-content";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  effort?: string;
  timestamp: string;
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
    title: "Circle equations in (x - h)² + (y - k)² = r²",
    category: "Math · Geometry",
    prompt: "How do I complete the square quickly to find the center and radius of a circle on the digital SAT?",
  },
  {
    title: "Score 1500+ study schedule",
    category: "Study Strategy",
    prompt: "I have 4 weeks until my SAT. Give me a realistic weekly schedule targeting a 1500+ score.",
  },
];

export function RedCoachChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello! I'm **redCoach**, your personal Digital SAT AI tutor on RedBookPrep. 

Ask me any math problem, grammar rule, reading question, or test-taking strategy. You can also pick a question topic below to get started!`,
      model: "Gemini 3.5 Flash",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (
    text: string,
    meta: { model: string; effort: string; attachments: File[] }
  ) => {
    if (!text.trim() && meta.attachments.length === 0) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      model: meta.model,
      effort: meta.effort,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          model: meta.model,
          effort: meta.effort,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || data.error || "Sorry, I had trouble formulating a response.",
        model: data.model || meta.model,
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
  };

  return (
    <div className="redcoach-page-wrapper">
      {/* Background radial gradient from the demo styling */}
      <div className="redcoach-ambient-bg" aria-hidden="true" />

      <div className="redcoach-inner-card">
        {/* Header */}
        <div className="redcoach-header">
          <div className="redcoach-header-left">
            <div className="redcoach-avatar-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="redcoach-title-row">
                <h2>Ask redCoach</h2>
                <span className="redcoach-badge">AI SAT Coach</span>
              </div>
              <p>Powered by free Gemini AI · Step-by-step math breakdowns &amp; test strategies</p>
            </div>
          </div>

          {messages.length > 1 && (
            <button
              type="button"
              onClick={() => setMessages(messages.slice(0, 1))}
              className="redcoach-clear-btn"
              title="Clear chat history"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="redcoach-messages-stream">
          {messages.map((m) => {
            const isBot = m.role === "assistant";
            return (
              <div
                key={m.id}
                className={`redcoach-msg-row ${isBot ? "is-bot" : "is-user"}`}
              >
                <div className="redcoach-msg-avatar">
                  {isBot ? <Sparkles size={15} /> : <User size={15} />}
                </div>

                <div className="redcoach-bubble">
                  {isBot ? (
                    <RedCoachFormattedContent content={m.content} />
                  ) : (
                    <div className="redcoach-bubble-text">{m.content}</div>
                  )}
                  <div className="redcoach-bubble-meta">
                    {m.model && <span>{m.model}</span>}
                    {m.effort && <span>· {m.effort} effort</span>}
                    <span>{m.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="redcoach-msg-row is-bot">
              <div className="redcoach-msg-avatar">
                <Sparkles size={15} />
              </div>
              <div className="redcoach-bubble redcoach-thinking">
                <span className="redcoach-pulse-dot" />
                <span>redCoach is analyzing and drafting your step-by-step breakdown...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Topic Starter Cards (when conversation is fresh) */}
        {messages.length <= 1 && (
          <div className="redcoach-starters-grid">
            {STARTER_PROMPTS.map((sp) => (
              <button
                key={sp.title}
                type="button"
                onClick={() =>
                  handleSendMessage(sp.prompt, {
                    model: "GPT 5.5",
                    effort: "Medium",
                    attachments: [],
                  })
                }
                className="redcoach-starter-card"
              >
                <div>
                  <small>{sp.category}</small>
                  <strong>{sp.title}</strong>
                </div>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Exact Aceternity / PromptInput Card Centered at Bottom */}
        <div className="redcoach-input-dock">
          <PromptInput
            onSubmit={handleSendMessage}
            placeholder="Ask anything..."
            className="mx-auto"
            models={["GPT 5.5", "Opus 4.8", "Gemini 3.5 Flash", "Composer 2.5", "GLM 5.2"]}
            efforts={["Low", "Medium", "Max Effort"]}
          />
        </div>
      </div>
    </div>
  );
}
