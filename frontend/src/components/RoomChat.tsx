"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { io, Socket } from "socket.io-client";
import { API_URL, PROXY_URL } from "@/lib/api";

interface RoomChatProps {
  roomId: string;
  currentUserEmail: string;
  currentUserName: string;
}

export default function RoomChat({ roomId, currentUserEmail, currentUserName }: RoomChatProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchMessages = async () => {
    if (!roomId) {
      if (loading) setLoading(false);
      return;
    }
    
    try {
      // Identity comes from the verified session via the proxy now, not a
      // client-supplied email query param.
      const res = await axios.get(`${PROXY_URL}/chat/${roomId}`);
      setMessages(res.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn("Room not found or no longer exists.");
      } else {
        console.error("Failed to fetch messages", err);
      }
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Setup Socket.IO
    if (!socketRef.current) {
        socketRef.current = io(API_URL);
    }

    const socket = socketRef.current;

    socket.emit("join_room", roomId);

    socket.on("receive_message", (data) => {
        // Prevent duplicate append if it was optimistically added
        setMessages(prev => {
            const exists = prev.find(m => m._id === data._id || (m.message === data.message && m.sender_email === data.sender_email && new Date(m.createdAt).getTime() > new Date().getTime() - 5000));
            if (exists && data._id) {
                // If it exists but we need to update the real database ID
                return prev.map(m => m === exists ? { ...m, _id: data._id } : m);
            }
            if (!exists) {
                return [...prev, data];
            }
            return prev;
        });
    });

    return () => {
        socket.off("receive_message");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUserEmail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;

    const tempMessage = newMessage;
    setNewMessage("");

    const newMsgData = {
      _id: Math.random().toString(),
      sender_email: currentUserEmail,
      sender_name: currentUserName,
      message: tempMessage,
      createdAt: new Date().toISOString(),
      roomId: roomId
    };

    // Optimistic UI update
    setMessages(prev => [...prev, newMsgData]);
    
    // Broadcast instantly
    socketRef.current?.emit("send_message", newMsgData);

    try {
      // Identity comes from the verified session via the proxy now, not
      // client-supplied email/name fields.
      await axios.post(`${PROXY_URL}/chat/${roomId}`, {
        message: tempMessage,
      });
      // Silent fetch to ensure consistency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn("Room not found or no longer exists.");
      } else {
        console.error("Failed to send", err);
      }
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-card rounded-[2rem] overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-6 py-5 bg-white/70 border-b border-stone-200 flex items-center gap-4">
        <div className="w-10 h-10 bg-teal-50 rounded-[10px] flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-800 text-[15px]">Private Roommate Chat</h3>
          <p className="text-[12px] text-stone-600 mt-0.5">Only you and your roommates can see this.</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-stone-300">
        {loading ? (
          <div className="h-full flex items-center justify-center text-stone-600">
            <Loader2 className="w-6 h-6 animate-spin text-stone-700" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-600">
            <div className="w-16 h-16 bg-white border border-stone-200 rounded-2xl flex items-center justify-center mb-4 text-stone-300">
                <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-sm">Say hello to your new roommates!</p>
          </div>
        ) : (
          <div className="space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isMe = msg.sender_email === currentUserEmail;
                const showHeader = idx === 0 || messages[idx - 1].sender_email !== msg.sender_email;

                return (
                  <motion.div
                    key={msg._id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx("flex flex-col w-full", isMe ? "items-end" : "items-start")}
                  >
                    {showHeader && (
                      <span className="text-[11px] font-medium text-stone-600 mb-1.5 ml-1 mr-1">
                        {isMe ? "You" : msg.sender_name}
                      </span>
                    )}
                    <div
                      className={clsx(
                        "max-w-[75%] px-4 py-3 rounded-[14px]",
                        isMe
                          ? "bg-teal-700 text-white rounded-tr-sm"
                          : "bg-white border border-stone-200 text-stone-700 rounded-tl-sm shadow-sm"
                      )}
                    >
                      <p className="text-[14px] leading-relaxed">{msg.message}</p>
                      <span
                        className={clsx(
                          "text-[10px] mt-1.5 flex",
                          isMe ? "text-white/60 justify-end" : "text-stone-600 justify-end"
                        )}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white/70 border-t border-stone-200">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            className="w-full bg-stone-50 outline-none border border-stone-200 focus:border-teal-600 focus:bg-white transition-all rounded-full py-3.5 pl-6 pr-14 text-stone-800 placeholder:text-stone-400 text-[14px]"
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-orange-700 hover:bg-orange-800 disabled:opacity-50 transition-all rounded-full flex items-center justify-center shadow-md scale-95 hover:scale-100"
          >
            <Send className="w-4 h-4 text-white -ml-0.5 mt-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
