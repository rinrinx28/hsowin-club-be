import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserVipDocument = UserVip & Document;

@Schema({
  timestamps: true,
})
export class UserVip {
  @Prop({ unique: true })
  uid: string;

  @Prop({ default: '[]' })
  data: string;

  @Prop()
  timeEnd: Date;

  @Prop({ default: false })
  isEnd: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserVipSchema = SchemaFactory.createForClass(UserVip);
