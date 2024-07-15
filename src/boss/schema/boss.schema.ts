import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BossDocument = Boss & Document;

@Schema({
  timestamps: true,
})
export class Boss {
  @Prop()
  type: string;

  @Prop()
  server: string;

  @Prop({ default: 0 })
  respam: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BossSchema = SchemaFactory.createForClass(Boss);
