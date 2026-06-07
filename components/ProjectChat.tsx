import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage, User, Project } from '../types';
import { XIcon, SendIcon, CopyIcon, CheckIcon, MessageSquareIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { JsonSyntaxHighlighter } from './JsonSyntaxHighlighter';
import { joinProjectRoom } from '../services/socketService';

interface ProjectChatProps {
    project: Project;
    projects: Project[];
    users: User[];
    currentUser: User;
    onlineUsers: Set<string>;
    onClose: () => void;
    onSendMessage: (projectId: string, text: string) => Promise<void>;
}

const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    } else {
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
        });
    }
};

const isJsonContent = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
        return false;
    }
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
};

const ChatBubble: React.FC<{ 
    message: ChatMessage;
    isCurrentUser: boolean;
    isOnline: boolean;
    users: User[];
}> = ({ message, isCurrentUser, isOnline, users }) => {
    const isJson = isJsonContent(message.text);
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(message.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const lines = message.text.split('\n');
    const hasMoreThan15Lines = lines.length > 15;

    const renderTextWithTags = (text: string) => {
        if (!text) return '';
        const escapeRegex = (str: string) => {
            if (!str || typeof str !== 'string') return '';
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        
        const sortedUsers = [...users]
            .filter(u => u && typeof u.name === 'string')
            .sort((a, b) => (b.name ? b.name.length : 0) - (a.name ? a.name.length : 0));

        const partsForRegex = [];
        partsForRegex.push('(https?:\\/\\/[^\\s]+)'); 
        const userNamesRegex = sortedUsers
            .map(u => escapeRegex(u.name))
            .filter(Boolean)
            .join('|');
        if (userNamesRegex) partsForRegex.push(`(@(?:${userNamesRegex}))`);

        if (partsForRegex.length === 0) return text;
        
        const regex = new RegExp(partsForRegex.join('|'), 'g');
        const elements: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const matchedText = match[0];
            const offset = match.index;

            if (offset > lastIndex) elements.push(text.substring(lastIndex, offset));

            if (matchedText.startsWith('http')) {
                elements.push(
                    <a key={offset} href={matchedText} target="_blank" rel="noopener noreferrer" className="hover:underline text-sky-400 font-medium" onClick={(e) => e.stopPropagation()}>{matchedText}</a>
                );
            } else if (matchedText.startsWith('@')) {
                const userName = matchedText.substring(1);
                elements.push(<strong key={offset} className="font-semibold rounded px-1.5 py-0.5 bg-sky-505/10 text-sky-400 text-[10px] border border-sky-500/10 whitespace-nowrap">@{userName}</strong>);
            }
            lastIndex = offset + matchedText.length;
        }
        if (lastIndex < text.length) elements.push(text.substring(lastIndex));
        return <>{elements}</>;
    };

    return (
        <div className="group flex items-start gap-3.5 py-3.5 px-4 sm:px-6 hover:bg-white/[0.015] border-b border-white/[0.03] transition-colors relative w-full text-left">
            <UserAvatar user={message.author} className="w-8 h-8 rounded-lg flex-shrink-0 text-xs text-white" isOnline={isOnline} />
            
            <div className="flex-grow min-w-0">
                {/* Header Row */}
                <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white truncate">
                        {message.author?.name || 'Collaborator'}
                    </span>
                    {isCurrentUser && (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 py-0.5 rounded-md shrink-0">
                            You
                        </span>
                    )}
                    <span className="text-[10px] text-gray-500 font-mono">
                        {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>

                {/* Message Text Block */}
                <div className="mt-1 text-xs text-gray-300 leading-relaxed max-w-full overflow-hidden">
                    {isJson ? (
                        <div className="mt-1.5">
                            <JsonSyntaxHighlighter data={message.text} />
                        </div>
                    ) : (
                        <div>
                            <p className="whitespace-pre-wrap break-words">
                                {renderTextWithTags(
                                    isExpanded || !hasMoreThan15Lines
                                        ? message.text
                                        : lines.slice(0, 15).join('\n') + ' ...'
                                )}
                            </p>
                            {hasMoreThan15Lines && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="mt-1 text-[10px] font-black uppercase tracking-wider block text-emerald-400 hover:text-emerald-300 transition-colors hover:underline cursor-pointer"
                                    type="button"
                                >
                                    {isExpanded ? 'Show Less' : 'Read More'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Floating Copy Option */}
            {!isJson && (
                <div className="absolute right-4 top-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-[#0D1112] border border-white/10 rounded-lg p-0.5 shadow-xl z-20">
                    <button 
                        onClick={handleCopy} 
                        className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer" 
                        title="Copy text"
                        type="button"
                    >
                        {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-405" /> : <CopyIcon className="w-3.5 h-3.5" />}
                    </button>
                </div>
            )}
        </div>
    );
};

export const ProjectChat: React.FC<ProjectChatProps> = ({ 
    project, 
    projects = [],
    users, 
    currentUser, 
    onlineUsers, 
    onClose, 
    onSendMessage 
}) => {
    const [newMessage, setNewMessage] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const [activeChatProjectId, setActiveChatProjectId] = useState(project.id);

    useEffect(() => {
        setActiveChatProjectId(project.id);
    }, [project.id]);

    useEffect(() => {
        if (activeChatProjectId) {
            joinProjectRoom(activeChatProjectId);
        }
    }, [activeChatProjectId]);

    const activeProjectObj = useMemo(() => {
        return (projects || []).find(p => p.id === activeChatProjectId) || project;
    }, [projects, activeChatProjectId, project]);

    const messagesToShow = useMemo(() => {
        return activeProjectObj.chatMessages || [];
    }, [activeProjectObj.chatMessages]);

    const [suggestionState, setSuggestionState] = useState<{ show: boolean; type: 'user' | null; query: string }>({ 
        show: false, 
        type: null, 
        query: '' 
    });
    const [activeIndex, setActiveIndex] = useState(0);

    const projectMembers = useMemo(() => 
        (activeProjectObj.members || []).map(id => users.find(u => u.id === id)).filter((u): u is User => !!u), 
        [activeProjectObj.members, users]
    );

    const filteredSuggestions = useMemo(() => {
        if (!suggestionState.show || !suggestionState.query) return [];
        const queryLower = suggestionState.query.toLowerCase();
        if (suggestionState.type === 'user') return projectMembers.filter(m => m.name.toLowerCase().includes(queryLower));
        return [];
    }, [suggestionState, projectMembers]);

    useEffect(() => { 
        setActiveIndex(0); 
    }, [filteredSuggestions]);
    
    const scrollToBottom = (smooth = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ 
                behavior: smooth ? "smooth" : "auto",
                block: "end"
            });
        }
    };

    // Instant scroll on initial load
    useEffect(() => {
        const timer = setTimeout(() => scrollToBottom(false), 50);
        return () => clearTimeout(timer);
    }, [activeChatProjectId]);

    // Smooth scroll when messages arrive
    useEffect(() => {
        scrollToBottom(true);
    }, [messagesToShow]);

    const handleNewMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setNewMessage(text);
        const cursorPos = e.target.selectionStart;
        const textToCursor = text.substring(0, cursorPos);
        const lastWordMatch = textToCursor.match(/[@](\w*)$/);

        if (lastWordMatch) {
            setSuggestionState({ show: true, type: 'user', query: lastWordMatch[1] });
        } else {
            setSuggestionState({ show: false, type: null, query: '' });
        }
    };

    const handleSuggestionSelect = (item: User) => {
        const text = newMessage;
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textToCursor = text.substring(0, cursorPos);
        const lastTriggerIndex = textToCursor.lastIndexOf('@');
        if (lastTriggerIndex === -1) return;

        const prefix = text.substring(0, lastTriggerIndex);
        const suffix = text.substring(cursorPos);
        const value = item.name;
        const newText = `${prefix}@${value} ${suffix}`;

        setNewMessage(newText);
        setSuggestionState({ show: false, type: null, query: '' });
        setTimeout(() => {
            textareaRef.current?.focus();
            const newCursorPos = lastTriggerIndex + value.length + 2;
            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (suggestionState.show && filteredSuggestions.length > 0) {
            if (e.key === 'ArrowDown') { 
                e.preventDefault(); 
                setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length); 
            } else if (e.key === 'ArrowUp') { 
                e.preventDefault(); 
                setActiveIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length); 
            } else if (e.key === 'Enter' || e.key === 'Tab') { 
                e.preventDefault(); 
                handleSuggestionSelect(filteredSuggestions[activeIndex]); 
            } else if (e.key === 'Escape') { 
                e.preventDefault(); 
                setSuggestionState({ show: false, type: null, query: '' }); 
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };
    
    const handleSubmit = async () => {
        if (newMessage.trim()) {
            await onSendMessage(activeChatProjectId, newMessage.trim());
            setNewMessage('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0E1314] z-[100] flex flex-row overflow-hidden">
            
            {/* Left Sidebar: Project listing */}
            <div className="w-16 md:w-64 border-r border-white/5 flex flex-col h-full bg-[#0B0E0F] shrink-0">
                    <div className="h-16 flex-shrink-0 border-b border-white/5 px-4 flex items-center justify-center md:justify-between bg-[#0E1314]/50">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white hidden md:block">Select Project</span>
                        <div className="p-1 rounded-md bg-white/5 text-gray-400 md:hidden" title="Switch Project Chat">
                            <MessageSquareIcon className="w-4 h-4 text-sky-400" />
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1.5 bg-[#090D0E]/30">
                        {(projects || []).map((proj) => {
                            const isActive = proj.id === activeChatProjectId;
                            return (
                                <button
                                    key={proj.id}
                                    onClick={() => setActiveChatProjectId(proj.id)}
                                    className={`w-full text-left p-2 md:p-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer select-none border group relative ${
                                        isActive 
                                            ? 'bg-sky-500/10 border-sky-500/25 text-white' 
                                            : 'hover:bg-white/[0.02] border-transparent text-gray-400 hover:text-gray-200'
                                    }`}
                                    title={proj.name}
                                    type="button"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 transition-transform group-hover:scale-105 ${
                                        isActive ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-gray-400'
                                    }`}>
                                        {proj.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-grow hidden md:block text-left">
                                        <h4 className="text-xs font-bold truncate">{proj.name}</h4>
                                        <p className="text-[9px] text-gray-500 truncate mt-0.5">
                                            {proj.members?.length || 0} members · {proj.chatMessages?.length || 0} msgs
                                        </p>
                                    </div>
                                    
                                    {/* Active project dot on mobile */}
                                    {isActive && (
                                        <div className="absolute top-1/2 -translate-y-1/2 right-2 w-1.5 h-1.5 bg-sky-400 rounded-full md:hidden" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Container: Active Chat View */}
                <div className="flex-grow h-full flex flex-col overflow-hidden relative">
                    
                    {/* Header matching minimal clean SaaS designs */}
                    <header className="h-16 flex-shrink-0 border-b border-white/5 bg-[#0E1314]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                                <MessageSquareIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white truncate">Project Pipeline Chat</h3>
                                <p className="text-[10px] text-gray-500 font-medium truncate">
                                    Connected to <span className="text-gray-300 font-bold">{activeProjectObj.name}</span> context
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer block"
                            title="Close Chat"
                            type="button"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </header>

                    {/* Message display listing viewport */}
                    <div ref={scrollContainerRef} className="flex-grow overflow-y-auto custom-scrollbar flex flex-col pt-2 pb-6">
                        {messagesToShow.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center py-20 px-6 text-center">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-gray-500 mb-4">
                                    <MessageSquareIcon className="w-5 h-5" />
                                </div>
                                <h4 className="text-xs font-bold text-gray-350 uppercase tracking-widest">No Context Signals</h4>
                                <p className="text-[11px] text-gray-500 max-w-sm mt-1 leading-relaxed">
                                    Share design blueprints, JSON updates, file codes, or mention members to stream information.
                                </p>
                            </div>
                        ) : (
                            messagesToShow.map((msg, index) => {
                                const currentDate = new Date(msg.createdAt).toDateString();
                                const prevDate = index > 0 ? new Date(messagesToShow[index - 1].createdAt).toDateString() : null;
                                const showDate = currentDate !== prevDate;

                                return (
                                    <React.Fragment key={msg.id}>
                                        {showDate && (
                                            <div className="flex justify-center my-6 sticky top-2 z-10 pointer-events-none">
                                                <span className="bg-[#141B1C]/90 backdrop-blur-md border border-white/5 text-gray-400 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase shadow-md">
                                                    {formatDateSeparator(msg.createdAt)}
                                                </span>
                                            </div>
                                        )}
                                        <ChatBubble 
                                            message={msg} 
                                            isCurrentUser={msg.author.id === currentUser.id} 
                                            isOnline={onlineUsers.has(msg.author.id)}
                                            users={projectMembers}
                                        />
                                    </React.Fragment>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} className="h-px w-full shrink-0" />
                    </div>

                    {/* Footer Message Input Section */}
                    <footer className="p-4 sm:p-6 border-t border-white/5 bg-[#0E1314] flex-shrink-0 relative">
                        {suggestionState.show && filteredSuggestions.length > 0 && (
                            <div className="absolute bottom-full left-4 sm:left-6 right-4 sm:right-6 mb-2 bg-[#141B1C] border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50 overflow-hidden">
                                <ul>
                                    {filteredSuggestions.map((item, index) => (
                                        <li 
                                            key={item.id} 
                                            onClick={() => handleSuggestionSelect(item)} 
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                                                index === activeIndex ? 'bg-white/5 text-sky-400' : 'text-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <UserAvatar user={item} className="w-5 h-5 flex-shrink-0 text-[10px]" />
                                                <span className="text-xs truncate font-bold">{item.name}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-mono">@{item.name.toLowerCase().replace(/\s+/g, '')}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
                            className="flex items-end gap-2.5 bg-[#0D1112] border border-white/10 rounded-2xl p-2 focus-within:border-sky-500/40 transition-colors"
                        >
                            <textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={handleNewMessageChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Message team, paste JSON, write details..."
                                className="w-full bg-transparent px-3 text-xs text-white placeholder-gray-500 focus:outline-none resize-none py-1.5 custom-scrollbar"
                                rows={1}
                                style={{ height: 'auto', maxHeight: '120px' }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                }}
                            />

                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className="p-2.5 bg-white disabled:bg-white/10 hover:bg-gray-200 text-black disabled:text-gray-600 rounded-xl transition-all flex-shrink-0 flex items-center justify-center cursor-pointer"
                                aria-label="Send message"
                            >
                                <SendIcon className="w-4 h-4"/>
                            </button>
                        </form>
                    </footer>
                </div>
        </div>
    );
};
