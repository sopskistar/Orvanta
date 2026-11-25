export type BookingType = 'callback' | 'cleaning_visit';
export type BookingState = 'creating' | 'confirmed' | 'unavailable' | 'declined' | 'failed' | 'review' | 'offered' | 'not_requested';
export interface BookingSummary {
  type: BookingType; status: BookingState; timeZone: string | null;
  start: string | null; end: string | null; providerBookingId: string | null;
}
export interface BookingConfig {
  calendarId: string; timeZone: string; callbackMinutes: number; cleaningMinutes: number;
  serviceAccount: { client_email: string; private_key: string };
}
export interface BookingOffer {
  id: string; call_id: string; agent_id: string; workspace_id: string; booking_type: BookingType;
  calendar_id: string; time_zone: string; starts_at: string; ends_at: string; expires_at: string;
  status?: 'offered' | 'declined' | 'unavailable' | 'failed';
}
export interface BookingRecord extends Omit<BookingOffer,'status'> {
  booking_id: string; status: BookingState; provider_event_id: string | null;
  customer_name: string; callback_number: string;
}
export interface CalendarProvider {
  verifyCalendar(): Promise<void>;
  busy(start: string, end: string): Promise<{ start: string; end: string }[]>;
  create(record: BookingRecord): Promise<string>;
  find(record: BookingRecord): Promise<string | null>;
}
export interface Statement { text: string; params?: unknown[] }
export type BookingQuery = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
export type BookingTransaction = (statements: Statement[]) => Promise<Record<string, unknown>[][]>;
