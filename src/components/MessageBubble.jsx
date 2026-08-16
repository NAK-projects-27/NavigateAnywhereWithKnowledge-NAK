// ============================================
// MessageBubble.jsx - Chat Message Component
// ============================================
// ENHANCED VERSION: Now supports embedded maps!
// This component displays chat messages and can render:
// - Regular text messages
// - Interactive maps (when AI sends map data)
// - Future: weather widgets, hotel cards, etc.

import PropTypes from 'prop-types';
import { User, Sparkles } from 'lucide-react';
import ChatMapBlock from './ChatMapBlock';

export default function MessageBubble({ role, content, timestamp }) {
    // STEP 1: Determine if this is a user or AI message
    const isUser = role === 'user';

    // STEP 2: Parse content to extract maps and text
    // =============================================
    // This function looks for special JSON blocks in the content
    // Format: ```json:map ... ```
    const parseContent = (text) => {
        const parts = [];
        let currentIndex = 0;
        
        // Regular expression to find map JSON blocks
        // Matches: ```json:map ... ```
        const mapRegex = /```json:map\s*\n([\s\S]*?)```/g;
        let match;

        // Find all map blocks in the message
        while ((match = mapRegex.exec(text)) !== null) {
            // Add text before the map
            if (match.index > currentIndex) {
                const textBefore = text.substring(currentIndex, match.index).trim();
                if (textBefore) {
                    parts.push({
                        type: 'text',
                        content: textBefore
                    });
                }
            }

            // Try to parse the JSON map data
            try {
                const mapData = JSON.parse(match[1]);
                parts.push({
                    type: 'map',
                    data: mapData
                });
            } catch (err) {
                // If JSON is invalid, just show it as text
                console.error('Failed to parse map JSON:', err);
                parts.push({
                    type: 'text',
                    content: match[0]
                });
            }

            currentIndex = match.index + match[0].length;
        }

        // Add any remaining text after the last map
        if (currentIndex < text.length) {
            const textAfter = text.substring(currentIndex).trim();
            if (textAfter) {
                parts.push({
                    type: 'text',
                    content: textAfter
                });
            }
        }

        // If no maps found, return the whole text as one part
        if (parts.length === 0) {
            parts.push({
                type: 'text',
                content: text
            });
        }

        return parts;
    };

    // Parse the message content
    const contentParts = parseContent(content);

    // STEP 3: Styling (same as before)
    const bubbleStyle = {
        maxWidth: '75%',
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

    // Format timestamp
    const formatTime = (time) => {
        if (!time) return '';
        const date = new Date(time);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // STEP 4: Render the message with embedded components
    // ===================================================
    return (
        <div style={bubbleStyle}>
            {/* Header (who sent it) */}
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

            {/* Content - can include text and maps */}
            {/* Content - can include text and maps */}
            <div>
                {contentParts.map((part, index) => {
                    if (part.type === 'text') {
                        // Render regular text
                        return (
                            <div key={index} style={contentStyle}>
                                {part.content}
                            </div>
                        );
                    } else if (part.type === 'map') {
                        // Render interactive map (geocodes names, then draws)
                        return <ChatMapBlock key={index} data={part.data} />;
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