import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserPrizeDocument = UserPrize & Document;

@Schema({
  timestamps: true,
})
export class UserPrize {
  @Prop()
  uid: string;

  @Prop()
  username: string;

  @Prop()
  type: string;

  @Prop()
  rank: string;

  @Prop()
  amount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserPrizeSchema = SchemaFactory.createForClass(UserPrize);
