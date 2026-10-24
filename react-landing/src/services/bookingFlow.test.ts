import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './authApi';
import {
  BLOCKED_NEW_PLOT_MESSAGE,
  IDENTITY_DOCS,
  KYC_LINK_WARNING,
  UNAVAILABLE_UPLOAD_MESSAGE,
  applyIdentityDocRefresh,
  applySubmissionResult,
  decideIncomingUnit,
  findUnusableIdentityDocs,
  hasCurrentAadhaarVerification,
  kycDocumentIdsFor,
  needsSignedUrlRefresh,
  refreshStaleIdentityDocs,
  requiredIdentityDocs,
  resetIdentityDocs,
  startNewPlotBooking,
  type IdentityDocKey,
} from './bookingFlow';
import { loadCustomerDocs, type CustomerDocState } from './documentStore';
import type { GeneratedDocument } from './documentsApi';
import type { InventoryUnit } from './inventoryApi';

const OWNER = 'user-1';
const NOW = 1_800_000_000_000;

function emptyDocs(): CustomerDocState {
  return loadCustomerDocs('nobody@example.com');
}

/** A booking with every identity upload synced and a verified Aadhaar. */
function fullBooking(overrides: Partial<CustomerDocState> = {}): CustomerDocState {
  const docs = emptyDocs();
  for (const { key } of IDENTITY_DOCS) {
    Object.assign(docs, {
      [key]: {
        ...docs[key],
        fileName: `${key}.jpg`,
        documentId: `doc-${key}`,
        signedUrl: `https://cdn/${key}`,
        signedUrlExpiresAt: NOW + 3_600_000,
      },
    });
  }
  docs.aadhar = { ...docs.aadhar, verified: true, verificationId: 'ver-1', verifiedOwnerId: OWNER, name: 'Asha' };
  docs.hasCoApplicant = true;
  docs.applicantSignature = { ...docs.applicantSignature, dataUrl: 'data:sig' };
  docs.bookingApplication = {
    ...docs.bookingApplication,
    inventoryId: 'unit-A',
    inventoryUnitNumber: 'A-1',
    formData: { ...docs.bookingApplication.formData, projectId: 'suraksha-enclave', unitNo: 'A-1', applicantName: 'Asha', mobile: '9999999999' },
  };
  return { ...docs, ...overrides };
}

function remoteDoc(overrides: Partial<GeneratedDocument> = {}): GeneratedDocument {
  return {
    id: 'doc-x',
    owner_id: OWNER,
    owner_role: 'customer',
    document_type: 'aadhaar_front',
    status: 'uploaded',
    created_date: '2026-10-01T00:00:00Z',
    signed_url: 'https://cdn/fresh',
    signed_url_expires_in: 600,
    ...overrides,
  };
}

/** Fake GET /documents/{id} that serves this account's files with the right types. */
function serverFor(docs: CustomerDocState, tweak: Partial<Record<IdentityDocKey, Partial<GeneratedDocument> | Error>> = {}) {
  return vi.fn(async (documentId: string) => {
    const doc = IDENTITY_DOCS.find(({ key }) => docs[key].documentId === documentId);
    if (!doc) throw new ApiError(404, 'not_found', 'Not found');
    const override = tweak[doc.key];
    if (override instanceof Error) throw override;
    return remoteDoc({ id: documentId, document_type: doc.type, ...override });
  });
}

const unitB: InventoryUnit = {
  id: 'unit-B',
  project_name: 'Suraksha Enclave',
  city: null,
  locality: null,
  block: null,
  unit_number: 'B-7',
  unit_type: 'Residential',
  width_mtr: null,
  length_mtr: null,
  area_sqmt: 167.2,
  area_sqyd: 200,
  status: 'available',
  estimated_price: null,
};

beforeEach(() => localStorage.clear());

