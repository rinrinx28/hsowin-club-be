import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TopBankDocument = TopBank & Document;

@Schema({
  timestamps: true,
})
export class TopBank {
  @Prop()
  uid: string;

  @Prop()
  username: string;

  @Prop()
  amount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TopBankSchema = SchemaFactory.createForClass(TopBank);
