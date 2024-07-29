import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EventRandomDocument = EventRandom & Document;

@Schema({
  timestamps: true,
})
export class EventRandom {
  @Prop()
  value: string;

  @Prop()
  timeBoss: string;

  @Prop()
  betId: string;

  @Prop()
  isEnd: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EventRandomSchema = SchemaFactory.createForClass(EventRandom);
