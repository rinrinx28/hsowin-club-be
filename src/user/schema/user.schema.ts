import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
})
export class User {
  @Prop()
  uid: string;

  @Prop()
  username: string;

  @Prop()
  pwd_h: string;

  @Prop()
  email: string;

  @Prop()
  name: string;

  @Prop({ default: 0 })
  gold: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
