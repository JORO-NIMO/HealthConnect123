const EmergencyModel    = require('../models/Emergency.model');
const VitalSignModel    = require('../models/VitalSign.model');
const PatientModel      = require('../models/Patient.model');
const HospitalModel     = require('../models/Hospital.model');
const UserModel         = require('../models/User.model');
const NotificationModel = require('../models/Notification.model');
const SMSService        = require('../services/sms.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

const SOS_NEARBY_RADIUS_KM = parseFloat(process.env.SOS_NEARBY_RADIUS_KM || '30');
const SOS_NEARBY_LIMIT = parseInt(process.env.SOS_NEARBY_HOSPITAL_LIMIT || '10', 10);
const SOS_IDEMPOTENCY_HEADER = 'x-idempotency-key';

function uniqueById(items = []) {
  const map = new Map();
  for (const item of items) {
    if (item?.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function uniqueUserIds(rows = []) {
  return [...new Set(rows.map(r => r.user_id).filter(Boolean))];
}

function extractIdempotencyKey(req) {
  const headerValue = req.get(SOS_IDEMPOTENCY_HEADER);
  const bodyValue = req.body?.idempotencyKey;
  const raw = typeof headerValue === 'string' && headerValue.trim() ? headerValue : bodyValue;
  return EmergencyModel.normalizeIdempotencyKey(raw);
}

async function getResponderHospitalIdsByUser(userId) {
  const ids = await HospitalModel.getHospitalIdsByResponderUser(userId);
  return [...new Set((ids || []).filter(Boolean))];
}

async function getTargetHospitals({ patientId, latitude, longitude }) {
  const hasCoordinates = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  const [registeredHospitals, nearbyHospitals] = await Promise.all([
    HospitalModel.getPatientHospitals(patientId),
    hasCoordinates
      ? HospitalModel.findNearby(
          Number(latitude),
          Number(longitude),
          SOS_NEARBY_RADIUS_KM,
          SOS_NEARBY_LIMIT,
          { emergencyOnly: true, verifiedOnly: true }
        )
      : Promise.resolve([]),
  ]);

  return uniqueById([...(registeredHospitals || []), ...(nearbyHospitals || [])]);
}

async function dispatchSOSToHospitals({ io, sos, patient, latitude, longitude, address, symptoms }) {
  const hospitals = await getTargetHospitals({
    patientId: patient.id,
    latitude,
    longitude,
  });

  const hospitalIds = hospitals.map(h => h.id);
  if (hospitalIds.length) {
    await EmergencyModel.upsertDispatchTargets(sos.id, hospitalIds);
  }

  const responderRows = hospitalIds.length
    ? await HospitalModel.getResponderUsersByHospitalIds(hospitalIds)
    : [];
  const responderUserIds = uniqueUserIds(responderRows);

  if (!responderUserIds.length) {
    return { hospitals, responderUserIds };
  }

  const location = {
    latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
    longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
    address: address || null,
  };

  const patientName = `${patient.first_name} ${patient.last_name}`.trim();
  const hospitalNames = hospitals.map(h => h.name).filter(Boolean);

  await NotificationModel.createBulk(responderUserIds, {
    title: '🚨 Emergency SOS Dispatch',
    message: `${patientName} triggered an SOS. Open Emergency panel to respond.`,
    type: 'emergency',
    metadata: {
      sosId: sos.id,
      patientId: patient.id,
      patientName,
      location,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      dispatchedHospitalIds: hospitalIds,
      dispatchedHospitalNames: hospitalNames,
    },
  });

  if (io) {
    const eventPayload = {
      sosId: sos.id,
      patientId: patient.id,
      patientName,
      location,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      status: 'triggered',
      dispatchedHospitalIds: hospitalIds,
      dispatchedHospitalNames: hospitalNames,
      timestamp: new Date().toISOString(),
      message: `${patientName} triggered an emergency SOS.`,
    };

    for (const userId of responderUserIds) {
      io.to(`user:${userId}`).emit('emergency-sos', eventPayload);
      io.to(`user:${userId}`).emit('notification', {
        type: 'emergency',
        title: '🚨 Emergency SOS Dispatch',
        message: `${patientName} triggered an SOS nearby/linked to your hospital.`,
        data: { sosId: sos.id, location },
      });
    }
  }

  return { hospitals, responderUserIds };
}

async function notifyOtherRespondersAboutClaim({ io, sos, responderUserId, responderName, status, notes }) {
  const persistedHospitalIds = await EmergencyModel.listDispatchTargetHospitalIds(sos.id);
  const hospitalIds = persistedHospitalIds.length
    ? persistedHospitalIds
    : (await getTargetHospitals({
      patientId: sos.patient_id,
      latitude: sos.latitude,
      longitude: sos.longitude,
    })).map(h => h.id);

  const responderRows = hospitalIds.length
    ? await HospitalModel.getResponderUsersByHospitalIds(hospitalIds)
    : [];

  const recipientUserIds = uniqueUserIds(responderRows).filter(uid => uid !== responderUserId);
  if (!recipientUserIds.length) return;

  const safeStatus = status || 'acknowledged';
  const msg = `${responderName} has ${safeStatus} this SOS. Stand down unless re-assigned.`;

  await NotificationModel.createBulk(recipientUserIds, {
    title: '✅ SOS Already Claimed',
    message: msg,
    type: 'emergency',
    metadata: {
      sosId: sos.id,
      status: safeStatus,
      respondedBy: responderUserId,
      responderName,
      notes: notes || null,
    },
  });

  if (io) {
    const payload = {
      sosId: sos.id,
      status: safeStatus,
      respondedBy: responderUserId,
      responderName,
      notes: notes || null,
      timestamp: new Date().toISOString(),
      message: msg,
    };

    for (const userId of recipientUserIds) {
      io.to(`user:${userId}`).emit('sos-responded', payload);
      io.to(`user:${userId}`).emit('notification', {
        type: 'emergency',
        title: '✅ SOS Already Claimed',
        message: msg,
        data: { sosId: sos.id, status: safeStatus },
      });
    }
  }
}

// ─── Trigger Emergency SOS ────────────────────────────────────────────────
exports.triggerSOS = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const idempotencyKey = extractIdempotencyKey(req);
    if (!idempotencyKey) {
      return sendError(res, 400, 'Missing idempotency key. Send X-Idempotency-Key header when triggering SOS.');
    }

    const { latitude, longitude, address, symptoms } = req.body;

    const resolvedLatitude = Number.isFinite(Number(latitude))
      ? Number(latitude)
      : (Number.isFinite(Number(patient.latitude)) ? Number(patient.latitude) : null);
    const resolvedLongitude = Number.isFinite(Number(longitude))
      ? Number(longitude)
      : (Number.isFinite(Number(patient.longitude)) ? Number(patient.longitude) : null);

    // Get latest vitals as snapshot
    const latestVitals = await VitalSignModel.getLatest(patient.id);

    const sos = await EmergencyModel.triggerSOS({
      patientId: patient.id,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      address,
      symptoms,
      vitalsSnapshot: latestVitals || null,
      idempotencyKey,
    });

    if (sos?._idempotentReplay) {
      const replaySOS = { ...sos };
      delete replaySOS._idempotentReplay;

      return sendSuccess(res, 200, 'Emergency SOS already received. Help dispatch is in progress.', {
        sos: replaySOS,
        dispatch: {
          hospitalsNotified: null,
          respondersNotified: null,
          replayed: true,
        },
      });
    }

    // Notify emergency contacts via SMS
    const contacts = await EmergencyModel.listContacts(patient.id);
    const user = req.user;
    const locationUrl = resolvedLatitude && resolvedLongitude
      ? `https://maps.google.com/?q=${resolvedLatitude},${resolvedLongitude}`
      : 'Location unavailable';

    for (const contact of contacts) {
      if (contact.notify_on_emergency && contact.phone) {
        SMSService.sendSMS(
          contact.phone,
          `🚨 EMERGENCY ALERT from HealthConnect!\n${user.first_name} ${user.last_name} has triggered an emergency SOS.\n${symptoms?.length ? `Symptoms: ${symptoms.join(', ')}` : ''}\nLocation: ${locationUrl}\nPlease check on them immediately.`
        ).catch(err => logger.error(`SOS SMS failed for ${contact.phone}:`, err.message));
      }
    }

    // Notify linked + nearby hospitals and their responders (admins/doctors)
    const io = req.app.get('io');
    const dispatch = await dispatchSOSToHospitals({
      io,
      sos,
      patient,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      address,
      symptoms,
    });

    logger.warn(`🚨 EMERGENCY SOS triggered by ${user.first_name} ${user.last_name} (${patient.id})`);
    logger.info(`🚑 SOS ${sos.id} dispatched to ${dispatch.hospitals.length} hospitals and ${dispatch.responderUserIds.length} responder users`);

    return sendSuccess(res, 201, 'Emergency SOS triggered. Help is on the way.', {
      sos,
      dispatch: {
        hospitalsNotified: dispatch.hospitals.length,
        respondersNotified: dispatch.responderUserIds.length,
      },
    });
  } catch (err) { next(err); }
};

// ─── Emergency Contacts CRUD ──────────────────────────────────────────────
exports.addContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { name, relationship, phone, email, isPrimary, notifyOnEmergency } = req.body;
    if (!name || !relationship || !phone) {
      return sendError(res, 400, 'Name, relationship, and phone are required.');
    }

    const contact = await EmergencyModel.addContact({
      patientId: patient.id, name, relationship, phone, email, isPrimary, notifyOnEmergency,
    });

    return sendSuccess(res, 201, 'Emergency contact added.', { contact });
  } catch (err) { next(err); }
};

