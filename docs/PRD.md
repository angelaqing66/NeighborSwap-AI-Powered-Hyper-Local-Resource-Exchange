Product Requirements Document (PRD): NeighborSwap
1. Executive Summary
NeighborSwap is a hyper-local, "Xianyu-inspired" resource exchange platform. It enables neighbors to lend and borrow items (tools, appliances, gear) through a secure, state-managed chat interface. The platform uses Parallel AI Agents to automate safety, logistics, and trust-building without requiring manual moderation.

2. Technical Stack & Architecture
Frontend/Backend: Next.js 15+ (App Router), TypeScript, Tailwind CSS.

Real-time: Socket.io for live chat and status updates.

Database & Auth: Supabase (PostgreSQL) for relational data and user management.

AI Inference: Groq Cloud API (Llama 3.3-70b) for sub-second agentic processing.

Monitoring: Sentry (Error tracking), BetterStack (Uptime).

3. Core Features & User Stories
A. Item Marketplace (The "Listing" Flow)
Users can post items with photos, descriptions, and "Borrowing Rules."

User Story: As a Provider, I want to set a "Return by" date so that the borrower knows the timeline.

B. Transactional Chat (The "Xianyu" Flow)
Chat is linked to a specific item request.

Status Triggers: The UI displays buttons that change the database state:

INQUIRY → REQUESTED → PICKED_UP → RETURNED.

User Story: As a User, I want to click "Confirm Pickup" so that the platform knows the item is currently in my possession.

C. Parallel AI Agents
When a message is sent, three agents run in parallel:

Safety Agent: Redacts PII (Social Security Numbers, Credit Cards) and flags phishing links.

Logistics Agent: Provides a "Smart Suggestion" button that identifies neutral public meeting spots (Libraries, Parks, Cafes).

Vibe/Sentiment Agent: Analyzes the helpfulness of the interaction to update the user's public "Trust Score."

4. AI Evaluation System (LLM-as-Judge)
Objective: Ensure the Safety Agent doesn't have "False Negatives" (missing a scam).

Process: A separate "Judge" script compares the Agent's flags against a "Golden Dataset" of 50+ test conversations.

Metric: Target >95% accuracy for PII detection.

5. Security & Privacy
Local-First Logic: AI processing focuses on high-speed inference via Groq to avoid long-term data retention of private chats.

Secrets Management: All API keys (Groq, Supabase) are managed via Vercel Environment Variables.

Input Sanitization: All chat inputs are sanitized to prevent XSS.

6. Success Metrics for Project 3
Latency: Chat message delivery < 200ms.

Agent Speed: AI flagging/suggestions < 800ms (achieved via Groq LPUs).

Deployment: 100% uptime on Vercel with functioning CI/CD.