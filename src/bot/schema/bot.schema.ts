import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BotDocument = Bot & Document;

@Schema({
  timestamps: true,
})
export class Bot {
  @Prop({ unique: true })
  name: string;

  @Prop()
  map: string;

  @Prop()
  zone: string;

  @Prop()
  gold: string;

  @Prop()
  server: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BotSchema = SchemaFactory.createForClass(Bot);
