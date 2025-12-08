import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { RoomService } from './room.service';
import { RoomMember, RoomMemberDocument, CapabilitiesRoomMeember } from 'src/schemas/room_member.schema';
import { isEmpty } from 'lodash';
import { JwtWsAuthGuard } from 'src/guards/jwt-ws-auth.guard';
import { WsCurrentUser } from 'src/common/decorators/ws-current-user.decorator';

interface UserInfo {
  id: string;
  full_name: string;
  avatar: string;
  isOnline: boolean;
  socketId: string;
  capabilities?: CapabilitiesRoomMeember;
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
export class WebRTCGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRTCGateway.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RoomMember.name, 'db_chat')
    private readonly roomMemberModel: Model<RoomMember>,
    private readonly roomService: RoomService,
    private readonly jwtService: JwtService,
  ) { }

  async afterInit() {
    this.logger.log('WebRTC Gateway initialized');

    // Xóa tất cả room members khi khởi động (tùy chọn)
    try {
      await this.roomMemberModel.deleteMany({}).exec();
      this.logger.log('Cleaned up all room members on startup');
    } catch (error) {
      this.logger.error('Error cleaning up room members:', error);
    }
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    if (!token) {
      client.emit('unauthorized', 'Token không tồn tại!');
      client.disconnect();
      return;
    }
    try {
      const { sub } = await this.jwtService.verify(token);
      const userId = Types.ObjectId.createFromHexString(sub);
      const user = await this.roomService.findOneById<User>(User.name, userId);
      if (isEmpty(user)) {
        client.emit('unauthorized', 'Token không hợp lệ!');
        client.disconnect();
        return;
      }
      client.data.user = user;
      client.data.userId = user._id.toString();

    } catch (error) {
      this.logger.error('Connection error:', error);
      client.emit('unauthorized', 'Token không hợp lệ!');
      client.disconnect();
    }

    client.on('disconnect', (reason) => {
      this.logger.log(`Client disconnected: ${client.id}, reason: ${reason}`);
      this.handleUserDisconnect(client.id);
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    await this.handleUserDisconnect(client.id);
  }

  private async getUserInfo(userId: string): Promise<{ full_name: string; avatar: string }> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (user) {
        return {
          full_name: user.full_name || '',
          avatar: user.avatar || '',
        };
      }
    } catch (error) {
      this.logger.error(`Error getting user info for ${userId}:`, error);
    }
    return { full_name: '', avatar: '' };
  }

  private async getRoomUsers(roomId: string): Promise<UserInfo[]> {
    // const roomMembers = await this.roomMemberModel
    //   .find({ room_id: roomId })
    //   .lean()
    //   .exec();

    // const userInfos: UserInfo[] = await Promise.all(
    //   roomMembers.map(async (member) => {
    //     const userInfo = await this.getUserInfo(member.user_id.toString());
    //     return {
    //       id: member.user_id.toString(),
    //       full_name: member.full_name || userInfo.full_name,
    //       avatar: userInfo.avatar,
    //       isOnline: true, // Vì đang trong DB nên mặc định là online
    //       socketId: member.socket_id,
    //       capabilities: member.capabilities,
    //     };
    //   })
    // );

    // return userInfos;
    const roomMembers = await this.roomMemberModel
      .find({ room_id: roomId })
      .lean()
      .exec()

    return roomMembers.map(member => ({
      id: member.user_id.toString(),
      full_name: member.full_name,
      avatar: member.avatar || '',
      isOnline: true,
      socketId: member.socket_id,
      capabilities: member.capabilities,
    }));

  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      userId: string;
      userInfo: {
        full_name: string;
        avatar: string;
      }
    },
    @WsCurrentUser() currentUser: UserDocument,
  ) {
    try {
      this.logger.log(`User ${data.userId} joining room ${data.room}`);

      // Validate
      if (!data.room || !data.userId) {
        client.emit('error', { message: 'Room and userId are required' });
        return { success: false, error: 'Invalid request' };
      }

      // Kiểm tra xem user đã ở trong phòng khác chưa
      const existingMember = await this.roomMemberModel.findOne({
        user_id: new Types.ObjectId(data.userId),
      }).exec();

      if (existingMember && existingMember.room_id !== data.room) {
        // Nếu user đang ở phòng khác, xóa khỏi phòng đó
        await this.roomMemberModel.deleteOne({
          _id: existingMember._id,
        }).exec();

        // Thông báo cho phòng cũ (rời phòng cũ)
        this.server.to(existingMember.room_id).emit('user-left', {
          userId: data.userId,
          room: existingMember.room_id,
          timestamp: new Date().toISOString(),
        });
      }

      // Join socket room
      await client.join(data.room);
      client.data.userId = data.userId;
      client.data.room = data.room;

      // Lấy thông tin user
      const finalFullName = data.userInfo?.full_name || currentUser.full_name;
      const finalAvatar = data.userInfo?.avatar || currentUser.avatar;

      // Tạo hoặc cập nhật room member
      const newMb = await this.roomMemberModel.findOneAndUpdate(
        {
          user_id: new Types.ObjectId(data.userId),
          room_id: data.room,
        },
        {
          $set: {
            avatar: finalAvatar,
            full_name: finalFullName,
            socket_id: client.id,
          },
        },
        { upsert: true, new: true }
      );
      console.log('New Room Member:', newMb);
      // Lấy tất cả users trong phòng
      const allUsers = await this.getRoomUsers(data.room);

      // 1. Gửi xác nhận cho người dùng mới
      client.emit('join-confirmation', {
        success: true,
        room: data.room,
        userId: data.userId,
        user: {
          _id: data.userId,
          full_name: finalFullName,
          avatar: finalAvatar,
          isOnline: true,
          socketId: client.id,
        },
      });

      // 2. Gửi người dùng hiện tại đến người dùng mới (có độ trễ)
      setTimeout(() => {
        const otherUsers = allUsers.filter(u => u.id !== data.userId);
        if (otherUsers.length > 0) {
          client.emit('existing-users', {
            room: data.room,
            users: otherUsers,
            timestamp: new Date().toISOString(),
          });
        }
      }, 500);

      // 3. Thông báo cho những người khác về người dùng mới (có sự chậm trễ)
      setTimeout(() => {
        if (allUsers.length > 1) {
          this.server.to(data.room).emit('user-joined', {
            user: {
              _id: data.userId,
              full_name: finalFullName,
              avatar: finalAvatar,
              isOnline: true,
              socketId: client.id,
            },
            room: data.room,
          });
        }
      }, 1000);

      // 4. Phát sóng danh sách người dùng đã cập nhật tới tất cả
      setTimeout(() => {
        this.server.to(data.room).emit('room-users-updated', {
          room: data.room,
          users: allUsers,
          userJoined: {
            _id: data.userId,
            full_name: finalFullName,
            avatar: finalAvatar,
            isOnline: true,
          },
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
  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('offer')
  async handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      offer: any;
    },
  ) {
    try {
      // Tìm receiver trong DB
      const receiver = await this.roomMemberModel.findOne({
        room_id: data.room,
        user_id: new Types.ObjectId(data.to),
      }).exec();

      const sender = await this.roomMemberModel.findOne({
        room_id: data.room,
        socket_id: client.id,
      }).exec();

      if (!sender || !receiver) {
        return { success: false, error: 'User not found' };
      }

      this.logger.log(`Offer from ${sender.user_id} to ${receiver.user_id} in room ${data.room}`);

      this.server.to(receiver.socket_id).emit('offer', {
        from: sender.user_id.toString(),
        to: data.to,
        offer: data.offer,
        senderInfo: {
          full_name: sender.full_name,
          avatar: '', // Có thể lấy từ user collection nếu cần
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


  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      answer: any;
    },
  ) {
    try {
      const receiver = await this.roomMemberModel.findOne({
        room_id: data.room,
        user_id: new Types.ObjectId(data.to),
      }).exec();

      const sender = await this.roomMemberModel.findOne({
        room_id: data.room,
        socket_id: client.id,
      }).exec();

      if (!sender || !receiver) {
        return { success: false, error: 'User not found' };
      }

      this.logger.log(`Answer from ${sender.user_id} to ${receiver.user_id}`);

      this.server.to(receiver.socket_id).emit('answer', {
        from: sender.user_id.toString(),
        to: data.to,
        answer: data.answer,
        senderInfo: {
          full_name: sender.full_name,
          avatar: '',
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

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      to: string;
      candidate: any;
    },
  ) {
    try {
      const receiver = await this.roomMemberModel.findOne({
        room_id: data.room,
        user_id: new Types.ObjectId(data.to),
      }).exec();

      const sender = await this.roomMemberModel.findOne({
        room_id: data.room,
        socket_id: client.id,
      }).exec();

      if (!sender || !receiver) {
        return { success: false, error: 'User not found' };
      }

      this.server.to(receiver.socket_id).emit('ice-candidate', {
        from: sender.user_id.toString(),
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

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('user-ready')
  async handleUserReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      room: string;
      userId: string;
      capabilities: CapabilitiesRoomMeember;
    },
  ) {
    try {
      await this.roomMemberModel.findOneAndUpdate(
        {
          room_id: data.room,
          user_id: new Types.ObjectId(data.userId),
        },
        {
          capabilities: data.capabilities,
        }
      ).exec();

      // Notify others this user is ready
      client.to(data.room).emit('user-ready', {
        userId: data.userId,
        room: data.room,
        capabilities: data.capabilities,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`User ${data.userId} is ready in room ${data.room}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in user-ready: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string; userId: string },
  ) {
    try {
      this.logger.log(`User ${data.userId} leaving room ${data.room}`);

      // Tìm thông tin user trước khi xóa
      const userMember = await this.roomMemberModel.findOne({
        room_id: data.room,
        user_id: new Types.ObjectId(data.userId),
      }).exec();

      if (!userMember) {
        return { success: false, error: 'User not found in room' };
      }

      // Notify others
      client.to(data.room).emit('user-left', {
        userId: data.userId,
        user: {
          id: userMember.user_id.toString(),
          full_name: userMember.full_name,
          avatar: '',
        },
        room: data.room,
        timestamp: new Date().toISOString(),
      });

      // Xóa user khỏi room
      await this.roomMemberModel.deleteOne({
        room_id: data.room,
        user_id: new Types.ObjectId(data.userId),
      }).exec();

      // Lấy danh sách users còn lại
      const remainingMembers = await this.roomMemberModel
        .find({ room_id: data.room })
        .lean()
        .exec();

      const remainingUsers = await Promise.all(
        remainingMembers.map(async (member) => {
          const userInfo = await this.getUserInfo(member.user_id.toString());
          return {
            id: member.user_id.toString(),
            full_name: member.full_name,
            avatar: userInfo.avatar,
            isOnline: true,
          };
        })
      );

      // Gửi danh sách users cập nhật
      this.server.to(data.room).emit('room-users-updated', {
        room: data.room,
        users: remainingUsers,
        action: 'leave',
        userLeft: {
          id: userMember.user_id.toString(),
          full_name: userMember.full_name,
          avatar: '',
        },
        timestamp: new Date().toISOString(),
      });

      // Leave socket room
      await client.leave(data.room);

      // Xóa phòng nếu không còn ai
      if (remainingMembers.length === 0) {
        this.logger.log(`Room ${data.room} is now empty`);
      }

      return { success: true, message: 'Left room successfully' };

    } catch (error) {
      this.logger.error(`Error in leave-room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(JwtWsAuthGuard)
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
    return { success: true };
  }

  private async handleUserDisconnect(socketId: string) {
    try {
      // Tìm user dựa trên socketId
      const userMember = await this.roomMemberModel.findOne({
        socket_id: socketId,
      }).exec();

      if (userMember) {
        this.logger.log(`User ${userMember.user_id} disconnected from room ${userMember.room_id}`);

        // Xóa user khỏi DB khi disconnect
        await this.roomMemberModel.deleteOne({
          socket_id: socketId,
        }).exec();

        // Notify others trong phòng
        const roomMembers = await this.roomMemberModel
          .find({ room_id: userMember.room_id })
          .exec();

        // Gửi thông báo cho các user còn lại
        roomMembers.forEach(member => {
          if (member.socket_id !== socketId) {
            this.server.to(member.socket_id).emit('user-disconnected', {
              userId: userMember.user_id.toString(),
              room: userMember.room_id,
              timestamp: new Date().toISOString(),
            });
          }
        });

        // Gửi danh sách users cập nhật
        const remainingUsers = await Promise.all(
          roomMembers
            .filter(m => m.socket_id !== socketId)
            .map(async (member) => {
              const userInfo = await this.getUserInfo(member.user_id.toString());
              return {
                id: member.user_id.toString(),
                full_name: member.full_name,
                avatar: userInfo.avatar,
                isOnline: true,
              };
            })
        );

        this.server.to(userMember.room_id).emit('room-users-updated', {
          room: userMember.room_id,
          users: remainingUsers,
          action: 'disconnect',
          userLeft: {
            id: userMember.user_id.toString(),
            full_name: userMember.full_name,
            avatar: '',
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error in handleUserDisconnect: ${error.message}`);
    }
  }
}
