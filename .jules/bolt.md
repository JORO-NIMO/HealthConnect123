# Bolt's Optimization Journal

## 2026-07-13 - [Batching Doctor Hospital Affiliations]
**Learning:** Found N+1 database querying pattern in nearby doctors and doctor recommendation API endpoints where each doctor's hospital affiliation was queried individually inside a sequential loop, significantly degrading API latency.
**Action:** Created `HospitalModel.getDoctorsHospitals(doctorIds)` to fetch all mappings in a single batched SQL query and avoid sequential database calls.

## 2026-07-14 - [Batching Doctor Verification Documents]
**Learning:** Identified another critical N+1 database querying pattern in the admin pending doctor verification dashboard (`getPendingDoctors` endpoint). The controller queried the database individually for each pending doctor inside a `Promise.all` mapping to fetch verification documents, resulting in substantial database round-trip overhead.
**Action:** Created `DoctorVerificationDocumentModel.getDoctorsVerificationDocuments(doctorIds)` to retrieve all verification documents for a batch of doctor IDs in a single SQL query, reducing the overhead from $O(N)$ sequential queries to $O(1)$.
