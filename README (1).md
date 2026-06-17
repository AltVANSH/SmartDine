# 🍽️ SmartDine | High-Performance Distributed Dining Engine

**SmartDine** is a full-stack distributed web application designed to digitize and automate the dine-in restaurant experience. It moves beyond basic CRUD functionality to solve complex hospitality bottlenecks—such as manual bill splitting, waiter fatigue, and inventory overselling—using FAANG-caliber engineering patterns.

---

## 🏗️ The Architecture & Tech Stack

The system is designed for high concurrency, real-time synchronization, and data integrity.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React.js (Vite) + Tailwind CSS | Mobile-first UI for diners; Tablet-optimized for KDS. |
| **State** | Zustand / Redux | Management of local UI state and cart transitions. |
| **Backend** | Node.js + Express.js | Core API, business logic, and routing. |
| **Primary DB** | MongoDB + Mongoose | Persistent storage for users, menus, and configurations. |
| **Cache/Locks** | Upstash Redis | Distributed locks, shared table sessions, and atomicity. |
| **Real-Time** | Socket.io | Live queueing and kitchen state machine updates. |
| **Workers** | BullMQ | Background jobs, service routing, and ticket escalation. |

---

## 🚀 Core Engineering Features

### 1. Shared Table Cart & Atomic Splitting
* **The Problem:** Multiple diners at one table adding/removing items simultaneously.
* **The Solution:** Leverages **Redis** to handle simultaneous writes to shared carts. This prevents race conditions and enables complex "Split Evenly" or "Pay for My Items" financial logic at checkout.

### 2. Atomic Inventory Reservation ("The Last Item Lock")
* **The Problem:** Preventing "overselling" when two tables order the last portion of a dish at the same millisecond.
* **The Solution:** Implements **Redis Distributed Locks (Redlock)** to temporarily reserve stock. If the transaction isn't finalized, the lock expires and the item returns to the pool.

### 3. Live Kitchen Tracking (State Machine)
* **The Problem:** Keeping diners informed without manual page refreshes.
* **The Solution:** A backend **State Machine** pattern integrated with **WebSockets**. As chefs update order status (Received → Preparing → Ready), the diner's UI updates in real-time.

### 4. Smart Service Routing & Escalation Queue
* **The Problem:** Requests like "Need Water" getting lost during rush hours.
* **The Solution:** Uses **BullMQ (Priority Queues)**. Requests are routed to specific waiters; if not resolved within 3 minutes, a background worker escalates the ticket to the floor manager.

### 5. Context-Aware Upselling Engine
* **The Problem:** Missing impulse-buy opportunities.
* **The Solution:** Real-time pattern matching against the shared cart. Detecting specific combinations (e.g., "4 Beers + 0 Fries") triggers a 60-second countdown deal on all connected table devices.

---

