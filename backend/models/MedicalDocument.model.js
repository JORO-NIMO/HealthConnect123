const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class MedicalDocumentModel {
  // ─── Create ───────────────────────────────────────────────────────────
  static async create({
    patientId, uploadedBy, title, description, docType, fileUrl,
    fileName, fileSize, mimeType, docDate, facility, doctorName, tags, isSensitive,
  }) {
    const id = uuidv4();
    await query(
      `INSERT INTO medical_documents
         (id, patient_id, uploaded_by, title, description, doc_type, file_url,
          file_name, file_size, mime_type, doc_date, facility, doctor_name, tags, is_sensitive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, patientId, uploadedBy, title, description || null,
        docType || 'other', fileUrl, fileName, fileSize, mimeType,
        docDate || null, facility || null, doctorName || null,
        tags ? JSON.stringify(tags) : null, isSensitive || false,
      ]
    );
    return this.findById(id);
  }

  // ─── Find by ID ──────────────────────────────────────────────────────
  static async findById(id) {
    const doc = await queryOne(
      `SELECT md.*, u.first_name AS uploader_first_name, u.last_name AS uploader_last_name
       FROM medical_documents md
       JOIN users u ON u.id = md.uploaded_by
       WHERE md.id = ?`,
      [id]
    );
    if (doc?.tags) doc.tags = JSON.parse(doc.tags);
    return doc;
  }

  // ─── List by Patient ─────────────────────────────────────────────────
  static async listByPatient(patientId, { limit = 50, offset = 0, docType, search } = {}) {
    let sql = `
      SELECT md.*, u.first_name AS uploader_first_name, u.last_name AS uploader_last_name
      FROM medical_documents md
      JOIN users u ON u.id = md.uploaded_by
      WHERE md.patient_id = ?`;
    const params = [patientId];

    if (docType) { sql += ' AND md.doc_type = ?'; params.push(docType); }
    if (search)  { sql += ' AND (md.title LIKE ? OR md.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    sql += ' ORDER BY md.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const docs = await query(sql, params);
    return docs.map(d => {
      if (d.tags) d.tags = JSON.parse(d.tags);
      return d;
    });
  }

  // ─── Count ───────────────────────────────────────────────────────────
  static async countByPatient(patientId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS total FROM medical_documents WHERE patient_id = ?',
      [patientId]
    );
    return row?.total || 0;
  }

  // ─── Update ──────────────────────────────────────────────────────────
  static async update(id, fields) {
    const allowed = ['title', 'description', 'doc_type', 'doc_date', 'facility', 'doctor_name', 'tags', 'is_sensitive'];
    const updates = [];
    const params = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowed.includes(col)) {
        updates.push(`${col} = ?`);
        params.push(col === 'tags' ? JSON.stringify(val) : val);
      }
    }

    if (!updates.length) return this.findById(id);

    params.push(id);
    await query(`UPDATE medical_documents SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  // ─── Delete ──────────────────────────────────────────────────────────
  static async delete(id, patientId) {
    const result = await query(
      'DELETE FROM medical_documents WHERE id = ? AND patient_id = ?',
      [id, patientId]
    );
    return result.affectedRows > 0;
  }

  // ─── Stats ───────────────────────────────────────────────────────────
  static async getStatsByPatient(patientId) {
    return query(
      `SELECT doc_type, COUNT(*) AS count
       FROM medical_documents WHERE patient_id = ?
       GROUP BY doc_type ORDER BY count DESC`,
      [patientId]
    );
  }
}

module.exports = MedicalDocumentModel;
