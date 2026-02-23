# OmniScope Messaging & Calling Architecture

## Current State Audit (Feb 23, 2026)

### Database Tables Analysis

#### ✅ Existing Tables
- `users` - Platform users with authentication
- `channels` - Communication channels (DMs, groups, announcements)
- `channel_members` - User membership in channels
- `messages` - Message content and metadata
- `calls` - Call records and history
- `contacts` - CRM contacts (external people, NOT platform users)

#### ❌ Missing/Incomplete
- No `username` field in users table (need for @mentions)
- No user directory/discovery mechanism
- No invitation system for adding users
- No WebSocket infrastructure for real-time sync
- Call signaling infrastructure incomplete

### Current Problems

1. **Zero Channel Memberships**: User has no channels because none have been created yet
2. **Contacts vs Users Confusion**: Dialogs were showing CRM contacts instead of platform users
3. **No User Discovery**: No way to find other users by @username or search
4. **No Real-time Sync**: Messages don't appear instantly across devices
5. **Desktop vs Mobile Data Mismatch**: Desktop might be showing test/mock data

---

## Proposed Architecture

### 1. User Identity & Discovery

#### Username System
```typescript
// Add to users table
username: varchar("username", { length: 50 }).unique().notNull()
displayName: varchar("displayName", { length: 100 })
bio: text("bio")
status: enum("status", ["online", "away", "busy", "offline"])
```

#### User Discovery Methods
1. **@mention autocomplete** - Type @ to search users by username/name
2. **User directory** - Browse all users in organization
3. **Invitation links** - Generate invite links to add external users
4. **Email invitation** - Send email invites with signup links

### 2. Channel Architecture

#### Channel Types
```typescript
type ChannelType = "dm" | "group" | "announcement" | "public";

// DM: 1-on-1 private conversation
// Group: Private multi-user chat
// Announcement: One-way broadcast channel
// Public: Open channel anyone can join
```

#### Channel Creation Flow
1. User selects "New DM" → searches for @username → creates/finds existing DM
2. User selects "New Group" → multi-select users → names group → creates channel
3. User selects "New Channel" → names channel → sets public/private → creates

### 3. Messaging System

#### Message Structure
```typescript
interface Message {
  id: number;
  channelId: number;
  senderId: number;
  content: string;
  mentions: number[]; // User IDs mentioned with @
  attachments?: string[]; // File URLs
  replyToId?: number; // Thread parent message
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

#### Real-time Sync Options
**Option A: WebSocket (Recommended)**
- Persistent connection for instant updates
- Server pushes new messages to all connected clients
- Requires WebSocket server setup

**Option B: Polling**
- Client requests updates every N seconds
- Simpler to implement but higher latency
- Good fallback if WebSocket fails

**Option C: Server-Sent Events (SSE)**
- One-way server → client updates
- Simpler than WebSocket
- Good for read-only real-time

### 4. Call Infrastructure

#### WebRTC Architecture
```
User A                    Signaling Server              User B
  |                              |                          |
  |--- createOffer() ----------->|                          |
  |                              |--- offer -------------->|
  |                              |<-- answer --------------|
  |<-- answer -------------------|                          |
  |                              |                          |
  |<=========== Direct P2P Connection ===================>|
```

#### Required Components
1. **Signaling Server** - Exchange SDP offers/answers
2. **STUN/TURN Server** - NAT traversal for P2P connection
3. **Call State Management** - Track active calls, participants
4. **Call UI** - Video/audio controls, mute, end call

---

## Implementation Plan

### Phase 1: User Identity & Discovery

#### Backend Tasks
- [ ] Add `username` column to users table (migration)
- [ ] Add tRPC procedure: `users.search` (by username/name/email)
- [ ] Add tRPC procedure: `users.checkUsernameAvailable`
- [ ] Add tRPC procedure: `users.updateProfile` (set username, bio, status)
- [ ] Add user directory page data loading

#### Frontend Tasks
- [ ] Add username setup flow (onboarding or settings)
- [ ] Build @mention autocomplete component
- [ ] Build user directory/search page
- [ ] Add "Add User" flow with @username search

### Phase 2: Fix Channel Creation & Sync

#### Backend Tasks
- [ ] Verify `createDM` procedure works with actual user IDs
- [ ] Add `findOrCreateDM` helper (don't create duplicates)
- [ ] Add `createGroupChat` validation (min 2 members)
- [ ] Add `listChannels` optimization (include last message, unread count)
- [ ] Add `getChannelMessages` with pagination

#### Frontend Tasks
- [ ] Fix mobile New DM dialog to use users.list ✅ (DONE)
- [ ] Fix mobile New Group dialog to use users.list ✅ (DONE)
- [ ] Test DM creation from mobile → verify appears on desktop
- [ ] Test message send from mobile → verify appears on desktop

### Phase 3: Real-time Sync

#### Backend Tasks
- [ ] Set up WebSocket server (Socket.io or native WS)
- [ ] Add WebSocket authentication middleware
- [ ] Implement message broadcast on new message
- [ ] Implement typing indicators
- [ ] Implement online/offline status

#### Frontend Tasks
- [ ] Add WebSocket client connection
- [ ] Subscribe to channel updates
- [ ] Update UI on new message received
- [ ] Show typing indicators
- [ ] Show online/offline status

### Phase 4: Call Infrastructure

#### Backend Tasks
- [ ] Set up WebRTC signaling server
- [ ] Add tRPC procedures: `calls.createOffer`, `calls.createAnswer`
- [ ] Add call state management (active calls table)
- [ ] Integrate STUN/TURN server

#### Frontend Tasks
- [ ] Build call UI component (video/audio controls)
- [ ] Implement WebRTC peer connection
- [ ] Add call notification system
- [ ] Add call history view

---

## Immediate Next Steps (Priority Order)

1. **Add username to users table** - Foundation for @mentions
2. **Create seed data** - Add test users and channels so there's something to see
3. **Fix channel list loading** - Ensure both mobile and desktop load same data
4. **Test DM creation** - Verify end-to-end flow works
5. **Add WebSocket for real-time** - Make messages appear instantly

---

## Questions to Answer

1. **User Onboarding**: Should username be required during signup or optional?
2. **User Discovery**: Should all users be visible to each other, or only within same organization?
3. **Invitations**: Email-based invites or just @username search?
4. **Real-time**: WebSocket (complex but best UX) or Polling (simple but higher latency)?
5. **Calls**: WebRTC P2P (better quality) or server-mediated (easier to implement)?

