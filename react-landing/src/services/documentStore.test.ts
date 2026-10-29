import { beforeEach, describe, expect, it } from 'vitest';
import {
  AADHAAR_REVERIFY_MESSAGE,
  clearBookingUploadCache,
  clearCustomerDocsCache,
  emptyAadhaarPhotoStatus,
  forAadhaarOwner,
  loadAccountCustomerDocs,
  loadApplicantContactSnapshot,
  loadCustomerDocs,
  loadCustomerProfilePhoto,
  saveApplicantContactSnapshot,
  saveCustomerDocs,
  saveCustomerProfilePhoto,
  type CustomerDocState,
} from './documentStore';

const EMAIL = 'asha@example.com';
const OWNER = 'user-1';

function verifiedDocs(ownerId: string | null): CustomerDocState {
  const docs = loadCustomerDocs(EMAIL);
  docs.aadhar = { ...docs.aadhar, verified: true, verificationId: 'ver-1', verifiedOwnerId: ownerId, name: 'Asha' };
  return docs;
}

beforeEach(() => localStorage.clear());

describe('forAadhaarOwner', () => {
  it('keeps a verification received by this account', () => {
    const docs = verifiedDocs(OWNER);
    expect(forAadhaarOwner(docs, OWNER)).toBe(docs);
  });

  it('keeps an unverified state untouched', () => {
    const docs = loadCustomerDocs(EMAIL);
    expect(forAadhaarOwner(docs, OWNER)).toBe(docs);
  });

  it('drops a verification from another or unknown account and says why', () => {
    for (const owner of ['someone-else', null]) {
      const scoped = forAadhaarOwner(verifiedDocs(owner), OWNER);
      expect(scoped.aadhar.verified).toBe(false);
      expect(scoped.aadhar.verificationId).toBeNull();
      expect(scoped.aadhar.name).toBeNull();
      expect(scoped.aadhar.lastAttemptError).toBe(AADHAAR_REVERIFY_MESSAGE);
    }
  });
});

describe('loadAccountCustomerDocs', () => {
  it('drops and persists a foreign verification so it does not come back', () => {
    saveCustomerDocs(EMAIL, verifiedDocs('someone-else'));
    expect(loadAccountCustomerDocs(EMAIL, OWNER).aadhar.verified).toBe(false);
    expect(loadCustomerDocs(EMAIL).aadhar.verified).toBe(false);
  });

  it('does not scope (or write) without a signed-in account', () => {
    saveCustomerDocs(EMAIL, verifiedDocs('someone-else'));
    expect(loadAccountCustomerDocs(EMAIL, null).aadhar.verified).toBe(true);
  });
});

describe('clearBookingUploadCache', () => {
  it('clears verification and uploads but leaves the booking application and payment to the caller', () => {
    const docs = verifiedDocs(OWNER);
    docs.pan = { ...docs.pan, documentId: 'doc-pan' };
    docs.hasCoApplicant = true;
    docs.bookingApplication = { ...docs.bookingApplication, backendDocumentId: 'app-1', pdfDataUrl: 'data:pdf' };
    docs.payment = { ...docs.payment, status: 'paid' };

    const cleared = clearBookingUploadCache(docs);
    expect(cleared.aadhar.verified).toBe(false);
    expect(cleared.pan.documentId).toBeNull();
    expect(cleared.hasCoApplicant).toBe(false);
    expect(cleared.bookingApplication).toBe(docs.bookingApplication);
    expect(cleared.payment).toBe(docs.payment);
  });
});

describe('customer profile photo', () => {
  const photo = { ...emptyAadhaarPhotoStatus(), fileName: 'me.jpg', documentId: 'doc-1', signedUrl: 'https://cdn/me', dataUrl: 'data:me' };

  it('is stored apart from the booking applicant photo', () => {
    saveCustomerProfilePhoto(EMAIL, photo);
    expect(loadCustomerProfilePhoto(EMAIL)).toMatchObject({ documentId: 'doc-1', signedUrl: 'https://cdn/me' });
    expect(loadCustomerDocs(EMAIL).applicantPhoto.documentId).toBeNull();
  });

  it('drops the base64 copy once the backend holds the file, but keeps a local-only photo', () => {
    saveCustomerProfilePhoto(EMAIL, photo);
    expect(loadCustomerProfilePhoto(EMAIL).dataUrl).toBeNull();
    saveCustomerProfilePhoto(EMAIL, { ...photo, documentId: null, signedUrl: null });
    expect(loadCustomerProfilePhoto(EMAIL).dataUrl).toBe('data:me');
  });

  it('migrates a legacy avatar from the booking once, without touching the booking', () => {
    const docs = loadCustomerDocs(EMAIL);
    saveCustomerDocs(EMAIL, { ...docs, applicantPhoto: { ...docs.applicantPhoto, fileName: 'old.jpg', dataUrl: 'data:old', error: 'x' } });

    expect(loadCustomerProfilePhoto(EMAIL)).toMatchObject({ fileName: 'old.jpg', dataUrl: 'data:old', error: null });
    expect(loadCustomerDocs(EMAIL).applicantPhoto.dataUrl).toBe('data:old');

    // Already migrated: a later booking photo no longer leaks into the avatar.
    const later = loadCustomerDocs(EMAIL);
    saveCustomerDocs(EMAIL, { ...later, applicantPhoto: { ...later.applicantPhoto, fileName: 'booking.jpg', dataUrl: 'data:booking' } });
    expect(loadCustomerProfilePhoto(EMAIL).fileName).toBe('old.jpg');
  });

  it('is empty when nothing exists to migrate', () => {
    expect(loadCustomerProfilePhoto(EMAIL)).toEqual(emptyAadhaarPhotoStatus());
  });
});

describe('applicant contact snapshot', () => {
  it('saves display fields from the form, falling back to the Aadhaar result', () => {
    const docs = verifiedDocs(OWNER);
    docs.aadhar = { ...docs.aadhar, gender: 'F', dob: '1990-01-01', address: 'Aadhaar address' };
    docs.bookingApplication.formData = { ...docs.bookingApplication.formData, mobile: '9999999999', applicantName: '' };
    saveApplicantContactSnapshot(EMAIL, docs);
    expect(loadApplicantContactSnapshot(EMAIL)).toEqual({
      applicantName: 'Asha',
      gender: 'F',
      dob: '1990-01-01',
      mobile: '9999999999',
      phone: '',
      address: 'Aadhaar address',
    });
  });
});

describe('clearCustomerDocsCache (logout)', () => {
  it('removes the booking, the avatar and the contact snapshot', () => {
    saveCustomerDocs(EMAIL, verifiedDocs(OWNER));
    saveCustomerProfilePhoto(EMAIL, { ...emptyAadhaarPhotoStatus(), documentId: 'doc-1' });
    saveApplicantContactSnapshot(EMAIL, verifiedDocs(OWNER));

    clearCustomerDocsCache(EMAIL);

    expect(localStorage.length).toBe(0);
    expect(loadCustomerDocs(EMAIL).aadhar.verified).toBe(false);
    expect(loadCustomerProfilePhoto(EMAIL)).toEqual(emptyAadhaarPhotoStatus());
    expect(loadApplicantContactSnapshot(EMAIL).applicantName).toBe('');
  });
});
