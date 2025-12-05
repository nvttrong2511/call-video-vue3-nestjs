import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  joinedAt: Date;
  socketId: string;
  streamId?: string;
  lastActive?: Date;
  capabilities?: {
    video?: boolean;
    audio?: boolean;
    bandwidth?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  namespace: '/calls',
  pingInterval: 10000,
  pingTimeout: 15000,
  allowEIO3: true,
})
export class WebRTCGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRTCGateway.name);
  private rooms = new Map<string, Map<string, UserInfo>>();
  private userRoomMap = new Map<string, string>();

  afterInit() {
    this.logger.log('WebRTC Gateway initialized');
    
    // Cleanup interval
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 30000);
  }

  private cleanupInactiveUsers() {
    const now = Date.now();
    this.rooms.forEach((roomUsers, roomName) => {
      roomUsers.forEach((user, userId) => {
        if (user.lastActive && (now - user.lastActive.getTime()) > 60000) {
          this.logger.log(`Cleaning up inactive user: ${userId} in room ${roomName}`);
          this.handleUserDisconnect(user.socketId);
        }
      });
    });
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      userId: string;
      userInfo?: {
        name?: string;
        avatar?: string;
      }
    },
  ) {
    try {
      this.logger.log(`User ${data.userId} joining room ${data.room}`);

      // Validate
      if (!data.room || !data.userId) {
        client.emit('error', { message: 'Room and userId are required' });
        return { success: false, error: 'Invalid request' };
      }

      // Leave previous room
      const previousRoom = this.userRoomMap.get(data.userId);
      if (previousRoom && previousRoom !== data.room) {
        await this.handleLeaveRoom(client, { room: previousRoom, userId: data.userId });
      }

      // Join socket room
      await client.join(data.room);
      client.data.userId = data.userId;
      client.data.room = data.room;
      client.data.joinedAt = new Date();

      // Create user info
      const userInfo: UserInfo = {
        id: data.userId,
        name: data.userInfo?.name || `User_${data.userId.slice(-4)}`,
        avatar: data.userInfo?.avatar || '👤',
        isOnline: true,
        joinedAt: new Date(),
        socketId: client.id,
        lastActive: new Date(),
        streamId: `stream_${Date.now()}_${data.userId}`,
      };

      // Initialize room
      if (!this.rooms.has(data.room)) {
        this.rooms.set(data.room, new Map());
      }

      const roomUsers = this.rooms.get(data.room)!;
      
      // Update or add user
      const existingUser = roomUsers.get(data.userId);
      if (existingUser) {
        existingUser.socketId = client.id;
        existingUser.isOnline = true;
        existingUser.lastActive = new Date();
        if (data.userInfo?.name) existingUser.name = data.userInfo.name;
        if (data.userInfo?.avatar) existingUser.avatar = data.userInfo.avatar;
      } else {
        roomUsers.set(data.userId, userInfo);
        this.userRoomMap.set(data.userId, data.room);
      }

      // Get all users
      const allUsers = Array.from(roomUsers.values());
      this.logger.log(`Room ${data.room} now has ${allUsers.length} users`);

      // 1. Send confirmation to the new user
      client.emit('join-confirmation', {
        success: true,
        room: data.room,
        userId: data.userId,
        user: userInfo,
      });

      // 2. Send existing users to the new user (with delay)
      setTimeout(() => {
        const otherUsers = allUsers.filter(u => u.id !== data.userId);
        if (otherUsers.length > 0) {
          client.emit('existing-users', {
            room: data.room,
            users: otherUsers.map(u => ({
              id: u.id,
              name: u.name,
              avatar: u.avatar,
              isOnline: u.isOnline,
              joinedAt: u.joinedAt,
              socketId: u.socketId,
            })),
            timestamp: new Date().toISOString(),
          });
        }
      }, 500);

      // 3. Notify others about the new user (with delay)
      setTimeout(() => {
        const userToNotify = roomUsers.get(data.userId);
        if (userToNotify && allUsers.length > 1) {
          // Notify each existing user individually
          allUsers.forEach(otherUser => {
            if (otherUser.id !== data.userId && otherUser.socketId) {
              this.server.to(otherUser.socketId).emit('user-joined', {
                user: {
                  id: userToNotify.id,
                  name: userToNotify.name,
                  avatar: userToNotify.avatar,
                  isOnline: true,
                  socketId: userToNotify.socketId,
                },
                room: data.room,
                timestamp: new Date().toISOString(),
              });
            }
          });
        }
      }, 1000);

      // 4. Broadcast updated user list to all
      setTimeout(() => {
        this.server.to(data.room).emit('room-users-updated', {
          room: data.room,
          users: allUsers.map(u => ({
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            isOnline: u.isOnline,
            joinedAt: u.joinedAt,
          })),
          action: 'join',
          userJoined: userInfo,
          timestamp: new Date().toISOString(),
        });
      }, 1500);

      return { 
        success: true, 
        message: `Joined room ${data.room} successfully`,
        totalUsers: allUsers.length 
      };

    } catch (error) {
      this.logger.error(`Error in join-room: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to join room' });
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      offer: any;
    },
  ) {
    try {
      const roomUsers = this.rooms.get(data.room);
      if (!roomUsers) {
        return { success: false, error: 'Room not found' };
      }

      const sender = roomUsers.get(client.data.userId);
      const receiver = roomUsers.get(data.to);

      if (!sender || !receiver || !receiver.isOnline) {
        return { success: false, error: 'User not found or offline' };
      }

      this.logger.log(`Offer from ${sender.id} to ${receiver.id} in room ${data.room}`);

      this.server.to(receiver.socketId).emit('offer', {
        from: sender.id,
        to: data.to,
        offer: data.offer,
        senderInfo: {
          name: sender.name,
          avatar: sender.avatar,
        },
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error in offer: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      answer: any;
    },
  ) {
    try {
      const roomUsers = this.rooms.get(data.room);
      if (!roomUsers) {
        return { success: false, error: 'Room not found' };
      }

      const sender = roomUsers.get(client.data.userId);
      const receiver = roomUsers.get(data.to);

      if (!sender || !receiver || !receiver.isOnline) {
        return { success: false, error: 'User not found or offline' };
      }

      this.logger.log(`Answer from ${sender.id} to ${receiver.id}`);

      this.server.to(receiver.socketId).emit('answer', {
        from: sender.id,
        to: data.to,
        answer: data.answer,
        senderInfo: {
          name: sender.name,
          avatar: sender.avatar,
        },
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error in answer: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      candidate: any;
    },
  ) {
    try {
      const roomUsers = this.rooms.get(data.room);
      if (!roomUsers) {
        return { success: false, error: 'Room not found' };
      }

      const sender = roomUsers.get(client.data.userId);
      const receiver = roomUsers.get(data.to);

      if (!sender || !receiver || !receiver.isOnline) {
        return { success: false, error: 'User not found or offline' };
      }

      this.server.to(receiver.socketId).emit('ice-candidate', {
        from: sender.id,
        to: data.to,
        candidate: data.candidate,
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error in ice-candidate: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('user-ready')
  handleUserReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      userId: string;
      capabilities: any;
    },
  ) {
    const roomUsers = this.rooms.get(data.room);
    if (roomUsers) {
      const user = roomUsers.get(data.userId);
      if (user) {
        user.lastActive = new Date();
        user.capabilities = data.capabilities;
        
        // Notify others this user is ready
        client.to(data.room).emit('user-ready', {
          userId: data.userId,
          room: data.room,
          capabilities: data.capabilities,
          timestamp: new Date().toISOString(),
        });
        
        this.logger.log(`User ${data.userId} is ready in room ${data.room}`);
      }
    }
    return { success: true };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId: string },
  ) {
    try {
      this.logger.log(`User ${data.userId} leaving room ${data.room}`);

      const roomUsers = this.rooms.get(data.room);
      if (!roomUsers) {
        return { success: false, error: 'Room not found' };
      }

      const userInfo = roomUsers.get(data.userId);
      if (userInfo) {
        // Notify others
        client.to(data.room).emit('user-left', {
          userId: data.userId,
          user: userInfo,
          room: data.room,
          timestamp: new Date().toISOString(),
        });

        // Remove user
        roomUsers.delete(data.userId);
        this.userRoomMap.delete(data.userId);

        // Send updated user list
        const remainingUsers = Array.from(roomUsers.values());
        this.server.to(data.room).emit('room-users-updated', {
          room: data.room,
          users: remainingUsers,
          action: 'leave',
          userLeft: userInfo,
          timestamp: new Date().toISOString(),
        });

        // Cleanup empty room
        if (roomUsers.size === 0) {
          this.rooms.delete(data.room);
        }
      }

      await client.leave(data.room);
      return { success: true, message: 'Left room successfully' };

    } catch (error) {
      this.logger.error(`Error in leave-room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
    return { success: true };
  }

  private handleUserDisconnect(socketId: string) {
    const roomName = Array.from(this.rooms.entries()).find(([_, users]) => 
      Array.from(users.values()).some(user => user.socketId === socketId)
    )?.[0];

    if (roomName) {
      const roomUsers = this.rooms.get(roomName);
      if (roomUsers) {
        const user = Array.from(roomUsers.values()).find(u => u.socketId === socketId);
        if (user) {
          this.logger.log(`User ${user.id} disconnected from room ${roomName}`);
          
          // Mark as offline but keep in room for reconnection
          user.isOnline = false;
          user.lastActive = new Date();
          
          // Notify others
          this.server.to(roomName).emit('user-disconnected', {
            userId: user.id,
            room: roomName,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    client.on('disconnect', (reason) => {
      this.logger.log(`Client disconnected: ${client.id}, reason: ${reason}`);
      this.handleUserDisconnect(client.id);
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.handleUserDisconnect(client.id);
  }
}