describe('decideIncomingUnit', () => {
  it('continues when no booking is underway', () => {
    expect(decideIncomingUnit(emptyDocs(), unitB)).toBe('continue');
  });

  it('continues for the same plot, matched by inventory id or unit number', () => {
    const docs = fullBooking();
    expect(decideIncomingUnit(docs, { id: 'unit-A', unit_number: null })).toBe('continue');
    expect(decideIncomingUnit(docs, { id: 'other-id', unit_number: 'A-1' })).toBe('continue');
  });

  it('starts a new booking for a different, unpaid plot', () => {
    expect(decideIncomingUnit(fullBooking(), unitB)).toBe('new-booking');
  });

  it('blocks a different plot while a paid booking is not yet submitted', () => {
    const docs = fullBooking({ payment: { ...emptyDocs().payment, status: 'paid', paymentId: 'pay-1' } });
    expect(decideIncomingUnit(docs, unitB)).toBe('blocked');
    expect(BLOCKED_NEW_PLOT_MESSAGE).toMatch(/not been submitted/);
  });

  it('allows a different plot once the paid booking was submitted, even if the backend omits the KYC link fields', () => {
    const docs = fullBooking({ payment: { ...emptyDocs().payment, status: 'paid', paymentId: 'pay-1' } });
    docs.bookingApplication = {
      ...docs.bookingApplication,
      backendDocumentId: 'app-1',
      kycDocumentsAttached: false,
      aadhaarVerificationAttached: false,
    };
    expect(decideIncomingUnit(docs, unitB)).toBe('new-booking');
  });
});

describe('startNewPlotBooking', () => {
  it('clears Aadhaar, every upload, signatures, payment and all applicant details', () => {
    const previous = fullBooking({ payment: { ...emptyDocs().payment, status: 'paid', paymentId: 'pay-1' } });
    previous.bookingApplication = { ...previous.bookingApplication, backendDocumentId: 'app-1', pdfDataUrl: 'data:pdf' };

    const next = startNewPlotBooking(previous, unitB);
    const fresh = emptyDocs();

    expect(next.aadhar).toEqual(fresh.aadhar);
    for (const { key } of IDENTITY_DOCS) expect(next[key]).toEqual(fresh[key]);
    expect(next.applicantSignature).toEqual(fresh.applicantSignature);
    expect(next.coApplicantSignature).toEqual(fresh.coApplicantSignature);
    expect(next.paymentProof).toEqual(fresh.paymentProof);
    expect(next.hasCoApplicant).toBe(false);
    expect(next.payment).toEqual(fresh.payment);
    expect(next.bookingApplication.backendDocumentId).toBeNull();
    expect(next.bookingApplication.pdfDataUrl).toBeNull();
    expect(next.bookingApplication.formData.applicantName).toBe('');
    expect(next.bookingApplication.formData.mobile).toBe('');
  });

  it('fills in only the new plot details', () => {
    const next = startNewPlotBooking(fullBooking(), unitB);
    expect(next.bookingApplication.inventoryId).toBe('unit-B');
    expect(next.bookingApplication.inventoryUnitNumber).toBe('B-7');
    expect(next.bookingApplication.formData).toMatchObject({
      projectId: 'suraksha-enclave',
      unitNo: 'B-7',
      plotAreaSqYd: '200',
      plotAreaSqMtr: '167.2',
      unitType: 'Residential',
    });
  });

  it('does not mutate the previous booking', () => {
    const previous = fullBooking();
    const snapshot = JSON.stringify(previous);
    startNewPlotBooking(previous, unitB);
    expect(JSON.stringify(previous)).toBe(snapshot);
  });
});

describe('identity document table', () => {
  it('includes the co-applicant photo only when there is a co-applicant', () => {
    expect(requiredIdentityDocs(false).map(({ key }) => key)).not.toContain('coApplicantPhoto');
    expect(requiredIdentityDocs(true).map(({ key }) => key)).toContain('coApplicantPhoto');
  });

  it('builds kyc_document_ids keyed by backend document type', () => {
    const docs = fullBooking();
    expect(kycDocumentIdsFor(docs, false)).toEqual({
      aadhaar_front: 'doc-aadharFront',
      aadhaar_back: 'doc-aadharBack',
      pan_card: 'doc-pan',
      applicant_photo: 'doc-applicantPhoto',
      cancelled_cheque: 'doc-cancelledCheque',
    });
    expect(kycDocumentIdsFor(docs, true).co_applicant_photo).toBe('doc-coApplicantPhoto');
  });

  it('resets only the requested uploads', () => {
    const docs = fullBooking();
    const next = resetIdentityDocs(docs, ['pan', 'cancelledCheque']);
    expect(next.pan.documentId).toBeNull();
    expect(next.cancelledCheque.documentId).toBeNull();
    expect(next.aadharFront.documentId).toBe('doc-aadharFront');
    expect(docs.pan.documentId).toBe('doc-pan');
  });
});

