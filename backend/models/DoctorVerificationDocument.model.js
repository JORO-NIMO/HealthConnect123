const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class DoctorVerificationDocumentModel {
  static async create({ doctorId, uploadedBy, documentType, fileUrl, fileName, fileSize, mimeType, notes }) {
    const id = uuidv4();
    await query(
      `INSERT INTO doctor_verification_documents
        (id, doctor_id, uploaded_by, document_type, file_url, file_name, file_size, mime_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        doctorId,
        uploadedBy,
        documentType || 'other',
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        notes || null,
      ]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(
      `SELECT dvd.*, u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM doctor_verification_documents dvd
       JOIN users u ON u.id = dvd.uploaded_by
       WHERE dvd.id = ?`,
      [id]
    );
  }

  static async listByDoctor(doctorId) {
    return query(
      `SELECT dvd.*, u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM doctor_verification_documents dvd
       JOIN users u ON u.id = dvd.uploaded_by
       WHERE dvd.doctor_id = ?
       ORDER BY dvd.created_at DESC`,
      [doctorId]
    );
  }

  static async countByDoctor(doctorId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS total FROM doctor_verification_documents WHERE doctor_id = ?',
      [doctorId]
    );
    return row?.total || 0;
  }

  // Batch query to resolve N+1 overhead of fetching verification documents for multiple doctors
  static async getDoctorsVerificationDocuments(doctorIds) {
    if (!doctorIds || !doctorIds.length) return {};

    // Remove duplicates and nulls/undefined values
    const uniqueIds = [...new Set(doctorIds.filter(Boolean))];
    if (!uniqueIds.length) return {};

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const rows = await query(
      `SELECT dvd.*, u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM doctor_verification_documents dvd
       JOIN users u ON u.id = dvd.uploaded_by
       WHERE dvd.doctor_id IN (${placeholders})
       ORDER BY dvd.created_at DESC`,
      uniqueIds
    );

    // Group rows by doctor_id
    const mapping = {};
    for (const id of uniqueIds) {
      mapping[id] = [];
    }
    for (const row of rows) {
      const { doctor_id } = row;
      if (!mapping[doctor_id]) {
        mapping[doctor_id] = [];
      }
      mapping[doctor_id].push(row);
    }
    return mapping;
  }

  static async deleteByIdForDoctor(id, doctorId) {
    const result = await query(
      'DELETE FROM doctor_verification_documents WHERE id = ? AND doctor_id = ?',
      [id, doctorId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = DoctorVerificationDocumentModel;
