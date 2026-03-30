# Product Requirements Document (PRD): NeighborSwap

## 1. Executive Summary
NeighborSwap is a production-grade, local-first platform designed to facilitate the safe lending of tools and resources within any local neighborhood. Inspired by the transactional flow of Xianyu (闲鱼), the application moves beyond simple chat by integrating a State-Machine Transaction Engine and Parallel Agentic AI. The project addresses the "trust gap" in peer-to-peer sharing by using the Groq AI API to power real-time safety monitoring and "Smart Suggestions" for logistics, ensuring a secure and documented exchange process for all users.

## 2. User Personas
* **The Provider:** A neighbor looking to lend specialized equipment (e.g., a power drill, camping gear, or kitchen appliances) with a clear, documented record of the transaction.
* **The Borrower:** A local resident needing a short-term resource who requires a secure, "scam-free" communication channel and help identifying neutral public meeting spots.

## 3. Technical Stack & Architecture
* **Frontend/Backend:** Next.js 15+ (App Router), TypeScript, Tailwind CSS.
* **Real-time:** Socket.io for live chat and status updates.
* **Database & Auth:** Supabase (PostgreSQL) for relational data and user management.
* **AI Inference:** Groq Cloud API (Llama 3.3-70b / Llama-3 API) for sub-second agentic processing.
* **Monitoring:** Sentry (Error tracking), BetterStack (Uptime).

## 4. Core Features & User Stories

### A. Inquiry-to-Transaction Chat Flow
* **User Story:** As a User, I want an Inquiry-to-Transaction chat flow where I can discuss details before clicking "Request Swap" to lock in a digital contract.
* **User Story:** As a User, I want Transaction Status Triggers (Requested -> Picked Up -> In Use -> Returned) so the location and responsibility of the item are always documented.

### B. Parallel AI Agents
* **User Story:** As a User, I want a Safety Agent to run in parallel with the chat to automatically redact PII (SSNs, private addresses) and flag suspicious links using the Groq Llama-3 API.
* **User Story:** As a User, I want a Logistics Agent to offer a "Smart Suggestion" button that analyzes our conversation and suggests neutral public meeting points (e.g., local libraries, cafes, or parks) to avoid sharing home addresses.

*(Additional feature from original PRD)*
* **Vibe/Sentiment Agent:** Analyzes the helpfulness of the interaction to update the user's public "Trust Score."

### C. Evaluation System (LLM-as-Judge)
* **User Story:** As a Developer, I want an Evaluation Dashboard using an LLM-as-judge to measure the accuracy of the Safety Agent’s flags against a test dataset of "scam" vs. "safe" messages.

## 5. Security & Privacy
* **Local-First Logic:** AI processing focuses on high-speed inference via Groq to avoid long-term data retention of private chats.
* **Secrets Management:** All API keys (Groq, Supabase) are managed via Vercel Environment Variables.
* **Input Sanitization:** All chat inputs are sanitized to prevent XSS.

## 6. Success Metrics
* **Latency:** Chat message delivery < 200ms.
* **Agent Speed:** AI flagging/suggestions < 800ms (achieved via Groq LPUs).
* **AI Metric:** Target >95% accuracy for PII detection in the Evaluation test dataset.
* **Deployment:** 100% uptime on Vercel with functioning CI/CD.