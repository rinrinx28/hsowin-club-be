import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PenningClansDocument = PenningClans & Document;

@Schema({
  timestamps: true,
})
export class PenningClans {
  @Prop()
  clanId: string;
  @Prop()
  userId: string;
  @Prop({ default: false })
  isAcpect: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PenningClansSchema = SchemaFactory.createForClass(PenningClans);
