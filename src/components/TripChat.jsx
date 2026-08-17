// ============================================
// TripChat.jsx - Talk to an existing trip
// ============================================
// A side panel on TripDetail. The user describes a change in plain
// language; Claude returns operations; this applies them and tells
// the parent to reload.
//
// Chat history lives in component state only - it is not persisted.
// These are short editing exchanges, not conversations worth keeping.
// ============================================

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Send, Loader, Sparkles, AlertTriangle } from 'lucide-react';
import supabase from '../api/supabaseClient';
import { applyTripOperations, replaceItinerary } from '../api/tripEditApi';

export default function TripChat({ trip, onTripChanged }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // A full replacement waits here until the user confirms, because
    // it destroys any manual edits they've made.
    const [pendingReplacement, setPendingReplacement] = useState(null);

    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    async function handleSend(e) {
        e.preventDefault();
        if (!inputText.trim() || loading) return;

        const userMessage = inputText.trim();
        setInputText('');
        setError(null);
        setPendingReplacement(null);
        setLoading(true);

        const nextMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(nextMessages);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('trip-chat', {
                body: {
                    tripId: trip.id,
                    message: userMessage,
                    // Send prior turns so follow-ups like "actually make
                    // it 3pm" have something to refer back to.
                    history: messages.slice(-6)
                }
            });

            if (fnError) throw fnError;

            const reply = data.message || '';
            const parsed = extractBlock(reply);

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: parsed.text || reply
            }]);

            // ---- Targeted operations: apply immediately ----
            if (parsed.type === 'tripops' && parsed.data?.operations?.length) {
                const result = await applyTripOperations({
                    trip,
                    operations: parsed.data.operations
                });

                if (result.applied.length > 0) {
                    setMessages(prev => [...prev, {
                        role: 'system',
                        content: result.applied.join(' · ')
                    }]);
                    onTripChanged();
                }

                if (result.failed.length > 0) {
                    setMessages(prev => [...prev, {
                        role: 'error',
                        content: `Couldn't apply: ${result.failed.join('; ')}`
                    }]);
                }
            }

            // ---- Full replacement: hold for confirmation ----
            if (parsed.type === 'itinerary' && parsed.data?.days?.length) {
                setPendingReplacement(parsed.data);
            }

        } catch (err) {
            // On a NETWORK failure err.context is a Request, which has no
            // .json() method - calling it throws a TypeError that masks
            // the real error. Only read it when it's actually a Response.
            if (err.context && typeof err.context.json === 'function') {
                const body = await err.context.json().catch(() => null);
                console.error('TRIP CHAT ERROR:', body);
            }
            console.error('Trip chat failed:', err);
            setError('Something went wrong. Try again.');
        } finally {
            setLoading(false);
        }
    }

    async function confirmReplacement() {
        setLoading(true);
        setError(null);

        try {
            await replaceItinerary({
                tripId: trip.id,
                itinerary: pendingReplacement
            });

            setPendingReplacement(null);
            setMessages(prev => [...prev, {
                role: 'system',
                content: 'Trip rebuilt'
            }]);
            onTripChanged();

        } catch (err) {
            console.error('Replacement failed:', err);
            setError('Could not rebuild the trip');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="card" style={{ marginTop: 20 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14
            }}>
                <Sparkles size={16} style={{ color: 'var(--neon-cyan)' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#eaf6ff' }}>
                    Edit with NAK
                </div>
            </div>

            {messages.length === 0 && (
                <div style={{
                    fontSize: 13.5,
                    color: 'var(--muted)',
                    marginBottom: 14,
                    lineHeight: 1.5
                }}>
                    Ask for changes in plain language — &quot;move dinner to 8pm&quot;,
                    &quot;swap day 2 for something indoors&quot;, &quot;add a beach stop
                    after Kochi&quot;.
                </div>
            )}

            {/* ---------- MESSAGES ---------- */}
            {messages.length > 0 && (
                <div style={{
                    maxHeight: 320,
                    overflowY: 'auto',
                    marginBottom: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                }}>
                    {messages.map((message, index) => (
                        <MessageRow key={index} message={message} />
                    ))}
                    <div ref={endRef} />
                </div>
            )}

            {loading && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: 'var(--neon-cyan)',
                    marginBottom: 12
                }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Working on it...
                </div>
            )}

            {/* ---------- FULL REPLACEMENT CONFIRMATION ---------- */}
            {pendingReplacement && (
                <div style={{
                    padding: 14,
                    borderRadius: 10,
                    background: 'rgba(255,176,32,0.06)',
                    border: '1px solid rgba(255,176,32,0.3)',
                    marginBottom: 14
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#ffb020',
                        marginBottom: 6
                    }}>
                        <AlertTriangle size={15} />
                        This rebuilds the whole trip
                    </div>

                    <div style={{
                        fontSize: 13,
                        color: '#e6eef6',
                        opacity: 0.8,
                        marginBottom: 12,
                        lineHeight: 1.5
                    }}>
                        Every existing day and activity will be replaced with
                        {' '}{pendingReplacement.days.length} new day
                        {pendingReplacement.days.length === 1 ? '' : 's'}.
                        Any edits you made by hand will be lost.
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setPendingReplacement(null)}
                            className="btn-ghost"
                            style={{ padding: '7px 14px', fontSize: 13 }}
                        >
                            Keep what I have
                        </button>
                        <button
                            onClick={confirmReplacement}
                            className="btn"
                            style={{ padding: '7px 14px', fontSize: 13 }}
                        >
                            Rebuild trip
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div style={{
                    padding: '10px 12px',
                    borderRadius: 9,
                    background: 'rgba(255,100,100,0.08)',
                    border: '1px solid rgba(255,100,100,0.2)',
                    color: '#ff9aa2',
                    fontSize: 13,
                    marginBottom: 12
                }}>
                    {error}
                </div>
            )}

            {/* ---------- INPUT ---------- */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
                <input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="What would you like to change?"
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: '11px 14px',
                        borderRadius: 10,
                        background: 'rgba(6,9,16,0.45)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#e6eef6',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none'
                    }}
                />
                <button
                    type="submit"
                    disabled={loading || !inputText.trim()}
                    className="btn"
                    style={{
                        padding: '11px 15px',
                        opacity: (loading || !inputText.trim()) ? 0.5 : 1
                    }}
                >
                    <Send size={17} />
                </button>
            </form>
        </div>
    );
}

