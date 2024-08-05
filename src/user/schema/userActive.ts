import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserActiveDocument = UserActive & Document;

@Schema({
  timestamps: true,
})
export class UserActive {
  @Prop()
  uid: string;

  @Prop()
  currentGold: number;

  @Prop()
  newGold: number;

  @Prop()
  active: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserActiveSchema = SchemaFactory.createForClass(UserActive);
