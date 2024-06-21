import { EmailNotification, Notification, SMSNotification } from "../dto/notification.dto";

export class NotificationService {
  /**
   * Send command to send a new notification
   * @param notification
   */
  async sendNotification(notification: Notification) {
    if (notification instanceof EmailNotification) {
      //Invoke command to send emails
    } else if (notification instanceof SMSNotification) {
      //Invoke command to send SMS
    }
  }
}
