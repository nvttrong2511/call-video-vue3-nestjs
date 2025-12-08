import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ObjectIdTransform } from '../common/transforms/objectid.transform';

export type RoomMemberDocument = HydratedDocument<RoomMember>;

export interface CapabilitiesRoomMeemberInterface {
  video?: boolean;
  audio?: boolean;
  bandwidth?: string;
}
export class CapabilitiesRoomMeember implements CapabilitiesRoomMeemberInterface {
  @ApiPropertyOptional({ type: Boolean, description: 'Có bật video không' })
  @IsOptional()
  video?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Có bật audio không' })
  @IsOptional()
  audio?: boolean;

  @ApiPropertyOptional({ type: String, description: 'Băng thông' })
  @IsOptional()
  bandwidth?: string;
}


@Schema({
  collection: 'room_members',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  strict: 'throw',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class RoomMember {
  @ApiProperty({ type: String, description: 'Id người tham gia' })
  @Prop({ type: Types.ObjectId, required: true })
  @IsNotEmpty()
  @Transform(ObjectIdTransform)
  user_id: Types.ObjectId;

  @ApiProperty({ type: String, description: 'Họ và tên người tham gia' })
  @Prop({ type: String, required: true })
  @IsNotEmpty()
  full_name: string;

  @ApiPropertyOptional({ type: String, description: 'Ảnh đại diện người tham gia' })
  @Prop({ type: String, required: false })
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Có phải chủ phòng không',
  })
  @Prop({ type: Boolean, required: false })
  @IsOptional()
  is_host?: boolean;
  
  @ApiProperty({ type: String, description: 'Socket ID của người tham gia' })
  @Prop({ type: String, required: true })
  @IsNotEmpty()
  socket_id: string;


  @ApiProperty({ type: String, description: 'Mã phòng' })
  @Prop({ type: String, required: true })
  @IsNotEmpty()
  room_id: string;

  @ApiPropertyOptional({ type: CapabilitiesRoomMeember, description: 'Khả năng của người tham gia' })
  @Prop({ type: CapabilitiesRoomMeember, required: false })
  @IsOptional()
  capabilities?: CapabilitiesRoomMeember;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
RoomMemberSchema.index({
  room_id: 1,
  user_id: 1,
});
