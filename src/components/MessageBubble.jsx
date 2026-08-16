// ============================================
// MessageBubble.jsx - Chat Message Component
// ============================================
// Renders a chat message and any rich blocks embedded in it.
//
// WHAT CHANGED FROM THE MAP-ONLY VERSION:
// The parser used to look for one specific pattern (```json:map).
// It now captures the block TYPE from the fence itself, so
// ```json:map and ```json:weather both work through the same code.
//
// To add a new block type later (hotels, events), you write the
// component and add one line to BLOCK_COMPONENTS below. The parser
// never changes again.
// ============================================

import PropTypes from 'prop-types';
import { User, Sparkles } from 'lucide-react';
import ChatMapBlock from './ChatMapBlock';
import ChatWeatherBlock from './ChatWeatherBlock';

// ============================================
// BLOCK REGISTRY
// ============================================
// Maps the word after "json:" in the fence to a React component.
// ```json:weather  ->  ChatWeatherBlock
const BLOCK_COMPONENTS = {
    map: ChatMapBlock,
    weather: ChatWeatherBlock,
    // hotels: ChatHotelsBlock,     <- Week 3
    // events: ChatEventsBlock,     <- Week 3
};

export default function MessageBubble({ role, content, timestamp }) {
    const isUser = role === 'user';

    // ============================================
    // PARSE CONTENT
    // ============================================
    // Splits a message into an ordered list of parts:
    //   { type: 'text',  content: '...' }
    //   { type: 'block', blockType: 'map', data: {...} }
    const parseContent = (text) => {
        const parts = [];
        let currentIndex = 0;

        // Group 1 = block type ("map", "weather")
        // Group 2 = the JSON payload
        const blockRegex = /```json:(\w+)\s*\n([\s\S]*?)```/g;
        let match;

        while ((match = blockRegex.exec(text)) !== null) {
            const [fullMatch, blockType, jsonText] = match;

            // Text that appeared before this block
            if (match.index > currentIndex) {
                const textBefore = text.substring(currentIndex, match.index).trim();
                if (textBefore) {
                    parts.push({ type: 'text', content: textBefore });
                }
            }

            // Only render block types we actually have a component for.
            // An unknown type falls through to plain text rather than
            // silently vanishing, so you can see what the AI produced.
            if (BLOCK_COMPONENTS[blockType]) {
                try {
                    parts.push({
                        type: 'block',
                        blockType,
                        data: JSON.parse(jsonText)
                    });
                } catch (err) {
                    console.error(`Failed to parse ${blockType} JSON:`, err);
                    parts.push({ type: 'text', content: fullMatch });
                }
            } else {
                console.warn(`Unknown block type: ${blockType}`);
                parts.push({ type: 'text', content: fullMatch });
            }

            currentIndex = match.index + fullMatch.length;
        }

        // Any text after the last block
        if (currentIndex < text.length) {
            const textAfter = text.substring(currentIndex).trim();
            if (textAfter) {
                parts.push({ type: 'text', content: textAfter });
            }
        }

        // No blocks at all - whole message is one text part
        if (parts.length === 0) {
            parts.push({ type: 'text', content: text });
        }

        return parts;
    };

    const contentParts = parseContent(content);

    // ============================================
    // STYLES
    // ============================================
    // Bubbles widen when they contain a block, since a 400px-tall
    // map squeezed into 75% width looks cramped.
    const hasBlock = contentParts.some(p => p.type === 'block');

    const bubbleStyle = {
        maxWidth: hasBlock ? '92%' : '75%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        padding: '14px 18px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser
            ? 'linear-gradient(135deg, var(--neon-cyan), var(--neon-indigo))'
            : 'rgba(255,255,255,0.03)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
        color: isUser ? '#031024' : '#e6eef6',
        boxShadow: isUser
            ? '0 8px 24px rgba(0,224,255,0.15)'
            : '0 4px 16px rgba(2,6,23,0.3)',
        marginBottom: '14px',
        animation: 'slideIn 0.3s ease-out',
    };

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '13px',
        fontWeight: 600,
        opacity: 0.8,
    };

    const contentStyle = {
        fontSize: '15px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
    };

    const formatTime = (time) => {
        if (!time) return '';
        const date = new Date(time);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // ============================================
    // RENDER
    // ============================================
    return (
        <div style={bubbleStyle}>
            {/* Header - who sent it */}
            <div style={headerStyle}>
                {isUser ? (
                    <>
                        <User size={16} />
                        <span>You</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={16} style={{ color: 'var(--neon-cyan)' }} />
                        <span style={{
                            background: 'linear-gradient(90deg, var(--neon-cyan), var(--neon-indigo))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            NAK AI
                        </span>
                    </>
                )}

                {timestamp && (
                    <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.6 }}>
                        {formatTime(timestamp)}
                    </span>
                )}
            </div>

            {/* Content - text and rich blocks, in the order they appeared */}
            <div>
                {contentParts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <div key={index} style={contentStyle}>
                                {part.content}
                            </div>
                        );
                    }

                    if (part.type === 'block') {
                        // Look up the component for this block type
                        const BlockComponent = BLOCK_COMPONENTS[part.blockType];
                        if (!BlockComponent) return null;
                        return <BlockComponent key={index} data={part.data} />;
                    }

                    return null;
                })}
            </div>
        </div>
    );
}

MessageBubble.propTypes = {
    role: PropTypes.oneOf(['user', 'assistant']).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
};