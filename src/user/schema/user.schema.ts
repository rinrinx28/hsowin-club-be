import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
})
export class User {
  @Prop()
  uid: string;

  @Prop({ unique: true })
  username: string;

  @Prop()
  pwd_h: string;

  @Prop()
  email: string;

  @Prop({ unique: true })
  name: string;

  @Prop({ default: 0 })
  gold: number;

  @Prop({ default: 0 })
  diamon: number;

  @Prop({ default: '{}' })
  clan: string;

  @Prop({ default: 0 })
  totalBet: number;

  @Prop({ default: 0 })
  limitedTrade: number;

  @Prop({ default: false })
  isBan: boolean;

  @Prop({ default: '' })
  isReason: string;

  @Prop()
  server: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
