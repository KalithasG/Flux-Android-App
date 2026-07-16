# Security Specification - Flux App

## Data Invariants
1. A user can only access their own data (User profile, Transactions, Budgets, Categories).
2. Transactions must have a valid type (`income` or `expense`).
3. Transactions, Budgets, and Categories must be attributed to the correct user ID.
4. Timestamps must be server-generated.
5. `savingsCategoryIds` must be an array of strings.
6. `savingsPlan` must be a map.

## The "Dirty Dozen" Payloads (Attack Vectors)

1. **Identity Theft (Profile)**: Attempt to update another user's profile.
   - Target: `/users/victim_uid`
   - Payload: `{ "displayName": "Attacker" }`
   - Actor: `attacker_uid`

2. **Shadow Field Injection**: Adding an `isAdmin` field to the user profile.
   - Target: `/users/attacker_uid`
   - Payload: `{ "isAdmin": true, "uid": "attacker_uid", "email": "attacker@example.com" }`

3. **Transaction Spoofing**: Creating a transaction for another user.
   - Target: `/users/victim_uid/transactions/new_id`
   - Payload: `{ "authorUid": "victim_uid", "title": "Steal", "amount": 1000 }`
   - Actor: `attacker_uid`

4. **Negative Expense**: Creating an expense with a negative amount.
   - Target: `/users/attacker_uid/transactions/new_id`
   - Payload: `{ "authorUid": "attacker_uid", "title": "Refund", "amount": -1000, "type": "expense" }`

5. **Type Poisoning**: Transaction with invalid type.
   - Target: `/users/attacker_uid/transactions/new_id`
   - Payload: `{ "authorUid": "attacker_uid", "type": "magic" }`

6. **Long String Attack**: Injecting a 1MB string into the transaction title.
   - Target: `/users/attacker_uid/transactions/new_id`
   - Payload: `{ "title": "A".repeat(1024 * 1024) }`

7. **Budget Month Poisoning**: Invalid month format.
   - Target: `/users/attacker_uid/budgets/new_id`
   - Payload: `{ "month": "forever", "amount": 100 }`

8. **Category Icon Poisoning**: Setting a 1KB emoji string as an icon.
   - Target: `/users/attacker_uid/categories/new_id`
   - Payload: `{ "icon": "🔥".repeat(500) }`

9. **Self-Assigned Admin**: Trying to write into an `/admins/` collection (if it existed, we deny all by default).
   - Target: `/admins/attacker_uid`
   - Payload: `{ "role": "admin" }`

10. **Orphaned Budget**: Creating a budget for a non-existent category (though we don't have hard relational checks for all IDs, we can check basic validity).

11. **Timestamp Manipulation**: Sending a client-side `createdAt` timestamp.
    - Target: `/users/attacker_uid/transactions/id`
    - Payload: `{ "createdAt": "2000-01-01T00:00:00Z" }`

12. **Savings Plan Chaos**: Injecting invalid keys into `savingsPlan`.
    - Target: `/users/attacker_uid`
    - Payload: `{ "savingsPlan": { "invalid-key": "not-a-number" } }`

## Test Definitions (Logic Gates)
- `isOwner(userId)`: `request.auth.uid == userId`
- `isValidTransaction()`: Checks title length, positive amount, enum type.
- `isValidBudget()`: Checks month pattern, positive amount.
- `isValidCategory()`: Checks name length, icon length.
- `isValidUser()`: Checks allowed fields in profile.
