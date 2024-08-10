export class CreateBetLogDto {
  server: string;
  timeEnd: Date;
  timeBoss?: string;
  resultUser?: string;
}

export class CreateBetHistory {
  server: string;
}

export class TopBetServer {
  server: string;
  limited: number;
}
