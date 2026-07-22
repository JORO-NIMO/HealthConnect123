# Bolt's Optimization Journal

## 2026-07-13 - [Batching Doctor Hospital Affiliations]
**Learning:** Found N+1 database querying pattern in nearby doctors and doctor recommendation API endpoints where each doctor's hospital affiliation was queried individually inside a sequential loop, significantly degrading API latency.
**Action:** Created `HospitalModel.getDoctorsHospitals(doctorIds)` to fetch all mappings in a single batched SQL query and avoid sequential database calls.

## 2026-07-14 - [Batching Doctor Verification Documents]
**Learning:** Identified another critical N+1 database querying pattern in the admin pending doctor verification dashboard (`getPendingDoctors` endpoint). The controller queried the database individually for each pending doctor inside a `Promise.all` mapping to fetch verification documents, resulting in substantial database round-trip overhead.
**Action:** Created `DoctorVerificationDocumentModel.getDoctorsVerificationDocuments(doctorIds)` to retrieve all verification documents for a batch of doctor IDs in a single SQL query, reducing the overhead from $O(N)$ sequential queries to $O(1)$.

## 2026-07-15 - [Batching Emergency SOS Dispatches]
**Learning:** Found N+1 parallel database queries in active emergency/hospital SOS queue dashboards (`getActiveEmergencies` and `getHospitalSOSQueue` endpoints). The controller mapped active hospital IDs with separate asynchronous database lookups to load active SOS dispatches for each hospital individually, multiplying database round-trips for responders with multiple affiliations.
**Action:** Created `EmergencyModel.listActiveSOSForHospitals(hospitalIds)` to retrieve all active emergency dispatches for a batch of hospital IDs in a single query, reducing DB overhead and accelerating response UI load.

## 2026-07-17 - [Batching Symptom Report Conditions]
**Learning:** Found a sequential querying pattern in the AI symptom checker report creation (`SymptomReportModel.create`). When parsing AI possible conditions, the model performed sequential insert statements in a sequential loop, multiplying the database roundtrip overhead for each identified medical condition.
**Action:** Optimized `SymptomReportModel.create` to construct and execute a single, batched SQL `INSERT` statement for all identified possible conditions, reducing $O(N)$ database roundtrips to $O(1)$ and significantly reducing response latency on the critical path of symptom checker completion.

## 2026-07-21 - [Batching Prescription Medication Line Items]
**Learning:** Found N+1 sequential database insert queries in `PrescriptionModel.create`. When creating a prescription with multiple medications, each line item was inserted into `prescription_items` individually inside a sequential `for...of` loop, degrading consultation and prescription creation performance.
**Action:** Optimized `PrescriptionModel.create` to generate all placeholders and insert all medication line items in a single bulk SQL statement, reducing the database overhead on the prescription creation critical path from $O(N)$ sequential queries to $O(1)$.
