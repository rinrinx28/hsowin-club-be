import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MissionDailyDocument = MissionDaily & Document;

@Schema({
  timestamps: true,
})
export class MissionDaily {
  @Prop({ unique: true })
  uid: string;

  @Prop({ default: '[]' })
  data: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MissionDailySchema = SchemaFactory.createForClass(MissionDaily);
