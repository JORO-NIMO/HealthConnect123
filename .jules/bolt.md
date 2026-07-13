# Bolt's Optimization Journal

## 2026-07-13 - [Batching Doctor Hospital Affiliations]
**Learning:** Found N+1 database querying pattern in nearby doctors and doctor recommendation API endpoints where each doctor's hospital affiliation was queried individually inside a sequential loop, significantly degrading API latency.
**Action:** Created `HospitalModel.getDoctorsHospitals(doctorIds)` to fetch all mappings in a single batched SQL query and avoid sequential database calls.
