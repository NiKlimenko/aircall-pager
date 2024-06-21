export abstract class Notification {}

export class EmailNotification extends Notification {
  recipientEmails: string[];

  constructor(private recipientEmails: string[]) {
    super();
  }
}

export class SMSNotification extends Notification {
  recipientsPhones: string[];

  constructor(private recipientsPhones: string[]) {
    super();
  }
}
