# SmartDine Project Rules & Lessons Learned

The following rules are based on mistakes and issues encountered previously in this project. Review these carefully before implementing new features or making architectural changes.

## 1. React `useEffect` Dependencies (Avoid Infinite Loops)
**Mistake made:** Passing an entire object (`activeSession`) fetched from the API into a `useEffect` dependency array that managed a WebSocket connection. When the socket received an event, it triggered an API refetch, which returned a new object reference for `activeSession`, causing the `useEffect` to tear down and recreate the WebSocket connection in an infinite loop.
**Rule:** NEVER pass complex objects or arrays received from an API directly into a `useEffect` dependency array if they are subject to re-fetching. Always extract primitive values (e.g., `const sessionId = activeSession?._id;`) and use those primitives in the dependency array to ensure referential stability.

## 2. MongoDB `ObjectId` vs Strings
**Mistake made:** Relying on implicit string conversion of Mongoose `ObjectId`s when constructing dynamic strings for Redis keys or Socket.io room names (e.g., `` `table_room_${session._id}` ``). While template literals often implicitly call `.toString()`, this can lead to subtle bugs or mismatching strings when comparing IDs across different parts of the system (e.g., comparing an ID sent from the frontend vs the raw database object).
**Rule:** Always explicitly call `.toString()` on Mongoose `ObjectId`s when using them in template strings, storing them in Redis, or broadcasting via Socket.io. Example: `` `table_room_${session._id.toString()}` ``.

## 3. Atomic Redis Operations
**Rule:** When building shared state (like a shared cart) that multiple users can modify simultaneously, always use atomic Redis operations (like `HINCRBY` or distributed locks via `SETNX`) to avoid race conditions. Always ensure that any acquired lock is safely released inside a `finally` block to prevent deadlocks in case of unexpected errors.

## 4. Always Emit Socket Events for State-Changing REST Endpoints
**Mistake made:** The `joinTableWithCode` REST endpoint added a user to the session's `participants` array in MongoDB but never emitted a WebSocket event (`user_joined`) to the table room. This meant the host's (and other guests') dashboards were never notified that a new user joined, so the guest list and shared cart never refreshed in real-time for existing users.
**Rule:** Whenever a REST endpoint modifies shared state that other connected users need to know about (e.g., joining a table, adding/removing cart items, changing order status), ALWAYS emit a corresponding Socket.io event to the relevant room BEFORE returning the HTTP response. Use `req.app.get('io')` to access the io instance in controllers.

## 5. Never Use `.includes()` for Mongoose `ObjectId` Array Comparison
**Mistake made:** Used `session.participants.includes(userId)` to check if a user was already in the session. JavaScript's `.includes()` uses strict equality (`===`), which compares `ObjectId` objects by reference, not by value. Two `ObjectId`s with the same hex string are different object references, so the check silently fails.
**Rule:** Always use `.some(id => id.toString() === targetId.toString())` when checking if an `ObjectId` exists in a Mongoose array. Never use `.includes()`, `.indexOf()`, or `===` directly on `ObjectId` values.

## 6. Real-Time Feature Checklist
**Rule:** When building any feature that involves multiple users seeing the same data in real-time, always verify this 3-point checklist BEFORE considering the feature complete:
1. **Socket Room Membership**: Every user who needs updates must have emitted `join_table` (or equivalent) to join the correct socket room.
2. **REST → Socket Bridge**: Every REST endpoint that mutates shared state must emit the appropriate socket event to the room.
3. **Socket → UI Refresh**: The frontend socket listener must trigger a re-fetch or state update so the UI reflects the change.

## 7. Stale Sessions & `findOne` Ordering
**Mistake made:** During testing, multiple active (non-completed) `TableSession` documents accumulated in MongoDB because old sessions were never marked as `completed`. When `findOne()` was called without a sort, it returned the **oldest** matching session for the host — but the guest was only in the **newest** session. The two users ended up looking at different sessions' carts, so neither could see the other's items or participant list.
**Rule:** Always add `.sort({ createdAt: -1 })` to any `findOne()` query that looks for a user's active session. This guarantees the latest session is always selected. Additionally, when building session-based features, consider adding a cleanup mechanism or validating that old sessions are properly marked as `completed` before creating new ones.
