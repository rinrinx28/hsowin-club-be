import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({
  timestamps: true,
})
export class Session {
  @Prop()
  uid: string;

  @Prop()
  type: string;

  @Prop()
  playerName: string;

  @Prop()
  amount: number;

  @Prop({ default: 0 })
  recive: number;

  @Prop({ default: '' })
  timeBoss: string;

  @Prop({ default: '0' })
  status: string;

  @Prop()
  server: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
