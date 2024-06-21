import { BaseDto } from "./base.dto";

export class ServiceAlert extends BaseDto {
  serviceId: string;
  message: string;
}
