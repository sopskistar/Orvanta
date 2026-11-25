import type { Email, EnquiryFields } from "./types.ts";

const labels: Record<keyof EnquiryFields, string> = {
  customer_name: "Customer name", callback_number: "Callback number", service_requested: "Service requested",
  zip_code: "ZIP code", property_details: "Property details", preferred_date: "Preferred cleaning date (as captured)",
  cleaning_notes: "Cleaning notes", callback_preference: "Callback preference", follow_up_needed: "Follow-up needed",
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function renderEmail(fields: EnquiryFields, callId: string, from: string, recipient: string): Email {
  const rows = Object.entries(labels).map(([key, label]) => {
    const value = fields[key as keyof EnquiryFields];
    return [label, value === null ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : value === "" ? "Not provided (empty value)" : value];
  });
  return {
    from: `Orvanta <${from}>`, to: [recipient], subject: `Orvanta enquiry — ${callId}`,
    text: ["Orvanta enquiry summary", `Call ID: ${callId}`, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", "Your team confirms quotes and appointment availability. This is an enquiry, not a confirmed booking."].join("\n"),
    html: `<h1>Orvanta enquiry summary</h1><p>Call ID: ${escapeHtml(callId)}</p><table>${rows.map(([label, value]) => `<tr><th scope="row" align="left">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</td></tr>`).join("")}</table><p>Your team confirms quotes and appointment availability. This is an enquiry, not a confirmed booking.</p>`,
  };
}
