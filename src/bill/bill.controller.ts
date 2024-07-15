import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BillService } from './bill.service';

@Controller('bill')
export class BillController {
  constructor(private readonly billService: BillService) {}
}
