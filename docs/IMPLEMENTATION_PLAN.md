# NeighborSwap Implementation Plan

This document outlines the implementation plan for NeighborSwap, structured into three primary sprints based on the PRD. Each sprint defines a concrete milestone and contains exactly five actionable tasks.

## Sprint 1: Foundation & Marketplace
**Milestone 1:** A functional marketplace where users can authenticate, browse items, and post their own listings.

1. **Project & Database Setup**: Initialize the Next.js 15+ (App Router) project and configure Supabase (PostgreSQL) for relational data and user management. Create schemas for `Users`, `Items`, and `Trades`.
2. **Authentication Integration**: Implement user sign-up and login flows, ensuring distinct user personas (Provider and Borrower) can access their respective views.
3. **Item Listing Feature**: Build the "Post an Item" flow allowing Providers to upload photos, descriptions, and define "Borrowing Rules" (e.g., "Return by" date).
4. **Marketplace UI**: Develop the main marketplace feed to display available items in the local neighborhood, including filtering and search capabilities.
5. **Item Details View**: Create the individual item detail page with a clear "Request Swap" mechanism to initiate the transaction flow.

---

## Sprint 2: Transactional Chat & State Machine
**Milestone 2:** Users can securely communicate and progress a transaction through its lifecycle using real-time status triggers.

1. **Real-Time Infrastructure Setup**: Integrate Socket.io on the backend and frontend to support real-time messaging and live UI state updates.
2. **Inquiry-to-Transaction Chat UI**: Build the chat interface that connects directly to a specific item request ("Xianyu-inspired" flow), displaying message history securely.
3. **Transaction State Machine Logic**: Implement the core state machine constraints in the database and API (`INQUIRY` → `REQUESTED` → `PICKED_UP` → `RETURNED`).
4. **Interactive Status Triggers**: Add interactive buttons to the chat UI (e.g., "Confirm Pickup") that users can click to execute state transitions and document possession.
5. **Contract Locking Logic**: Develop the logic that "locks in" a digital contract when "Request Swap" is accepted, restricting state changes only to involved parties.

---

## Sprint 3: Parallel AI Agents & Evaluation
**Milestone 3:** The chat experience is automatically moderated and enhanced by parallel Groq Cloud AI agents, with an evaluation dashboard to monitor performance.

1. **Agent Architecture & Groq Setup**: Securely manage Groq API keys via Vercel Environment Variables and implement the parallel sub-second agent processing pipeline.
2. **Safety Agent Implementation**: Develop the AI agent that automatically scans messages to redact PII (SSNs, private addresses) and flag potential phishing links.
3. **Logistics Agent Implementation**: Create the agent that analyzes the conversation context and injects a "Smart Suggestion" button proposing neutral public meeting points (e.g., local libraries).
4. **Trust Score (Vibe/Sentiment) Agent**: Implement the sentiment analysis agent that processes interaction helpfulness to update the user's public "Trust Score" asynchronously.
5. **LLM-as-Judge Evaluation Dashboard**: Build a Developer dashboard that executes the "Judge" script against a Golden Dataset of 50+ test conversations to verify the Safety Agent meets the >95% PII detection accuracy target. 
