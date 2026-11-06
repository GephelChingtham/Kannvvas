# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **5-Booking Capacity Cap**: Only 5 booking slots exist (`slot-1`, `slot-2`, `slot-3`, `slot-4`, `slot-5`). Every document ID in `/slots/{slotId}` and `/bookings/{slotId}` MUST match `^slot-[1-5]$`. Any attempt to create a 6th slot (`slot-6` or arbitrary ID) is rejected at the path variable level.
2. **Atomic Slot + Booking Sync (Pillar 7)**:
   - Creating `/slots/{slotId}` requires `existsAfter(/databases/$(database)/documents/bookings/$(slotId))`.
   - Creating `/bookings/{slotId}` requires `existsAfter(/databases/$(database)/documents/slots/$(slotId))`.
   - Deleting `/slots/{slotId}` or `/bookings/{slotId}` requires `!existsAfter(...)` on the paired document so freeing a slot is always atomic.
3. **PII Isolation (Pillar 6)**:
   - `/slots/{slotId}` contains zero PII (`slotId`, `occupied`, `clientId`, `updatedAt`) so slot occupancy (`0/5` to `5/5`) can be read without leaking client PII.
   - `/bookings/{slotId}` contains client PII (`budget`, `phoneNumber`, `email`, `name`, `notes`, `itemsSummary`, `cartTotal`) and is strictly readable only by `isAdmin()` or the document's verified creator (`resource.data.clientId == request.auth.uid`).
4. **Verified Identity & Temporal Integrity**:
   - All writes require `isSignedIn() && request.auth.token.email_verified == true`.
   - `clientId` on creation MUST equal `request.auth.uid`.
   - `createdAt` and `updatedAt` MUST equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **6th Slot Injection (`slot-6`)**: Writing to `/bookings/slot-6` -> `PERMISSION_DENIED` (fails `isValidSlotId`).
2. **Orphaned Booking Write**: Creating `/bookings/slot-1` without creating `/slots/slot-1` in the same batch -> `PERMISSION_DENIED` (fails `existsAfter`).
3. **Orphaned Slot Write**: Creating `/slots/slot-1` without creating `/bookings/slot-1` in the same batch -> `PERMISSION_DENIED` (fails `existsAfter`).
4. **Identity Spoofing**: Creating `/bookings/slot-1` with `clientId: "other-user-uid"` -> `PERMISSION_DENIED`.
5. **Unverified Email Spoof**: Request with `email: "gephelchingtham08@gmail.com"` and `email_verified: false` attempting admin read/delete -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Creating `/bookings/slot-1` with extra field `isAdmin: true` -> `PERMISSION_DENIED` (fails `hasOnly`).
7. **PII Blanket Read**: Authenticated non-admin user reading `/bookings/slot-1` owned by someone else -> `PERMISSION_DENIED`.
8. **Timestamp Forgery**: Creating `/bookings/slot-1` with past or future `createdAt` != `request.time` -> `PERMISSION_DENIED`.
9. **Payload Overflow (Denial of Wallet)**: Creating `/bookings/slot-1` with `notes` > 1500 chars -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Reading `/admins/` with a 500-char junk ID -> `PERMISSION_DENIED` (fails `isValidId`).
11. **Privilege Escalation**: Non-admin user writing to `/admins/{uid}` -> `PERMISSION_DENIED`.
12. **Immutable Field Mutation**: Updating `clientId` or `createdAt` on `/bookings/slot-1` -> `PERMISSION_DENIED`.
