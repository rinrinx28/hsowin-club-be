import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BankDocument = Bank & Document;

@Schema({
  timestamps: true,
})
export class Bank {
  @Prop()
  uid: string;

  @Prop()
  amount: number;

  @Prop({ default: 0 })
  revice: number;

  @Prop()
  status: string;

  @Prop()
  orderId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BankSchema = SchemaFactory.createForClass(Bank);
