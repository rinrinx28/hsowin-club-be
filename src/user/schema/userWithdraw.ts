import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserWithDrawDocument = UserWithDraw & Document;

@Schema({
  timestamps: true,
})
export class UserWithDraw {
  @Prop()
  uid: string;

  @Prop()
  type: string;

  @Prop()
  amount: number;

  @Prop()
  accountName: string;

  @Prop()
  accountNumber: string;

  @Prop()
  bankName?: string;

  @Prop()
  gold: number;

  @Prop({ default: '0' })
  status: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserWithDrawSchema = SchemaFactory.createForClass(UserWithDraw);