exports.listContacts = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const contacts = await EmergencyModel.listContacts(patient.id);
    return sendSuccess(res, 200, 'Emergency contacts retrieved.', { contacts });
  } catch (err) { next(err); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const contact = await EmergencyModel.updateContact(req.params.id, patient.id, req.body);
    if (!contact) return sendError(res, 404, 'Contact not found.');

    return sendSuccess(res, 200, 'Contact updated.', { contact });
  } catch (err) { next(err); }
};

exports.deleteContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const deleted = await EmergencyModel.deleteContact(req.params.id, patient.id);
    if (!deleted) return sendError(res, 404, 'Contact not found.');

    return sendSuccess(res, 200, 'Contact deleted.');
  } catch (err) { next(err); }
};

// ─── Get SOS History ──────────────────────────────────────────────────────
exports.getSOSHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const history = await EmergencyModel.listSOSByPatient(patient.id);
    return sendSuccess(res, 200, 'SOS history retrieved.', { history });
  } catch (err) { next(err); }
};

// ─── Admin/Doctor: Active Emergencies ─────────────────────────────────────
exports.getActiveEmergencies = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const active = await EmergencyModel.listActiveSOS();
      return sendSuccess(res, 200, 'Active emergencies.', { emergencies: active });
    }

    const hospitalIds = await getResponderHospitalIdsByUser(req.user.id);
    if (!hospitalIds.length) {
      return sendSuccess(res, 200, 'Active emergencies.', { emergencies: [] });
    }

    // Use the batched query helper to load all active emergencies in a single query (resolves N+1 overhead)
    const items = await EmergencyModel.listActiveSOSForHospitals(hospitalIds);
    const emergencies = uniqueById(items);

    return sendSuccess(res, 200, 'Active emergencies.', { emergencies });
  } catch (err) { next(err); }
};

