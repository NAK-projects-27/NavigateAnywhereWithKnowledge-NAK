// ============================================
// MessageBubble.jsx - Chat Message Component
// ============================================
// Renders a chat message and any rich blocks embedded in it.
//
// WHAT CHANGED IN THIS VERSION:
// Text parts used to render as raw strings, so Claude's **bold**,
// bullet lists, and headings showed up as literal asterisks and
// hyphens. They now go through react-markdown.
//
// The block parser is untouched - blocks are extracted BEFORE the
// markdown renderer ever sees the text, so a ```json:map fence can
// never be mistaken for a code block.
// ============================================

import PropTypes from 'prop-types';
import { User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatMapBlock from './ChatMapBlock';
import ChatWeatherBlock from './ChatWeatherBlock';

// ============================================
// BLOCK REGISTRY
// ============================================
const BLOCK_COMPONENTS = {
    map: ChatMapBlock,
    weather: ChatWeatherBlock,
    // events: ChatEventsBlock,     <- on hold
    // budget: ChatBudgetBlock,     <- next
};

// ============================================
// MARKDOWN STYLING
// ============================================
// react-markdown outputs plain HTML tags. Without overrides they
// inherit browser defaults - huge headings, big margins - which
// looks wrong inside a chat bubble. These map each tag to something
// bubble-sized.
//
// Defined outside the component so the object isn't rebuilt on every
// render, which would defeat react-markdown's memoisation.
const markdownComponents = {
    p: ({ children }) => (
        <p style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{children}</p>
    ),

    // Headings are deliberately close to body size. Claude sometimes
    // reaches for ## in a chat reply, and a 32px heading in a bubble
    // looks broken.
    h1: ({ children }) => <h3 style={headingStyle}>{children}</h3>,
    h2: ({ children }) => <h3 style={headingStyle}>{children}</h3>,
    h3: ({ children }) => <h3 style={headingStyle}>{children}</h3>,
    h4: ({ children }) => <h4 style={headingStyle}>{children}</h4>,

    ul: ({ children }) => (
        <ul style={{ margin: '0 0 10px', paddingLeft: '20px', lineHeight: 1.55 }}>
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol style={{ margin: '0 0 10px', paddingLeft: '20px', lineHeight: 1.55 }}>
            {children}
        </ol>
    ),
    li: ({ children }) => (
        <li style={{ marginBottom: '4px' }}>{children}</li>
    ),

    strong: ({ children }) => (
        <strong style={{ fontWeight: 700 }}>{children}</strong>
    ),

    a: ({ href, children }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}
        >
            {children}
        </a>
    ),

    // Inline code vs fenced code block. react-markdown passes
    // inline=true for the former.
    code: ({ inline, children }) => (
        inline ? (
            <code style={{
                background: 'rgba(255,255,255,0.08)',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace'
            }}>
                {children}
            </code>
        ) : (
            <code style={{
                display: 'block',
                background: 'rgba(0,0,0,0.3)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace',
                overflowX: 'auto',
                marginBottom: '10px'
            }}>
                {children}
            </code>
        )
    ),

    blockquote: ({ children }) => (
        <blockquote style={{
            margin: '0 0 10px',
            paddingLeft: '12px',
            borderLeft: '3px solid rgba(0,224,255,0.4)',
            opacity: 0.85
        }}>
            {children}
        </blockquote>
    ),

    hr: () => (
        <hr style={{
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            margin: '14px 0'
        }} />
    ),

    // Tables come from remark-gfm. Claude uses them for comparisons
    // fairly often, and unstyled they're unreadable.
    table: ({ children }) => (
        <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
            <table style={{
                borderCollapse: 'collapse',
                fontSize: '13.5px',
                width: '100%'
            }}>
                {children}
            </table>
        </div>
    ),
    th: ({ children }) => (
        <th style={{
            textAlign: 'left',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(0,224,255,0.25)',
            color: 'var(--neon-cyan)',
            fontWeight: 600,
            whiteSpace: 'nowrap'
        }}>
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td style={{
            padding: '6px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
            {children}
        </td>
    ),
};

const headingStyle = {
    fontSize: '15px',
    fontWeight: 700,
    margin: '2px 0 8px',
    color: '#eaf6ff'
};

export default function MessageBubble({ role, content, timestamp }) {
    const isUser = role === 'user';

    // ============================================
    // PARSE CONTENT
    // ============================================
    const parseContent = (text) => {
        const parts = [];
        let currentIndex = 0;

        const blockRegex = /```json:(\w+)\s*\n([\s\S]*?)```/g;
        let match;

        while ((match = blockRegex.exec(text)) !== null) {
            const [fullMatch, blockType, jsonText] = match;

            if (match.index > currentIndex) {
                const textBefore = text.substring(currentIndex, match.index).trim();
                if (textBefore) {
                    parts.push({ type: 'text', content: textBefore });
                }
            }

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

        if (currentIndex < text.length) {
            const textAfter = text.substring(currentIndex).trim();
            if (textAfter) {
                parts.push({ type: 'text', content: textAfter });
            }
        }

        if (parts.length === 0) {
            parts.push({ type: 'text', content: text });
        }

        return parts;
    };

    const contentParts = parseContent(content);

    // ============================================
    // STYLES
    // ============================================
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

    // CHANGED: whiteSpace: 'pre-wrap' removed for assistant messages.
    // Markdown handles its own line breaks, and pre-wrap on top of that
    // doubles every blank line. User messages keep it, since those are
    // raw text where typed newlines should be preserved.
    const userTextStyle = {
        fontSize: '15px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
    };

    const markdownWrapperStyle = {
        fontSize: '15px',
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
                        // CHANGED: user messages stay plain text. Rendering
                        // them as markdown would mangle anything they typed
                        // with asterisks or underscores in it.
                        if (isUser) {
                            return (
                                <div key={index} style={userTextStyle}>
                                    {part.content}
                                </div>
                            );
                        }

                        return (
                            <div key={index} style={markdownWrapperStyle}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={markdownComponents}
                                >
                                    {part.content}
                                </ReactMarkdown>
                            </div>
                        );
                    }

                    if (part.type === 'block') {
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