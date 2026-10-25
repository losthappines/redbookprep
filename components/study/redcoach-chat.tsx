"use client";

import React, { useState, useRef, useEffect } from "react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Sparkles, Bot, User, Trash2, ArrowRight, Lightbulb, BookOpen, Target } from "lucide-react";

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
      model: "Gemini 2.5 Flash",
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
    } catch (err: any) {
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
    <div className="redcoach-container max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Ask redCoach <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">AI SAT Tutor</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Powered by free Gemini AI · Step-by-step math breakdowns &amp; test strategies
            </p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            type="button"
            onClick={() => setMessages(messages.slice(0, 1))}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition-colors"
          >
            <Trash2 size={13} />
            <span>Clear chat</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-4">
        {messages.map((m) => {
          const isBot = m.role === "assistant";
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isBot ? "items-start" : "items-start flex-row-reverse"}`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isBot
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-muted text-foreground border border-border"
                }`}
              >
                {isBot ? <Sparkles size={14} /> : <User size={14} />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  isBot
                    ? "bg-card border border-border text-foreground"
                    : "bg-purple-600 text-white"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={`mt-1.5 flex items-center gap-2 text-[10px] ${
                    isBot ? "text-muted-foreground" : "text-white/70 justify-end"
                  }`}
                >
                  {m.model && <span>{m.model}</span>}
                  {m.effort && <span>· {m.effort} effort</span>}
                  <span>{m.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="size-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple-500 animate-ping" />
              <span>redCoach is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts (shown when chat is fresh) */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {STARTER_PROMPTS.map((sp) => (
            <button
              key={sp.title}
              type="button"
              onClick={() => handleSendMessage(sp.prompt, { model: "Gemini 2.5 Flash", effort: "Medium", attachments: [] })}
              className="text-left p-2.5 rounded-xl border border-border/80 bg-card hover:bg-accent/40 hover:border-purple-500/50 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 block mb-0.5">
                  {sp.category}
                </span>
                <p className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors line-clamp-1">
                  {sp.title}
                </p>
              </div>
              <ArrowRight size={14} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {/* PromptInput Component */}
      <div className="pt-2 border-t border-border/40 flex justify-center w-full">
        <PromptInput
          onSubmit={handleSendMessage}
          placeholder="Ask redCoach anything about SAT Math, Reading, or strategy..."
          className="mx-auto"
          models={["Gemini 2.5 Flash", "Composer 2.5", "GPT 5.5", "Opus 4.8", "GLM 5.2"]}
          efforts={["Low", "Medium", "Max Effort"]}
        />
      </div>
    </div>
  );
}
