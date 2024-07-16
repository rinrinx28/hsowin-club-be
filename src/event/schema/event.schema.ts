import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EventConfigDocument = EventConfig & Document;

@Schema({
  timestamps: true,
})
export class EventConfig {
  @Prop({ default: 1.9 })
  percentBet: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EventConfigSchema = SchemaFactory.createForClass(EventConfig);
