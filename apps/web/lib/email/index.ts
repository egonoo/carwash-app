// Phase 1 email infrastructure. Triggers are intentionally NOT wired here —
// downstream phases will call these helpers from booking actions and the
// Stripe webhook. See docs in each module for usage shape.

export {
  REPLY_TO_EMAIL,
  sendEmail,
  type EmailRecipient,
  type SendEmailInput,
  type SendEmailResult,
} from './client';

export {
  enqueueEmailNotification,
  markNotificationSent,
  markNotificationFailed,
  cancelQueuedNotification,
  EmailTemplate,
  type EmailTemplateName,
  type EnqueueEmailNotificationInput,
} from './notifications';

export {
  renderBookingReceivedEmail,
  type BookingReceivedInput,
  type RenderedEmail,
} from './templates/booking-received';

export {
  renderBookingConfirmedEmail,
  type BookingConfirmedInput,
} from './templates/booking-confirmed';

export {
  renderAdminNewBookingEmail,
  type AdminNewBookingInput,
} from './templates/admin-new-booking';

export {
  formatMoneyCents,
  formatAppointmentTime,
  formatVehicleLabel,
  formatCustomerName,
  formatAddress,
  formatCityStateZip,
  type VehicleLike,
  type CustomerLike,
  type AddressLike,
} from './format';
