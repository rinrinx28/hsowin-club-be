import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MessegesBanDocument = MessegesBan & Document;

@Schema({
  timestamps: true,
})
export class MessegesBan {
  @Prop()
  uid: string;
  @Prop()
  isBan: boolean;

  @Prop({ default: '' })
  isReason: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const MessegesBanSchema = SchemaFactory.createForClass(MessegesBan);
