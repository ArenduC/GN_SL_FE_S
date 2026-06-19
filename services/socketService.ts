import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentProjectId: string | null = null;
let currentToken: string | null = null;
let messageCallback: ((payload: any) => void) | null = null;
let presenceCallback: ((data: any) => void) | null = null;

export const getSocketUrl = (): string => {
    return 'https://robinson-conditioning-specialty-customs.trycloudflare.com';
};

export const getSocket = (): Socket | null => {
    return socket;
};

export const initSocket = (
    token: string, 
    onMessageReceived: (message: any) => void,
    onPresenceSynced?: (data: any) => void
) => {
    // Keep the local callback references updated with the latest React cycle callback
    messageCallback = onMessageReceived;
    if (onPresenceSynced) {
        presenceCallback = onPresenceSynced;
    }

    // If socket is already initialized with the same token, don't re-initialize
    if (socket && currentToken === token) {
        return socket;
    }

    // If socket exists but token changed, disconnect the old one
    if (socket) {
        console.log('Reconnecting WebSocket with updated token.');
        socket.disconnect();
    }

    currentToken = token;

    try {
        const socketUrl = getSocketUrl();
        console.log(`Initializing Socket.IO connection to ${socketUrl}`);
        socket = io(socketUrl, {
            auth: {
                token: token
            },
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5, // Graceful retry limits to avoid infinite spamming
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            console.log(`Successfully connected to WebSocket API at ${socketUrl}`);
            if (currentProjectId) {
                // Re-join active room on connection or reconnection
                console.log(`Re-joining active project room: ${currentProjectId}`);
                socket?.emit("room:join", { projectId: currentProjectId });
                socket?.emit("room", { projectId: currentProjectId });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from WebSocket API:', reason);
        });

        socket.on('connect_error', (error) => {
            console.warn('WebSocket connection gracefully warning:', error.message || error);
        });

        // Listen for chat broadcast - execute the up-to-date callback
        socket.on('chat:broadcast', (payload: any) => {
            console.log('Received chat:broadcast via WebSocket:', payload);
            if (payload && messageCallback) {
                messageCallback(payload);
            }
        });

        // Listen for standard chat event - execute the up-to-date callback
        socket.on('chat', (payload: any) => {
            console.log('Received chat event via WebSocket:', payload);
            if (payload && messageCallback) {
                messageCallback(payload);
            }
        });

        // Listen for presence:sync event - update active presence and users
        socket.on('presence:sync', (data: any) => {
            console.log('Received presence:sync event via WebSocket:', data);
            if (data && presenceCallback) {
                presenceCallback(data);
            }
        });

        return socket;
    } catch (e) {
        console.warn('Error during Socket.IO initialization:', e);
        return null;
    }
};

export const joinProjectRoom = (projectId: string) => {
    currentProjectId = projectId;
    if (socket) {
        console.log(`Emitting room join events for project: ${projectId}`);
        // Support both room:join and room as requested/suggested
        socket.emit("room:join", { projectId });
        socket.emit("room", { projectId });
    } else {
        console.warn('Socket not initialized. Room join queued.');
    }
};

export const sendSocketChatMessage = (projectId: string, message: string) => {
    if (socket) {
        console.log(`Sending message via Socket.IO: "${message}"`);
        // Support both chat:send and chat events
        socket.emit("chat:send", { projectId, message });
        socket.emit("chat", { projectId, message });
    } else {
        console.warn('Socket not active. Message cannot be sent via Socket.IO.');
    }
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('Disconnecting Socket.IO connection.');
        socket.disconnect();
        socket = null;
    }
    currentProjectId = null;
    currentToken = null;
};
