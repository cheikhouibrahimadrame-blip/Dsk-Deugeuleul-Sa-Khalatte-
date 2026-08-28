import { Server } from 'socket.io';
import { verifyToken } from './auth';
import { prisma } from './membership';

interface SocketData {
  userId: string;
  email: string;
}

// Track online users
const onlineUsers = new Map<string, string[]>(); // userId -> socketIds

export const io = new Server({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

// Auth middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = await verifyToken(token);
    (socket.data as SocketData).userId = payload.userId;
    (socket.data as SocketData).email = payload.email;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const { userId, email } = socket.data as SocketData;
  console.log(`User connected: ${email} (${userId})`);

  // Add to online users
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, []);
  }
  onlineUsers.get(userId)!.push(socket.id);

  // Update user online status
  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true, lastSeenAt: new Date() },
  });

  // Broadcast user online status
  socket.broadcast.emit('user:online', { userId, isOnline: true });

  // ============================================
  // CHAT ROOM MANAGEMENT
  // ============================================

  // Join a chat room
  socket.on('chat:join', async ({ chatRoomId }) => {
    try {
      // Verify user is a member
      const member = await prisma.chatMember.findUnique({
        where: { chatRoomId_userId: { chatRoomId, userId } },
      });

      if (!member) {
        socket.emit('error', { message: 'Not a member of this chat' });
        return;
      }

      socket.join(`chat:${chatRoomId}`);
      console.log(`User ${userId} joined chat ${chatRoomId}`);

      // Update last read
      await prisma.chatMember.update({
        where: { id: member.id },
        data: { lastReadAt: new Date() },
      });

      // Notify others
      socket.to(`chat:${chatRoomId}`).emit('chat:user_joined', { chatRoomId, userId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Leave a chat room
  socket.on('chat:leave', ({ chatRoomId }) => {
    socket.leave(`chat:${chatRoomId}`);
    socket.to(`chat:${chatRoomId}`).emit('chat:user_left', { chatRoomId, userId });
  });

  // ============================================
  // MESSAGING
  // ============================================

  // Send a message
  socket.on('message:send', async ({ chatRoomId, content, type = 'text', metadata }) => {
    try {
      // Verify membership
      const member = await prisma.chatMember.findUnique({
        where: { chatRoomId_userId: { chatRoomId, userId } },
      });

      if (!member) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          chatRoomId,
          senderId: userId,
          content,
          type,
          metadata,
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Broadcast to room
      io.to(`chat:${chatRoomId}`).emit('message:new', message);

      // Create notifications for other members
      const members = await prisma.chatMember.findMany({
        where: { chatRoomId },
        include: { user: true },
      });

      const notifications = members
        .filter((m) => m.userId !== userId)
        .map((m) => ({
          userId: m.userId,
          type: 'message' as const,
          title: 'New message',
          body: `${(socket.data as SocketData).email}: ${content.substring(0, 100)}`,
          data: { chatRoomId, messageId: message.id },
        }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });

        // Send real-time notification to online users
        notifications.forEach((notif) => {
          const userSockets = onlineUsers.get(notif.userId) || [];
          userSockets.forEach((sid) => {
            io.to(sid).emit('notification:new', notif);
          });
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Mark messages as read
  socket.on('message:read', async ({ chatRoomId, messageId }) => {
    try {
      await prisma.chatMember.updateMany({
        where: { chatRoomId, userId },
        data: { lastReadAt: new Date() },
      });

      socket.to(`chat:${chatRoomId}`).emit('message:read', { chatRoomId, userId, messageId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to mark as read' });
    }
  });

  // ============================================
  // TYPING INDICATORS
  // ============================================

  socket.on('typing:start', ({ chatRoomId }) => {
    socket.to(`chat:${chatRoomId}`).emit('typing:user', { chatRoomId, userId, isTyping: true });
  });

  socket.on('typing:stop', ({ chatRoomId }) => {
    socket.to(`chat:${chatRoomId}`).emit('typing:user', { chatRoomId, userId, isTyping: false });
  });

  // ============================================
  // PRESENCE & STATUS
  // ============================================

  // Get online status of users
  socket.on('presence:get', ({ userIds }: { userIds: string[] }) => {
    const status = userIds.map((id) => ({
      userId: id,
      isOnline: onlineUsers.has(id) && onlineUsers.get(id)!.length > 0,
    }));
    socket.emit('presence:status', status);
  });

  // Update user last seen on disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${email} (${userId})`);

    // Remove from online users
    const userSockets = onlineUsers.get(userId) || [];
    const newSockets = userSockets.filter((id) => id !== socket.id);

    if (newSockets.length === 0) {
      onlineUsers.delete(userId);

      // Update user status
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeenAt: new Date() },
      });

      socket.broadcast.emit('user:online', { userId, isOnline: false });
    } else {
      onlineUsers.set(userId, newSockets);
    }
  });

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // Mark notification as read
  socket.on('notification:read', async ({ notificationId }) => {
    try {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { read: true, readAt: new Date() },
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });

  // Get unread notification count
  socket.on('notification:count', async () => {
    try {
      const count = await prisma.notification.count({
        where: { userId, read: false },
      });
      socket.emit('notification:count', { count });
    } catch (error) {
      socket.emit('error', { message: 'Failed to get notification count' });
    }
  });

  console.log(`Socket ${socket.id} fully initialized for user ${userId}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down realtime server...');
  await prisma.$disconnect();
  process.exit(0);
});
