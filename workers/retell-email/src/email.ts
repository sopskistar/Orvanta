import type { Email, EnquiryFields } from "./types.ts";
import type { BookingSummary } from './booking-types.ts';

const labels: Record<keyof EnquiryFields, string> = {
  customer_name: "Customer name", callback_number: "Callback number", service_requested: "Service requested",
  zip_code: "ZIP code", property_details: "Property details", preferred_date: "Preferred cleaning date (as captured)",
  cleaning_notes: "Cleaning notes", callback_preference: "Callback preference", follow_up_needed: "Follow-up needed",
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const bookingTimeFormats = new Map<string,Intl.DateTimeFormat>();

export function renderEmail(fields: EnquiryFields, callId: string, from: string, recipient: string, bookings?: BookingSummary[]): Email {
  const rows = Object.entries(labels).map(([key, label]) => {
    const value = fields[key as keyof EnquiryFields];
    return [label, value === null ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : value === "" ? "Not provided (empty value)" : value];
  });
  const localTime = (value: string|null,zone: string|null) => {
    if(!value)return 'Not recorded';
    const key=zone||'UTC';
    if(!bookingTimeFormats.has(key))bookingTimeFormats.set(key,new Intl.DateTimeFormat('en-US',{timeZone:key,dateStyle:'full',timeStyle:'short'}));
    return bookingTimeFormats.get(key)!.format(new Date(value));
  };
  const bookingRows = bookings?.flatMap(booking=>[
    ['Booking type',booking.type === 'callback' ? 'Callback' : 'Cleaning visit'],
    ['Booking status',booking.status],['Booking time zone',booking.timeZone || 'Not recorded'],
    ['Booking start',localTime(booking.start,booking.timeZone)],
    ['Booking end',localTime(booking.end,booking.timeZone)],
    ['Provider booking ID',booking.providerBookingId || 'None — no confirmed provider receipt'],
  ]) || [];
  const footer = bookings?.some(b=>b.status === 'confirmed' && b.providerBookingId)
    ? 'Only calendar appointments explicitly marked confirmed have been created. These are demonstration bookings; your team confirms quotes and real service arrangements.'
    : 'Your team confirms quotes and appointment availability. This is an enquiry, not a confirmed booking.';
  const bookingText = bookingRows.length ? ['','Demo calendar bookings',...bookingRows.map(([label,value])=>`${label}: ${value}`)] : [];
  const bookingHtml = bookingRows.length ? `<h2>Demo calendar bookings</h2><table>${bookingRows.map(([label,value])=>`<tr><th scope="row" align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>` : '';
  return {
    from: `Orvanta <${from}>`, to: [recipient], subject: `Orvanta enquiry — ${callId}`,
    text: ["Orvanta enquiry summary", `Call ID: ${callId}`, "", ...rows.map(([label, value]) => `${label}: ${value}`), ...bookingText, "", footer].join("\n"),
    html: `<h1>Orvanta enquiry summary</h1><p>Call ID: ${escapeHtml(callId)}</p><table>${rows.map(([label, value]) => `<tr><th scope="row" align="left">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</td></tr>`).join("")}</table>${bookingHtml}<p>${escapeHtml(footer)}</p>`,
  };
}