// ─── Hospital Queue (targeted SOS only) ──────────────────────────────────
exports.getHospitalSOSQueue = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const queue = await EmergencyModel.listActiveSOS();
      return sendSuccess(res, 200, 'Hospital SOS queue retrieved.', { queue });
    }

    const hospitalIds = await getResponderHospitalIdsByUser(req.user.id);
    if (!hospitalIds.length) {
      return sendSuccess(res, 200, 'Hospital SOS queue retrieved.', { queue: [] });
    }

    // Use the batched query helper to load the active hospital queue in a single query (resolves N+1 overhead)
    const items = await EmergencyModel.listActiveSOSForHospitals(hospitalIds);
    const queue = uniqueById(items);

    return sendSuccess(res, 200, 'Hospital SOS queue retrieved.', { queue });
  } catch (err) { next(err); }
};

// ─── Admin/Doctor: Respond to SOS ─────────────────────────────────────────
exports.respondToSOS = async (req, res, next) => {
  try {
    const targetHospitalIds = await EmergencyModel.listDispatchTargetHospitalIds(req.params.id);

    if (req.user.role !== 'admin' && targetHospitalIds.length) {
      const responderHospitalIds = await getResponderHospitalIdsByUser(req.user.id);
      const canRespond = responderHospitalIds.some(id => targetHospitalIds.includes(id));
      if (!canRespond) {
        return sendError(res, 403, 'You are not assigned to this SOS dispatch.');
      }
    }

    const { status, notes } = req.body;
    const sos = await EmergencyModel.respondToSOS(req.params.id, req.user.id, status || 'acknowledged', notes);
    if (!sos) return sendError(res, 404, 'SOS not found.');

    const responderHospitalIds = await getResponderHospitalIdsByUser(req.user.id);
    if (targetHospitalIds.length) {
      const claimedHospitalIds = responderHospitalIds.filter(id => targetHospitalIds.includes(id));
      await EmergencyModel.markDispatchClaimedByHospitals(sos.id, claimedHospitalIds, req.user.id);
      await EmergencyModel.markDispatchStandDownOthers(sos.id, claimedHospitalIds);
    }

    // Notify the patient
    if (sos.patient_id) {
      const patient = await PatientModel.findById(sos.patient_id);
      if (patient) {
        await NotificationModel.create({
          userId: patient.user_id,
          title: '🆘 Emergency Response',
          message: `A healthcare provider has acknowledged your emergency. ${notes || 'Help is on the way.'}`,
          type: 'emergency',
          metadata: { sosId: sos.id },
        });

        const io = req.app.get('io');
        if (io) {
          io.to(`user:${patient.user_id}`).emit('sos-responded', {
            sosId: sos.id,
            status: sos.status,
            responderId: req.user.id,
            message: notes || 'A provider has acknowledged your SOS.',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const responderProfile = await UserModel.findById(req.user.id);
    const responderName = [responderProfile?.first_name, responderProfile?.last_name].filter(Boolean).join(' ').trim()
      || responderProfile?.email
      || req.user?.email
      || 'A responder';

    await notifyOtherRespondersAboutClaim({
      io: req.app.get('io'),
      sos,
      responderUserId: req.user.id,
      responderName,
      status: sos.status,
      notes,
    });

    return sendSuccess(res, 200, 'SOS response recorded.', { sos });
  } catch (err) { next(err); }
};
