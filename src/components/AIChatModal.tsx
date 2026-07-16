import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Bot, Check, XCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../lib/gemini";
import { formatCurrency, getCurrentDate, CATEGORIES } from '../lib/utils';
import { CustomCategory } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  transactionData?: any;
  confirmed?: boolean;
}

export const AIChatModal = ({
  isOpen,
  onClose,
  onAddTransaction,
  customCategories
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (data: any) => void;
  customCategories: CustomCategory[];
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Hi! Send me a message like "Spent ₹60 on tea via UPI" and I will log it for you.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const allCategories = [...CATEGORIES, ...customCategories];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is missing");
      const ai = new GoogleGenAI({ apiKey });

      const catList = allCategories.map(c => `{ id: "${c.id}", name: "${c.name}" }`).join(", ");

      const prompt = `
You are a financial logger assistant. 
The user's message is: "${userMessage.text}"
Today's date is: ${getCurrentDate()}

Extract the financial transaction details and return ONLY a valid JSON object matching this schema:
{
  "title": "string (brief title of the item/service)",
  "amount": number (positive number),
  "type": "expense" or "income",
  "category": "string (MUST be one of the 'id' from this list: ${catList}) - guess the closest one if not sure",
  "paymentMethod": "string (e.g. UPI, Cash, Card, Net Banking)",
  "date": "YYYY-MM-DD" (use today's date if not specified)
}

If the user is NOT logging a transaction, return ONLY:
{ "error": "Not a financial transaction log." }

DO NOT return any other text, markdown formatting, or codeblocks. Just the raw JSON format.
`;
      const response = await generateContentWithFallback(ai, prompt, { json: true });

      let responseText = response.text || "";
      responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const parsed = JSON.parse(responseText);

      if (parsed.error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          text: "I couldn't detect a transaction in that message. Try saying something like 'Spent 500 on groceries'."
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          text: "I've extracted the following details. Should I log this?",
          transactionData: parsed
        }]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: "Sorry, I couldn't process that right now. Please try again or make sure you are connected to the internet."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirm = (msgId: string, transactionData: any) => {
    onAddTransaction({
      title: transactionData.title,
      amount: transactionData.amount,
      type: transactionData.type,
      category: transactionData.category,
      paymentMethod: transactionData.paymentMethod || 'Other',
      date: transactionData.date || getCurrentDate(),
      note: 'Logged via AI Chat'
    });

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmed: true } : m));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      text: `Successfully logged ${formatCurrency(transactionData.amount)} for ${transactionData.title}!`
    }]);
  };

  const handleCancel = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmed: false } : m));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      text: "Cancelled. Let me know if you want to log something else."
    }]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="app-chat-sheet relative bg-surface-container-lowest w-full h-[85vh] rounded-t-[32px] sm:max-w-md sm:mx-auto shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-primary text-on-primary shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Bot size={24} />
                <h2 className="font-medium text-lg">AI Quick Log</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface max-h-full">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-[20px] p-3 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-on-primary rounded-tr-sm' 
                      : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-tl-sm'
                  }`}>
                    <p className="text-[15px] leading-relaxed">{msg.text}</p>
                    
                    {msg.transactionData && msg.confirmed === undefined && (
                      <div className="mt-3 bg-surface-container-low rounded-xl p-3 border border-outline-variant/30 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-1.5 text-xs text-on-surface">
                          <span className="text-on-surface-variant">Title:</span>
                          <span className="font-medium text-right truncate" title={msg.transactionData.title}>{msg.transactionData.title}</span>
                          <span className="text-on-surface-variant">Amount:</span>
                          <span className="font-semibold text-right text-primary">{formatCurrency(msg.transactionData.amount)}</span>
                          <span className="text-on-surface-variant">Type:</span>
                          <span className="font-medium text-right capitalize">{msg.transactionData.type}</span>
                          <span className="text-on-surface-variant">Category:</span>
                          <span className="font-medium text-right truncate" title={allCategories.find(c => c.id === msg.transactionData.category)?.name || msg.transactionData.category}>
                            {allCategories.find(c => c.id === msg.transactionData.category)?.name || msg.transactionData.category}
                          </span>
                          <span className="text-on-surface-variant">Mode:</span>
                          <span className="font-medium text-right">{msg.transactionData.paymentMethod || 'Other'}</span>
                          <span className="text-on-surface-variant">Date:</span>
                          <span className="font-medium text-right">{msg.transactionData.date}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button 
                            onClick={() => handleConfirm(msg.id, msg.transactionData)}
                            className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                          >
                            <Check size={16} /> Confirm
                          </button>
                          <button 
                            onClick={() => handleCancel(msg.id)}
                            className="flex-1 bg-error-container text-on-error-container py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                          >
                            <XCircle size={16} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.transactionData && msg.confirmed === true && (
                      <div className="mt-2 text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md inline-flex items-center gap-1">
                        <Check size={12} /> Logged
                      </div>
                    )}
                    {msg.transactionData && msg.confirmed === false && (
                      <div className="mt-2 text-xs font-medium bg-error/10 text-error px-2 py-1 rounded-md inline-flex items-center gap-1">
                        <X size={12} /> Discarded
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant rounded-[20px] p-4 rounded-tl-sm shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-surface-container-lowest p-4 pb-safe border-t border-outline-variant/30 relative z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="E.g. Spent ₹150 on coffee via UPI"
                  className="flex-1 bg-surface-container border border-outline-variant/50 rounded-full h-12 px-5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium text-on-surface"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="w-12 h-12 flex-shrink-0 bg-primary text-on-primary rounded-full flex items-center justify-center disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-primary/20 active:scale-95 transition-all"
                >
                  <Send size={18} className="translate-x-[1px] translate-y-[1px]" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
