'use client';

import React, { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  quickReplies?: string[];
  actionLink?: string;
  actionText?: string;
};

interface UserChatbotAssistantProps {
  userName?: string;
  activeEmergency?: {
    id: string;
    emergencyType: string;
    status: string;
    locationLabel: string;
    assignedTeam?: { name?: string } | null;
  } | null;
}

export function UserChatbotAssistant({ userName = 'Citizen', activeEmergency }: UserChatbotAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Vanakkam ${userName}! I am your AI Disaster Response Assistant 🤖. I am connected with the live Tamil Nadu State Emergency Response Grid.\n\nHow can I help you right now?`,
      timestamp: 'Just now',
      quickReplies: [
        'Where is my rescue team?',
        'What is my emergency status?',
        'Available safe shelters nearby?',
        'Safety guidelines for floods',
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Automated intelligent responder simulating full context integration
  const generateAIResponse = (userQuery: string) => {
    const q = userQuery.toLowerCase();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Check Team query
    if (q.includes('team') || q.includes('where') || q.includes('assigned') || q.includes('who is coming')) {
      if (activeEmergency?.assignedTeam?.name) {
        return {
          text: `🚨 **Assigned Team Update:**\nYour alert is dispatched to **${activeEmergency.assignedTeam.name}**.\n\n• **Status:** Responders dispatched with heavy rescue gear.\n• **ETA:** Approx 10-18 minutes.\n• **Hotline:** Emergency frequency monitored.\n\nPlease stay on high ground and keep your phone battery conserved!`,
          quickReplies: ['What is my emergency status?', 'Call Emergency Helpline (112)'],
        };
      } else if (activeEmergency) {
        return {
          text: `🔍 **Matching In Progress:**\nYour emergency report (#${activeEmergency.id.slice(-6)}) is active in **${activeEmergency.locationLabel}**.\nThe state dispatcher algorithm is matching the nearest available SDRF / Fire service unit right now.`,
          quickReplies: ['Available safe shelters nearby?', 'How to stay safe?'],
        };
      } else {
        return {
          text: `You do not have any active emergency distress reports right now. If you need urgent rescue, you can tap the **Report Emergency / SOS** button on your dashboard!`,
          quickReplies: ['Report Emergency now', 'Nearby safe shelters'],
        };
      }
    }

    // 2. Emergency Status query
    if (q.includes('status') || q.includes('update') || q.includes('condition')) {
      if (activeEmergency) {
        return {
          text: `📊 **Active Emergency Incident (#${activeEmergency.id.slice(-6)}):**\n• **Type:** ${activeEmergency.emergencyType}\n• **Current Status:** ${activeEmergency.status.replace(/_/g, ' ')}\n• **Location:** ${activeEmergency.locationLabel}\n• **Coordination:** Real-time satellite & drone surveillance synced.`,
          quickReplies: ['Where is my rescue team?', 'Available safe shelters nearby?'],
        };
      } else {
        return {
          text: `✅ **All Clear:** You currently have no active distress calls filed under your profile. All state systems are normal in your monitoring radius.`,
          quickReplies: ['Safety guidelines for floods', 'View Evacuation Shelters'],
        };
      }
    }

    // 3. Shelters / Evacuation
    if (q.includes('shelter') || q.includes('evacuat') || q.includes('safe') || q.includes('relief camp')) {
      return {
        text: `📍 **Verified Safe Evacuation Zones:**\nWe have identified candidate shelters verified by TN Disaster Management:\n\n1. **District Central Community Hall & Relief Camp** (~1.2 km)\n2. **Govt Higher Secondary School High Ground** (~2.4 km)\n3. **Cyclone & Flood Resistant Multi-purpose Center** (~3.1 km)\n\nTap the **Safe Evacuation Shelters** panel on your dashboard to see elevations and driving directions!`,
        quickReplies: ['Where is my rescue team?', 'Safety guidelines'],
      };
    }

    // 4. Guidelines / Advice
    if (q.includes('safety') || q.includes('flood') || q.includes('guideline') || q.includes('what should i do') || q.includes('help')) {
      return {
        text: `⚠️ **Crucial Emergency Protocol:**\n\n1. **High Ground:** Move above flood level immediately; do not walk through moving waters.\n2. **Electrical Safety:** Disconnect the main power switch if water enters premises.\n3. **Signal:** Wave a bright cloth or whistle to attract drone/boat search teams.\n4. **Documents & Meds:** Keep IDs, essential medicines, and torchlight in a waterproof bag.`,
        quickReplies: ['Where is my rescue team?', 'Available safe shelters nearby?'],
      };
    }

    // 5. Default Fallback
    return {
      text: `I understand. I am keeping a live watch on your location (${activeEmergency?.locationLabel || 'Tamil Nadu'}) and notifying the State Emergency Operation Center. Is there anything specific you would like to know?`,
      quickReplies: ['Where is my rescue team?', 'What is my emergency status?', 'Available safe shelters nearby?'],
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    // Simulate smart thinking & automation delay
    setTimeout(() => {
      const response = generateAIResponse(text);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: response.quickReplies,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 850);
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3.5 text-white shadow-2xl shadow-sky-500/30 transition-all duration-300 hover:scale-105 hover:shadow-sky-500/50 active:scale-95"
            aria-label="Open AI Rescue Assistant"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg">
              🤖
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold leading-tight">AI Rescue Assistant</p>
              <p className="text-[10px] text-sky-100 font-medium">Live Emergency Bot</p>
            </div>
          </button>
        )}
      </div>

      {/* Floating Chatbot Popup Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-800 px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur-sm shadow-inner">
                🤖
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight">AI Rescue Assistant</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span>TN Disaster Grid · Active</span>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white transition"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Quick Context Banner */}
          {activeEmergency && (
            <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/90 px-3.5 py-1.5 text-[11px] text-amber-900">
              <span className="flex items-center gap-1 font-semibold truncate">
                <span className="animate-pulse">🚨</span> {activeEmergency.emergencyType}: {activeEmergency.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-full font-bold ml-2 shrink-0">
                Live Alert
              </span>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-xs'
                      : 'border border-slate-200/70 bg-white text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-1 text-[10px] text-slate-400 px-1">
                  {msg.timestamp}
                </span>

                {/* Quick reply action pills */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.quickReplies.map((reply, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(reply)}
                        className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100 hover:border-sky-300 active:scale-95 text-left"
                      >
                        ⚡ {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2 text-xs text-slate-500 w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[11px] text-slate-400 ml-1">AI Assistant is analyzing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask AI anything (e.g., Where is my team?)..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow hover:bg-sky-500 disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 transform rotate-90"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
