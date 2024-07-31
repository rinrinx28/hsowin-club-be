import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MessegesDocument = Messeges & Document;

@Schema({
  timestamps: true,
})
export class Messeges {
  @Prop()
  uid: string;

  @Prop()
  content: string;

  @Prop()
  username?: string;

  @Prop()
  server: string;

  @Prop({ default: '{}' })
  meta: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessegesSchema = SchemaFactory.createForClass(Messeges);
