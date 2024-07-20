import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ClansDocument = Clans & Document;

@Schema({
  timestamps: true,
})
export class Clans {
  @Prop()
  ownerId: string;

  @Prop()
  clanname: string;

  @Prop({ default: 0 })
  totalBet: number;

  @Prop({ default: 1 })
  member: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ClansSchema = SchemaFactory.createForClass(Clans);
