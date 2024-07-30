import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AuthTokenDocument = AuthToken & Document;

@Schema({
  timestamps: true,
})
export class AuthToken {
  @Prop()
  token: string;

  @Prop()
  isEnd: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);