describe('findUnusableIdentityDocs', () => {
  it('returns nothing when every upload is this account’s file of the right type', async () => {
    const docs = fullBooking();
    expect(await findUnusableIdentityDocs(docs, true, OWNER, serverFor(docs))).toEqual([]);
  });

  it('flags missing uploads without calling the server for them', async () => {
    const docs = fullBooking();
    docs.pan = { ...docs.pan, documentId: null };
    const fetch = serverFor(docs);
    const unusable = await findUnusableIdentityDocs(docs, false, OWNER, fetch);
    expect(unusable.map(({ key }) => key)).toEqual(['pan']);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('flags files owned by another account, of the wrong type, or gone (403/404)', async () => {
    const docs = fullBooking();
    const fetch = serverFor(docs, {
      aadharFront: { owner_id: 'someone-else' },
      aadharBack: { document_type: 'pan_card' },
      pan: new ApiError(404, 'not_found', 'Not found'),
      applicantPhoto: new ApiError(403, 'forbidden', 'Forbidden'),
    });
    const unusable = await findUnusableIdentityDocs(docs, false, OWNER, fetch);
    expect(unusable.map(({ key }) => key)).toEqual(['aadharFront', 'aadharBack', 'pan', 'applicantPhoto']);
  });

  it('re-throws 401 so the caller can sign the user out', async () => {
    const docs = fullBooking();
    const fetch = serverFor(docs, { pan: new ApiError(401, 'invalid_token', 'Expired') });
    await expect(findUnusableIdentityDocs(docs, false, OWNER, fetch)).rejects.toMatchObject({ status: 401 });
  });

  it('turns other failures into a retryable error', async () => {
    const docs = fullBooking();
    const fetch = serverFor(docs, { pan: new ApiError(500, 'boom', 'Server error') });
    await expect(findUnusableIdentityDocs(docs, false, OWNER, fetch)).rejects.toThrow(/Could not verify your saved documents/);
  });
});

describe('needsSignedUrlRefresh', () => {
  const base = { documentId: 'd', dataUrl: null, signedUrl: 'https://x', signedUrlExpiresAt: NOW + 3_600_000 };
  it('is false for a fresh link, a local copy, or no upload', () => {
    expect(needsSignedUrlRefresh(base, NOW)).toBe(false);
    expect(needsSignedUrlRefresh({ ...base, signedUrlExpiresAt: NOW - 1, dataUrl: 'data:x' }, NOW)).toBe(false);
    expect(needsSignedUrlRefresh({ ...base, documentId: null, signedUrl: null }, NOW)).toBe(false);
  });
  it('is true when the link is missing or expires within a minute', () => {
    expect(needsSignedUrlRefresh({ ...base, signedUrl: null }, NOW)).toBe(true);
    expect(needsSignedUrlRefresh({ ...base, signedUrlExpiresAt: NOW + 30_000 }, NOW)).toBe(true);
  });
});

describe('refreshStaleIdentityDocs + applyIdentityDocRefresh', () => {
  it('makes no requests when every link is fresh', async () => {
    const docs = fullBooking();
    const fetch = serverFor(docs);
    expect(await refreshStaleIdentityDocs(docs, OWNER, fetch, NOW)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes stale links and resets files that are not this account’s', async () => {
    const docs = fullBooking();
    docs.pan = { ...docs.pan, signedUrlExpiresAt: NOW - 1 };
    docs.aadharBack = { ...docs.aadharBack, signedUrl: null };
    const fetch = serverFor(docs, { aadharBack: { owner_id: 'someone-else' } });

    const refreshes = await refreshStaleIdentityDocs(docs, OWNER, fetch, NOW);
    expect(fetch).toHaveBeenCalledTimes(2);

    const next = applyIdentityDocRefresh(docs, refreshes) as CustomerDocState;
    expect(next.pan.signedUrl).toBe('https://cdn/fresh');
    expect(next.pan.signedUrlExpiresAt).toBe(NOW + 600_000);
    expect(next.pan.fileName).toBe('pan.jpg');
    expect(next.aadharBack.documentId).toBeNull();
    expect(next.aadharBack.error).toBe(UNAVAILABLE_UPLOAD_MESSAGE);
  });

  it('leaves entries alone on transient failures', async () => {
    const docs = fullBooking();
    docs.pan = { ...docs.pan, signedUrl: null };
    const fetch = serverFor(docs, { pan: new Error('offline') });
    const refreshes = await refreshStaleIdentityDocs(docs, OWNER, fetch, NOW);
    expect(refreshes).toEqual([]);
    expect(applyIdentityDocRefresh(docs, refreshes)).toBeNull();
  });

  it('does not overwrite an upload the customer replaced mid-request', async () => {
    const docs = fullBooking();
    docs.pan = { ...docs.pan, signedUrl: null };
    const refreshes = await refreshStaleIdentityDocs(docs, OWNER, serverFor(docs), NOW);
    const latest = { ...docs, pan: { ...docs.pan, documentId: 'doc-new-pan', signedUrl: 'https://cdn/new' } };
    expect(applyIdentityDocRefresh(latest, refreshes)).toBeNull();
  });
});

describe('applySubmissionResult', () => {
  const accepted = (overrides: Partial<GeneratedDocument> = {}) =>
    remoteDoc({ id: 'app-1', document_type: 'project_booking_application', ...overrides });

  it('records a confirmed submission without clearing the submitted booking', () => {
    const docs = fullBooking();
    const { state, warning } = applySubmissionResult(
      docs,
      accepted({ booking_id: 'bk-1', kyc_documents_attached: true, aadhaar_verification_attached: true }),
      { fileName: 'app.pdf', pdfDataUrl: 'data:pdf', now: NOW },
    );
    expect(warning).toBeNull();
    expect(state.bookingApplication).toMatchObject({
      backendDocumentId: 'app-1',
      bookingId: 'bk-1',
      kycDocumentsAttached: true,
      aadhaarVerificationAttached: true,
      pdfDataUrl: 'data:pdf',
      pdfFileName: 'app.pdf',
      signedUrlExpiresAt: NOW + 600_000,
      error: null,
    });
    // The post-submit screen still has everything it needs.
    expect(state.aadhar.verified).toBe(true);
    expect(state.applicantSignature.dataUrl).toBe('data:sig');
  });

  it('still records the submission (no duplicate upload on retry) when the KYC links fail', () => {
    const { state, warning } = applySubmissionResult(
      fullBooking(),
      accepted({ booking_id: 'bk-1', kyc_documents_attached: false, aadhaar_verification_attached: true }),
      { fileName: 'app.pdf', pdfDataUrl: 'data:pdf', now: NOW },
    );
    expect(warning).toBe(KYC_LINK_WARNING);
    expect(state.bookingApplication.backendDocumentId).toBe('app-1');
    expect(state.bookingApplication.kycDocumentsAttached).toBe(false);
    expect(state.bookingApplication.error).toBe(KYC_LINK_WARNING);
  });

  it('treats link flags without a booking id as not attached, without warning when they are omitted', () => {
    const { state, warning } = applySubmissionResult(fullBooking(), accepted(), {
      fileName: 'app.pdf',
      pdfDataUrl: 'data:pdf',
      now: NOW,
    });
    expect(warning).toBeNull();
    expect(state.bookingApplication.kycDocumentsAttached).toBe(false);
    expect(state.bookingApplication.bookingId).toBeNull();
  });

  it('syncs the inventory lock status the server reports', () => {
    const { state } = applySubmissionResult(fullBooking(), accepted({ inventory_status: 'conflict' }), {
      fileName: 'app.pdf',
      pdfDataUrl: 'data:pdf',
      now: NOW,
    });
    expect(state.payment.inventoryStatus).toBe('conflict');
  });
});

describe('hasCurrentAadhaarVerification', () => {
  it('requires a verified result with an id, received by the signed-in account', () => {
    const docs = fullBooking();
    expect(hasCurrentAadhaarVerification(docs, OWNER)).toBe(true);
    expect(hasCurrentAadhaarVerification(docs, 'someone-else')).toBe(false);
    expect(hasCurrentAadhaarVerification(docs, null)).toBe(false);
    expect(hasCurrentAadhaarVerification({ ...docs, aadhar: { ...docs.aadhar, verificationId: null } }, OWNER)).toBe(false);
    expect(hasCurrentAadhaarVerification({ ...docs, aadhar: { ...docs.aadhar, verified: false } }, OWNER)).toBe(false);
  });

  it('is false for a booking started fresh after a previous one', () => {
    expect(hasCurrentAadhaarVerification(startNewPlotBooking(fullBooking(), unitB), OWNER)).toBe(false);
  });
});
