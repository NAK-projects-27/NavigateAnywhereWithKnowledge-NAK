import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import MessageBubble from './MessageBubble';
import { Send, Loader } from 'lucide-react';
import supabase from '../api/supabaseClient';
import SaveTripButton from './SaveTripButton';

export default function ChatInterface({ conversationId, onTitleUpdate }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [titleGenerated, setTitleGenerated] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    async function loadMessages() {
        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            setMessages(data || []);

            // If there are messages, assume title was generated
            setMessages(data || []);

            // CHANGED: assign the boolean rather than only ever setting true.
            // Without this, switching from an old conversation to a new one
            // leaves the flag stuck on and the title never generates.
            setTitleGenerated(!!(data && data.length > 0));
        } catch (err) {
            console.error('Error loading messages:', err);
            setError('Failed to load messages');
        }
    }

    function scrollToBottom() {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    }

    // Generate title from first message
    function generateTitle(userMessage) {
        let title = userMessage;

        // If message is longer than 50 chars, cut it at a word boundary
        if (title.length > 50) {
            title = title.substring(0, 50);
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 30) {
                title = title.substring(0, lastSpace);
            }
            title += '...';
        }

        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);

        return title;
    }

    async function handleSendMessage(e) {
        e.preventDefault();

        if (!inputText.trim()) return;
        if (loading) return;

        const userMessage = inputText.trim();
        const isFirstMessage = messages.length === 0;

        setInputText('');
        setLoading(true);
        setError(null);

        try {
            // Step 1: Add user message to UI immediately
            const tempUserMessage = {
                id: 'temp-' + Date.now(),
                role: 'user',
                content: userMessage,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, tempUserMessage]);

            // Step 2: If this is the first message, generate and update title
            if (isFirstMessage && onTitleUpdate && !titleGenerated) {
                const newTitle = generateTitle(userMessage);
                await onTitleUpdate(conversationId, newTitle);
                setTitleGenerated(true);
            }

            // Step 3: Call edge function to get AI response
            const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat', {
                body: {
                    message: userMessage,
                    conversationId: conversationId,
                }
            });

            if (aiError) throw aiError;

            // Step 4: Add AI response to UI
            const aiMessage = {
                id: 'temp-ai-' + Date.now(),
                role: 'assistant',
                content: aiResponse.message,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMessage]);

            // Step 5: Reload all messages from database to get real IDs
            await loadMessages();

        } catch (err) {
            // Surface the edge function's own error body - a bare 500
            // tells you nothing, this tells you what actually failed.
            if (err.context) {
                const body = await err.context.json().catch(() => null);
                console.error('EDGE FUNCTION ERROR:', body);
            }
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
            setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
        } finally {
            setLoading(false);
        }
    }

    // CHANGED: onKeyPress is deprecated in React and doesn't fire for
    // every key in all browsers. onKeyDown is the supported equivalent.
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    }

    // CHANGED: only offer Save Trip once the AI has actually replied.
    // Saving an empty conversation produces a trip with no stops.
    const hasAssistantReply = messages.some(m => m.role === 'assistant');

    return (
        <div style={styles.container}>
            {/* ---------- TOOLBAR ---------- */}
            {/* CHANGED: only rendered once there's something worth saving,
                so the button isn't sitting there greyed out on a new chat. */}
            {hasAssistantReply && (
                <div style={styles.toolbar}>
                    <SaveTripButton
                        conversationId={conversationId}
                        conversationTitle={messages[0]?.content}
                    />
                </div>
            )}

            <div style={styles.messagesArea}>
                {messages.length === 0 && (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>✨</div>
                        <div style={styles.emptyTitle}>Start a conversation</div>
                        <div style={styles.emptySubtitle}>
                            Ask me anything about travel, destinations, or trip planning!
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <MessageBubble
                        key={message.id}
                        role={message.role}
                        content={message.content}
                        timestamp={message.created_at}
                        conversationId={conversationId}
                    />
                ))}

                {loading && (
                    <div style={styles.loadingBubble}>
                        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>NAK is thinking...</span>
                    </div>
                )}

                {error && (
                    <div style={styles.errorMessage}>
                        {error}
                    </div>
                )}

                {/* Invisible div at bottom - used for auto-scroll */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} style={styles.inputForm}>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask NAK anything about travel..."
                    style={styles.input}
                    rows={1}
                    disabled={loading}
                />

                <button
                    type="submit"
                    disabled={loading || !inputText.trim()}
                    style={{
                        ...styles.sendButton,
                        opacity: (loading || !inputText.trim()) ? 0.5 : 1,
                        cursor: (loading || !inputText.trim()) ? 'not-allowed' : 'pointer',
                    }}
                >
                    {loading ? (
                        <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Send size={20} />
                    )}
                </button>
            </form>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
    },

    // CHANGED: new style block for the Save Trip row.
    // flexShrink: 0 keeps it from being squeezed by the messages area.
    toolbar: {
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '10px 16px 0',
        flexShrink: 0,
    },

    messagesArea: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
    },

    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
    },

    emptyIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },

    emptyTitle: {
        fontSize: '20px',
        fontWeight: 700,
        marginBottom: '8px',
        color: '#eaf6ff',
    },

    emptySubtitle: {
        fontSize: '14px',
        color: 'var(--muted)',
    },

    loadingBubble: {
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 18px',
        borderRadius: '18px 18px 18px 4px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--neon-cyan)',
        fontSize: '14px',
        marginBottom: '14px',
    },

    errorMessage: {
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(255,100,100,0.1)',
        border: '1px solid rgba(255,100,100,0.2)',
        color: '#ff9aa2',
        fontSize: '14px',
        marginBottom: '14px',
    },

    inputForm: {
        display: 'flex',
        gap: '12px',
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
    },

    input: {
        flex: 1,
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(6,9,16,0.45)',
        border: '1px solid rgba(255,255,255,0.04)',
        color: '#e6eef6',
        fontSize: '15px',
        fontFamily: 'inherit',
        resize: 'none',
        maxHeight: '120px',
        outline: 'none',
    },

    sendButton: {
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'linear-gradient(90deg, var(--neon-cyan), var(--neon-indigo))',
        border: 'none',
        color: '#031024',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0,224,255,0.15)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    },
};

ChatInterface.propTypes = {
    conversationId: PropTypes.string.isRequired,
    onTitleUpdate: PropTypes.func,
};