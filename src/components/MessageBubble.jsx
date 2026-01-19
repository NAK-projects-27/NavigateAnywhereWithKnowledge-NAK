import PropTypes from 'prop-types';
import {User, Sparkles} from 'lucide-react';

export default function MessageBubble({role, content, timestamp}){
    // STEP 1: Determine if this is a user or AI message
    const isUser = role === 'user';

    // STEP 2: Style differently based on who sent it
    // USER messages: Right side, blue gradient
    // AI messages: Left side, glass effect

    const bubbleStyle = {
        maxwidth : '75%' ,
        alignSelf : isUser ? 'flex-end' : 'flex-start',
        padding : '14px 18px',
        borderRadius : isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px' , 
        background: isUser ? 'linear-gradient(135deg , var(--neon-cyan), var(--neon-indigo))' : 'rgba(255,255,255,0.03)' ,
    
        // border: Only AI messages get a border
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
    
        // color: Text color
        color: isUser ? '#031024' : '#e6eef6',
    
        // boxShadow: Glow effect
        boxShadow: isUser ? '0 8px 24px rgba(0,224,255,0.15)' : '0 4px 16px rgba(2,6,23,0.3)',
    
        // marginBottom: Space between messages
        marginBottom: '14px',
    
        // animation: Slide in when message appears
        animation: 'slideIn 0.3s ease-out',

    };

    //STEP 3: Header style (who sent the message)

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '13px',
        fontWeight: 600,
        opacity: 0.8,
    };


    // STEP 4: Content style (the actual message)
    const contentStyle = {
        fontSize: '15px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap', 
    };

    // STEP 5: Format timestamp

    const formatTime = (time) => {
        if (!time) return '';
        const date = new Date(time);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
        });
    };

    return (
        <div style = {bubbleStyle}>
            <div style = {headerStyle}>
                {isUser ? (
                    <>
                        <User size = {16}/>
                        <span>You</span>
                    </>
                ) : (
                    <>
                        <Sparkles size = {16} style = {{color : 'var(--neon-cyan)'}}/>
                        <span style = {{background : 'linear-gradient(90deg, var(--neon-cyan), var(--neon-indigo))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                            NAK AI
                        </span>    
                    </>
                )}
                
                {timestamp && (
                    <span style = {{ marginLeft : 'auto' , fontSize : '11px', opacity : 0.6}}>
                        {formatTime(timestamp)}
                    </span>
                )}
            </div>

            <div style = {contentStyle}>
                {content}
            </div>
        </div>
    );
}

MessageBubble.propTypes = {
    role : PropTypes.oneOf(['user' , 'assistant']).isRequired,
    content : PropTypes.string.isRequired,
    timestamp : PropTypes.string,
};