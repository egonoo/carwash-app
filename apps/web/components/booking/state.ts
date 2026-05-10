import { v4 as uuidv4 } from 'uuid';

export type AddonSelection = { addonId: string; quantity: number };

export type DetectedZoneInfo = {
  id: string;
  name: string;
  extraFeeCents: number;
  matchedBy: 'zip' | 'fallback';
};

export type WizardPhotoStatus = 'ok' | 'broken' | 'invalid';

export type WizardPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status: WizardPhotoStatus;
  errorMsg?: string;
};

export type WizardState = {
  idempotencyKey: string;
  zoneId: string | null;
  detectedZone: DetectedZoneInfo | null;
  startsAtISO: string | null;
  vehicleTypeId: string | null;
  packageId: string | null;
  addons: AddonSelection[];
  vehicle: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    plate?: string;
    plateState?: string;
    vin?: string;
    nickname?: string;
  };
  customer: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
    addressLat?: number;
    addressLng?: number;
    instructions?: string;
    marketingConsent: boolean;
    nonRefundableAccepted: boolean;
  };
  photos: WizardPhoto[];
  evidenceConsent: {
    currentStateAccepted: boolean;
    marketingUseConsent: boolean;
  };
  promoCode?: string;
  depositMethod: 'card' | 'zelle';
};

export function initialState(): WizardState {
  return {
    idempotencyKey: uuidv4(),
    zoneId: null,
    detectedZone: null,
    startsAtISO: null,
    vehicleTypeId: null,
    packageId: null,
    addons: [],
    vehicle: {},
    customer: { marketingConsent: false, nonRefundableAccepted: false },
    photos: [],
    evidenceConsent: { currentStateAccepted: false, marketingUseConsent: false },
    depositMethod: 'card',
  };
}
