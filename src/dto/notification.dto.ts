export abstract class Notification {
  protected constructor(private message: string) {}
}

export class EmailNotification extends Notification {
  recipientEmails: string[];

  constructor(private recipientEmails: string[], message: string) {
    super(message);
  }
}

export class SMSNotification extends Notification {
  recipientsPhones: string[];

  constructor(private recipientsPhones: string[], message: string) {
    super(message);
  }
}
