import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ChatInterface from "../components/ChatInterface";
import supabase from "../api/supabaseClient";
import {MessageSquare, Plus, ArrowLeft, Trash2} from 'lucide-react';
import '../styles/chat.css';
import { useSearchParams } from 'react-router-dom';

export default function Chat(){
    const {user} = useContext(AuthContext);
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationID] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const conversationFromUrl = searchParams.get('conversation');

    useEffect(() => {
        if(!user){
            navigate('/auth');
        }
    },[user,navigate]);

    useEffect(() => {
        if(user){
            loadConversations();
        }   
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[user]);

    async function loadConversations(){
        try{
            const {data, error} = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id',user.id)
            .order('updated_at', {ascending: false});

            if(error) {
                console.error('Error loading conversations:', error);
                throw error;
            }
            
            console.log('Loaded conversations:', data); // Debug log
            setConversations(data || []);

            // Only set current conversation if we don't have one selected or it doesn't exist
            // If the URL names a conversation and it belongs to this user,
            // open it. This is how the "Open the chat" link on a trip card
            // gets you back to where the trip came from.
            const urlMatch = conversationFromUrl
                && data?.find(c => c.id === conversationFromUrl);

            if (urlMatch) {
                setCurrentConversationID(conversationFromUrl);
            } else if(data && data.length > 0 && !currentConversationId){
                setCurrentConversationID(data[0].id);
            } else if (data && data.length > 0 && currentConversationId){
                // Check if current conversation still exists
                const exists = data.find(c => c.id === currentConversationId);
                if (!exists) {
                    setCurrentConversationID(data[0].id);
                }
            } else if (!data || data.length === 0) {
                setCurrentConversationID(null);
            }

        }catch(err){
            console.error('Error loading conversations:', err);
            alert('Failed to load conversations. Please refresh the page.');
        }finally{
            setLoading(false);
        }
    }

    async function handleNewConversation() {
        try{
            const {data, error} = await supabase
            .from('conversations')
            .insert([
                {
                    user_id: user.id,
                    title: 'New Chat', // Will be updated after first message
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
            ])
            .select()
            .single();

            if(error) {
                console.error('Insert error:', error);
                throw error;
            }

            console.log('Created new conversation:', data); // Debug log
            setConversations(prev => [data, ...prev]);
            setCurrentConversationID(data.id);

        }catch(err){
            console.error('Error creating conversation:', err);
            alert('Failed to create new chat. Please try again.');
        }
    }

    async function handleDeleteConversation(conversationId) {
        if(!window.confirm('Delete this conversation? This cannot be undone.')){
            return;
        }
        
        try{
            console.log('Attempting to delete conversation:', conversationId); // Debug log

            // First, delete all messages in this conversation
            const {error: messagesError} = await supabase
                .from('messages')
                .delete()
                .eq('conversation_id', conversationId);

            if(messagesError) {
                console.error('Error deleting messages:', messagesError);
                // Don't throw here, continue to try deleting the conversation
            } else {
                console.log('Messages deleted successfully');
            }

            // Then delete the conversation itself
            const {error: convError, data: deletedData} = await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId)
                .eq('user_id', user.id)
                .select(); // Add select to see what was deleted

            if(convError) {
                console.error('Error deleting conversation:', convError);
                throw convError;
            }
            
            console.log('Deleted conversation data:', deletedData); // Debug log

            // If we deleted the current conversation, switch to another one
            if(currentConversationId === conversationId){
                const remaining = conversations.filter(c => c.id !== conversationId);
                setCurrentConversationID(remaining[0]?.id || null); 
            }

            // Update local state - use strict equality
            setConversations(prev => prev.filter(c => c.id !== conversationId));

            console.log('Conversation deleted successfully');

            // Optionally reload conversations to ensure sync
            // setTimeout(() => loadConversations(), 100);

        }catch(err){
            console.error('Error deleting conversation:', err);
            alert(`Failed to delete conversation: ${err.message}. Please try again.`);
        }
    }

    // Function to update conversation title (call this from ChatInterface)
    async function updateConversationTitle(conversationId, newTitle) {
        try {
            console.log('Updating title for conversation:', conversationId, 'to:', newTitle); // Debug log

            const {error, data} = await supabase
                .from('conversations')
                .update({ 
                    title: newTitle,
                    updated_at: new Date().toISOString()
                })
                .eq('id', conversationId)
                .eq('user_id', user.id) // Extra security check
                .select(); // Add select to see what was updated

            if(error) {
                console.error('Update title error:', error);
                throw error;
            }

            console.log('Title updated successfully:', data); // Debug log

            // Update local state
            setConversations(prev => 
                prev.map(c => 
                    c.id === conversationId 
                        ? {...c, title: newTitle, updated_at: new Date().toISOString()}
                        : c
                )
            );

            // Reload conversations to ensure sync with database
            await loadConversations();

        } catch(err) {
            console.error('Error updating title:', err);
            alert(`Failed to update conversation title: ${err.message}`);
        }
    }

    if (loading) {
        return (
            <div className="app-center">
                <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
                    <MessageSquare size={40} style={{ 
                        margin: '0 auto 16px',
                        color: 'var(--neon-cyan)'
                    }} />
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                        Loading conversations...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-page">
            {/* ---------------------------------------- */}
            {/* SIDEBAR - List of conversations */}
            {/* ---------------------------------------- */}
            <div className="chat-sidebar">
                {/* Header */}
                <div className="sidebar-header">
                    <button 
                        onClick={() => navigate('/')}
                        className="btn-ghost"
                        style={{ padding: '8px 12px' }}
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    
                    <button 
                        onClick={handleNewConversation}
                        className="btn"
                        style={{ padding: '8px 16px' }}
                    >
                        <Plus size={16} /> New Chat
                    </button>
                </div>
                
                {/* Conversations list */}
                <div className="conversations-list">
                    {conversations.length === 0 ? (
                        <div className="empty-conversations">
                            <MessageSquare size={32} style={{ 
                                color: 'var(--muted)', 
                                marginBottom: 12 
                            }} />
                            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                                No conversations yet.<br />
                                Click "New Chat" to start!
                            </div>
                        </div>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${
                                    currentConversationId === conv.id ? 'active' : ''
                                }`}
                                onClick={() => setCurrentConversationID(conv.id)}
                            >
                                <div className="conversation-title">
                                    <MessageSquare size={16} />
                                    <span>{conv.title || 'New Chat'}</span>
                                </div>
                                
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteConversation(conv.id);
                                    }}
                                    className="delete-btn"
                                    title="Delete conversation"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {/* ---------------------------------------- */}
            {/* MAIN CHAT AREA */}
            {/* ---------------------------------------- */}
            <div className="chat-main">
                {currentConversationId ? (
                    <ChatInterface 
                        conversationId={currentConversationId}
                        onTitleUpdate={updateConversationTitle}
                    />
                ) : (
                    <div className="chat-empty-state">
                        <div className="empty-icon">💬</div>
                        <div className="empty-title">Start a conversation</div>
                        <div className="empty-subtitle">
                            Click "New Chat" to begin talking with NAK AI
                        </div>
                        <button 
                            onClick={handleNewConversation}
                            className="btn"
                            style={{ marginTop: 20 }}
                        >
                            <Plus size={16} /> Start First Chat
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}