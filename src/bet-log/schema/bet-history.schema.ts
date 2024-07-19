import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BetHistoryDocument = BetHistory & Document;

@Schema({
  timestamps: true,
})
export class BetHistory {
  @Prop({ default: 0 })
  sendIn: number;

  @Prop({ default: 0 })
  sendOut: number;

  @Prop()
  server: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BetHistorySchema = SchemaFactory.createForClass(BetHistory);
