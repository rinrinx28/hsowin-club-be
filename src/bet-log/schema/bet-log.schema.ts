import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BetLogDocument = BetLog & Document;

@Schema({
  timestamps: true,
})
export class BetLog {
  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  sendIn: number;

  @Prop({ default: 0 })
  sendOut: number;

  @Prop({ default: '' })
  result: string;

  @Prop({ default: false })
  isEnd: boolean;

  @Prop()
  server: string;

  @Prop()
  timeEnd: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BetLogSchema = SchemaFactory.createForClass(BetLog);
