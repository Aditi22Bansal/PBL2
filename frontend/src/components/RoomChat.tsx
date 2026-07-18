"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/api";

interface RoomChatProps {
  roomId: string;
  currentUserEmail: string;
  currentUserName: string;
}

export default function RoomChat({ roomId, currentUserEmail, currentUserName }: RoomChatProps) {
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
      const res = await axios.get(
        `${API_URL}/api/chat/${roomId}?email=${encodeURIComponent(currentUserEmail)}`
      );
      setMessages(res.data);
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
      await axios.post(`${API_URL}/api/chat/${roomId}`, {
        email: currentUserEmail,
        name: currentUserName,
        message: tempMessage,
      });
      // Silent fetch to ensure consistency
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
    <div className="bg-[#F7F4EE] border border-[#1A3A2A]/10 rounded-[20px] overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-[#1A3A2A]/10 flex items-center gap-4">
        <div className="w-10 h-10 bg-[#EBF4EF] rounded-[10px] flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#2E6347]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1A3A2A] text-[15px]">Private Roommate Chat</h3>
          <p className="text-[12px] text-[#7A9088] mt-0.5">Only you and your roommates can see this.</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#1A3A2A]/10">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[#7A9088]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1A3A2A]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#7A9088]">
            <div className="w-16 h-16 bg-white border border-[#1A3A2A]/10 rounded-2xl flex items-center justify-center mb-4 text-[#1A3A2A]/20">
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
                      <span className="text-[11px] font-medium text-[#7A9088] mb-1.5 ml-1 mr-1">
                        {isMe ? "You" : msg.sender_name}
                      </span>
                    )}
                    <div
                      className={clsx(
                        "max-w-[75%] px-4 py-3 rounded-[14px]",
                        isMe
                          ? "bg-[#1A3A2A] text-white rounded-tr-sm"
                          : "bg-white border border-[#1A3A2A]/10 text-[#3A4F44] rounded-tl-sm shadow-sm"
                      )}
                    >
                      <p className="text-[14px] leading-relaxed">{msg.message}</p>
                      <span
                        className={clsx(
                          "text-[10px] mt-1.5 flex",
                          isMe ? "text-white/40 justify-end" : "text-[#7A9088] justify-end"
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
      <div className="p-4 bg-white border-t border-[#1A3A2A]/10">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            className="w-full bg-[#F7F4EE] outline-none border border-[#1A3A2A]/10 focus:border-[#C4613A] focus:bg-white transition-all rounded-full py-3.5 pl-6 pr-14 text-[#1A2820] placeholder:text-[#7A9088] text-[14px]"
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#C4613A] hover:bg-[#D4784F] disabled:opacity-50 transition-all rounded-full flex items-center justify-center shadow-md scale-95 hover:scale-100"
          >
            <Send className="w-4 h-4 text-white -ml-0.5 mt-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