function MessageRow({ message }) {
    // System and error rows are status lines, not conversation
    if (message.role === 'system') {
        return (
            <div style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--neon-cyan)',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(0,224,255,0.06)'
            }}>
                ✓ {message.content}
            </div>
        );
    }

    if (message.role === 'error') {
        return (
            <div style={{
                fontSize: 12.5,
                color: '#ff9aa2',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255,100,100,0.06)'
            }}>
                {message.content}
            </div>
        );
    }

    const isUser = message.role === 'user';

    return (
        <div style={{
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '9px 13px',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background: isUser
                ? 'linear-gradient(135deg, var(--neon-cyan), var(--neon-indigo))'
                : 'rgba(255,255,255,0.03)',
            border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: isUser ? '#031024' : '#e6eef6',
            fontSize: 13.5,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap'
        }}>
            {message.content}
        </div>
    );
}

MessageRow.propTypes = {
    message: PropTypes.shape({
        role: PropTypes.string.isRequired,
        content: PropTypes.string.isRequired
    }).isRequired
};

/**
 * Pull the first json:tripops or json:itinerary block out of a reply,
 * returning it plus the surrounding prose.
 */
function extractBlock(text) {
    const regex = /```json:(tripops|itinerary)\s*\n([\s\S]*?)```/;
    const match = text.match(regex);

    if (!match) {
        return { type: null, data: null, text: text.trim() };
    }

    let data = null;
    try {
        data = JSON.parse(match[2]);
    } catch (err) {
        console.error('Failed to parse block:', err);
        return { type: null, data: null, text: text.trim() };
    }

    return {
        type: match[1],
        data,
        text: text.replace(match[0], '').trim()
    };
}

TripChat.propTypes = {
    trip: PropTypes.object.isRequired,
    onTripChanged: PropTypes.func.isRequired
};