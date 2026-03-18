import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Hi! I am your Namma Move AI. How can I help you with your Bengaluru commute today?' }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function sendMessage() {
        if (!input.trim()) return;
        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input, history: messages })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', text: "Sorry, my brain is a bit stuck in traffic. Try again?" }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="ai-assistant-wrapper">
            <button className="ai-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? '✕' : '🤖'}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="ai-chat-window"
                    >
                        <div className="ai-chat-header">
                            <strong>Namma AI Assistant</strong>
                            <span>Online</span>
                        </div>
                        <div className="ai-chat-messages">
                            {messages.map((m, i) => (
                                <div key={i} className={`msg-bubble ${m.role}`}>
                                    {m.text}
                                </div>
                            ))}
                            {loading && <div className="msg-bubble ai">Thinking...</div>}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="ai-chat-input">
                            <input 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                                placeholder="Ask me anything..."
                            />
                            <button onClick={sendMessage}>Send</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
