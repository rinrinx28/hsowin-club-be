export class CreateClientDto {}

export class StatusBoss {
  uuid: string;
  content: string;
  server: string;
  type?: number;
  respam?: number;
}

export class StatusBot {
  uuid: string;
  id: string;
  name: string;
  map: string;
  zone: number;
  gold: number;
  server: string;
}

export class Transaction {
  uuid: string;
  type: number;
  bot_id: string;
  player_id: string;
  player_name: string;
  gold_last?: number;
  gold_current?: number;
  gold_trade?: number;
  gold_receive?: number;
  service_id?: string;
  server: string;
}

export class StatusServerWithBoss {
  uuid: string;
  content: string;
  server: string;
  respam?: number;
}
