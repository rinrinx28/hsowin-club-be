import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BotActiveDocument = BotActive & Document;

@Schema({
  timestamps: true,
})
export class BotActive {
  @Prop()
  uid: string;

  @Prop()
  currentGold: number;

  @Prop()
  newGold: number;

  @Prop()
  name: string;

  @Prop()
  playerId: string;

  @Prop()
  playerName: string;

  @Prop()
  botId: string;

  @Prop()
  type: string;

  @Prop()
  serviceId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BotActiveSchema = SchemaFactory.createForClass(BotActive);
