# 🚀 Chat & Notifications Implementation Guide

## ✅ What's Done

### Step 1: Database Schema ✅
- **File**: `packages/db/prisma/schema.prisma`
- **Commit**: [`47cd1f3`](https://github.com/cheikhouibrahimadrame-blip/Dsk-Deugeuleul-Sa-Khalatte-/commit/47cd1f35b6d6610c7c8eb6af5488b5c1d0618c28)
- **Added Models**:
  - `ChatRoom` - Direct, group, and goal-based chats
  - `ChatMember` - Track members + read status
  - `Message` - All chat messages with metadata
  - `Notification` - In-app notifications
  - `Reaction` - Emoji reactions on messages
  - `User` - Added `isOnline` and `lastSeenAt`

### Step 2: Realtime Server ✅
- **File**: `apps/realtime/src/index.ts`
- **Commit**: [`61db249`](https://github.com/cheikhouibrahimadrame-blip/Dsk-Deugeuleul-Sa-Khalatte-/commit/61db249d79227f4d56632b9570cdff1d2e53e6b6)
- **Features**:
  - Socket.io with JWT auth middleware
  - Chat room join/leave
  - Message send + broadcast + persist
  - Typing indicators
  - Online presence tracking
  - Real-time notifications
  - Read receipts

---

## 🔧 Next Steps (Do These Locally)

### Step 2: Run Prisma Migration

```bash
cd packages/db
pnpm prisma migrate dev --name add_chat_and_notifications
pnpm prisma generate
```

This will:
1. Create SQL migration for new tables
2. Apply to your dev database
3. Regenerate Prisma client

---

### Step 3: Install Socket.io Client in Web App

```bash
cd apps/web
pnpm add socket.io-client
```

---

### Step 4: Create Chat Hook

Create `apps/web/src/lib/chat.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initChat(token: string) {
  if (socket) return socket;

  socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001', {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('✅ Connected to realtime server');
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Realtime connection error:', error);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectChat() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

---

### Step 5: Create React Hook for Chat

Create `apps/web/src/features/chat/useChat.ts`:

```typescript
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/chat';

export interface Message {
  id: string;
  content: string;
  type: string;
  senderId: string | null;
  sender?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export function useChat(chatRoomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join room
    socket.emit('chat:join', { chatRoomId });
    setIsConnected(true);

    // Listen for messages
    socket.on('message:new', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for typing
    socket.on('typing:user', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    return () => {
      socket.emit('chat:leave', { chatRoomId });
      socket.off('message:new');
      socket.off('typing:user');
      setIsConnected(false);
    };
  }, [chatRoomId]);

  const sendMessage = (content: string) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message:send', { chatRoomId, content });
    }
  };

  const startTyping = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('typing:start', { chatRoomId });
    }
  };

  const stopTyping = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('typing:stop', { chatRoomId });
    }
  };

  return {
    messages,
    isConnected,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
  };
}
```

---

### Step 6: Create Chat UI Component

Create `apps/web/src/features/chat/ChatWindow.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from './useChat';

interface ChatWindowProps {
  chatRoomId: string;
  currentUserId: string;
}

export function ChatWindow({ chatRoomId, currentUserId }: ChatWindowProps) {
  const { messages, isConnected, typingUsers, sendMessage, startTyping, stopTyping } = useChat(chatRoomId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
    stopTyping();
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold">Chat</h3>
        <p className="text-sm text-gray-500">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.senderId === currentUserId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {typingUsers.size > 0 && (
          <p className="text-sm text-gray-500 italic">Someone is typing...</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.length > 0) startTyping();
              else stopTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

### Step 7: Initialize Chat in App

In your main layout or page (`apps/web/src/app/layout.tsx` or a chat page):

```typescript
'use client';

import { useEffect } from 'react';
import { initChat } from '@/lib/chat';
import { useSession } from 'next-auth/react'; // or your auth

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.accessToken) {
      initChat(session.accessToken);
    }
  }, [session]);

  return <>{children}</>;
}
```

---

### Step 8: Start the Realtime Server

Make sure your realtime server is running:

```bash
cd apps/realtime
pnpm dev
```

Set environment variables in `apps/realtime/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/yourdb"
CORS_ORIGIN="http://localhost:3000"
JWT_SECRET="your-secret-key"
```

---

## 🎉 Usage Example

Now you can use the chat in any page:

```typescript
import { ChatWindow } from '@/features/chat/ChatWindow';

export default function ChatPage() {
  return (
    <div className="h-screen p-4">
      <ChatWindow chatRoomId="some-room-id" currentUserId="current-user-id" />
    </div>
  );
}
```

---

## 📝 API Reference

### Socket Events (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ chatRoomId }` | Join a chat room |
| `chat:leave` | `{ chatRoomId }` | Leave a chat room |
| `message:send` | `{ chatRoomId, content, type?, metadata? }` | Send a message |
| `message:read` | `{ chatRoomId, messageId }` | Mark message as read |
| `typing:start` | `{ chatRoomId }` | Start typing indicator |
| `typing:stop` | `{ chatRoomId }` | Stop typing indicator |
| `presence:get` | `{ userIds: string[] }` | Get online status |
| `notification:read` | `{ notificationId }` | Mark notification read |
| `notification:count` | `{}` | Get unread count |

### Socket Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `Message` | New message received |
| `message:read` | `{ chatRoomId, userId, messageId }` | Message marked read |
| `typing:user` | `{ chatRoomId, userId, isTyping }` | User typing status |
| `user:online` | `{ userId, isOnline }` | User online status changed |
| `notification:new` | `Notification` | New notification |
| `notification:count` | `{ count }` | Unread notification count |
| `presence:status` | `Array<{ userId, isOnline }>` | Online status list |
| `chat:user_joined` | `{ chatRoomId, userId }` | User joined chat |
| `chat:user_left` | `{ chatRoomId, userId }` | User left chat |
| `error` | `{ message }` | Error occurred |

---

## 🔐 Security Notes

1. **JWT Tokens**: All socket connections require valid JWT tokens
2. **Membership Validation**: Server verifies user is a chat member before allowing actions
3. **CORS**: Configure `CORS_ORIGIN` to restrict which domains can connect
4. **Rate Limiting**: Consider adding rate limiting for production

---

## 🚀 Next Features to Add

1. **File uploads** - Images, documents in messages
2. **Message reactions** - Emoji reactions
3. **Search** - Search messages
4. **Push notifications** - Browser push API
5. **Chat rooms list** - Sidebar with all chats
6. **Unread badges** - Show unread count per chat
7. **User presence** - Show online/offline status in UI

---

## 📞 Support

If you run into issues:
1. Check browser console for socket errors
2. Verify realtime server logs
3. Ensure database migration ran successfully
4. Check CORS and JWT configuration

Good luck! 🎉
