import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserIpDocument = UserIp & Document;

@Schema({
  timestamps: true,
})
export class UserIp {
  @Prop()
  ip_address: string;

  @Prop()
  countAccount: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserIpSchema = SchemaFactory.createForClass(UserIp);
