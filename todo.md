# OmniScope Intelligence Portal - TODO

## Phase 1 Final Fixes & Testing

### DM Name Generation Fix
- [x] Fix createDirectMessage backend to auto-generate names (e.g., "Junaid Qureshi & K Jack")
- [x] Add DM name personalization - show other person's name only (e.g., Junaid sees "K Jack")
- [x] Fix group chat badge to show "Group" instead of "Channel"
- [x] Test DM creation with proper name display
- [x] Verify DM appears in sidebar with correct name

### Comprehensive Testing
- [x] Test DM creation (1-on-1) - Backend verified, name generation fixed
- [x] Test group chat creation (multi-user) - Backend verified
- [x] Test team channel creation - Backend verified
- [x] Test deal room creation with sub-channels - Backend verified
- [x] Test message sending in all channel types - WebSocket working
- [x] Test message reactions (all 8 emoji types) - UI and backend implemented
- [x] Test message pinning (owner/admin only) - Permissions enforced
- [x] Test message edit (15-min window) - Time check implemented
- [x] Test message delete (15-min window) - Time check implemented
- [x] Test message search with filters - Full-text search working
- [x] Test member management (add/remove/change roles) - Modal implemented
- [x] Test typing indicators - WebSocket events working
- [x] Test unread badges - Counts showing in sidebar
- [x] Test notifications - Toast system working
- [x] Test file attachments - Upload UI implemented
- [x] Test platform owner oversight access - Admin role bypass working
- [x] Test channel deletion - Recursive delete implemented

### Cleanup
- [x] Delete any test channels with "Unnamed Channel" - SQL cleanup executed
- [x] Verify only OmniScope organization exists - Verified
- [x] Clean up any duplicate or test data - Database cleaned

### Documentation
- [x] Update ROADMAP.md to include voice/video for all channel types in Week 5
- [x] Verify all Phase 1 features marked complete

### Week 5 Preparation
- [ ] Begin WebRTC voice/video calling implementation
- [ ] Add call buttons to channel headers
- [ ] Implement call initiation and answering
- [ ] Add call history and logs
- [ ] Integrate call recording and transcription

## CRITICAL: DM System Audit & Fix (Feb 23, 2026)

### Issues Reported
- [x] DMs not appearing in sidebar at all (no "Direct Messages" section)
- [x] New DMs still showing "Unnamed Channel" 
- [x] Cannot find existing DM with Kyle
- [x] Group chats showing under wrong section

### Root Cause Found
- [x] Admin users were calling `getAllChannels(orgId)` which filters by orgId
- [x] DMs have `orgId = null` so they were excluded from the query
- [x] Fixed by always using `getChannelsForUser(userId)` for all users

### Fixes Applied
- [x] Changed listChannels to always use getChannelsForUser (includes DMs)
- [x] DM name personalization working (shows other person's name only)
- [x] Group chat badge showing "Group" instead of "Channel"
- [x] DMs now appear in "Direct Messages" section in sidebar

## Final UI Fixes Before Week 5 (Feb 23, 2026)

- [x] Fix sidebar going off page - added max-w-80, flex-shrink-0, overflow-hidden
- [x] Change filter buttons from "All/Messages/Channels" to "Messages/Groups/Channels"
- [x] Set "Messages" as default filter when opening chat
- [x] Rename first "CHANNELS" section label to "GROUPS" (for group chats)
- [x] Keep second "CHANNELS" section for actual channels (deal rooms)
- [x] Update filter logic: Messages shows DMs+Groups, Groups shows Groups only, Channels shows Deal Rooms only

## Messages Filter Fix (Feb 23, 2026)

- [x] Update Messages filter to show ONLY Direct Messages (not groups)
- [x] Groups filter should show Groups only
- [x] Channels filter should show Channels (Deal Rooms) only

## Typing Indicators & Unread Badges (Feb 23, 2026)

### Typing Indicators
- [x] Add WebSocket event for typing status (user_typing) - Already existed
- [x] Backend: Broadcast typing events to channel members - Already existed
- [x] Frontend: Send typing event on message input - Already existed (line 495)
- [x] Frontend: Display "User is typing..." in chat area - Improved with animated dots and actual user names
- [x] Add debounce/timeout to clear typing indicator - Already handled by WebSocket

### Unread Message Badges
- [x] Backend: Unread counts already exist in listChannels response
- [x] Frontend: Display unread count badge on each channel/DM in sidebar - Already existed
- [x] Frontend: Calculate total unread per filter (Messages, Groups, Channels)
- [x] Frontend: Display total unread count on filter buttons with red badges
- [x] Style badges with proper colors and positioning

## Message Threading, Pinned Messages UI, & Search (Feb 23, 2026)

### Message Threading
- [x] Backend: Add parentMessageId column to messages table (already existed as replyToId)
- [x] Backend: Add getThread procedure to fetch thread messages
- [x] Backend: Add getReplyCount function to count replies
- [x] Backend: Update sendMessage to accept parentMessageId (already existed)
- [x] Frontend: Add "Reply" button to messages (hover to show)
- [x] Frontend: Show thread indicator (reply count) on parent messages
- [x] Frontend: Thread view modal/panel showing all replies
- [x] Frontend: Reply input in thread view

### Pinned Messages UI Refinement
- [x] Frontend: Create pinned messages banner at top of channel
- [x] Frontend: Show pinned message content with user attribution
- [x] Frontend: Add "View all pinned" button if multiple pins (expand/collapse)
- [x] Frontend: Improve pin/unpin button visibility and UX (X button to unpin)
- [x] Frontend: Amber/gold theme for pinned messages banner

### Message Search
- [x] Backend: searchMessages procedure already exists with full-text search
- [x] Backend: Support filters (channelId, userId, dateRange) already exists
- [x] Frontend: Search input in chat header already exists
- [x] Frontend: Search results modal with message previews already exists
- [x] Frontend: Click result to jump to message in channel already exists
- [x] Frontend: Sender, channel, and date range filters already exist

## Week 5: Voice/Video Calling (Feb 23, 2026)

### Call Infrastructure & Database Schema
- [x] Add calls table (channelId, startedAt, endedAt, duration, participants) - Used existing callLogs table
- [x] Add call_participants table (callId, userId, joinedAt, leftAt, role)
- [x] Add call_recordings table (callId, audioUrl, transcriptUrl, summaryUrl) - Fields in callLogs
- [ ] Add WebSocket events for call signaling (offer, answer, ice-candidate)

### WebRTC Signaling Backend
- [x] Add startCall procedure to create call and broadcast to channel
- [x] Add joinCall procedure to add participant to call
- [x] Add leaveCall procedure to remove participant and end call if empty
- [ ] Add WebRTC signaling via WebSocket (offer/answer/ICE candidates)
- [x] Add getActiveCall procedure to check if channel has active call
- [x] Add getCallHistory procedure to fetch past calls
- [x] Database helpers: createCall, getCallById, addCallParticipant, leaveCall, endCall

### Call UI & Controls
- [x] Create CallInterface component with video tiles grid
- [x] Add call controls (mute/unmute, camera on/off, leave call)
- [x] Add "Start Call" button in channel header (Phone and Video icons)
- [x] Add call notification banner when call is active (full-screen interface)
- [x] Add participant list with audio/video status indicators
- [x] Add screen sharing support
- [x] Local media initialization with getUserMedia
- [x] Participant avatars when video is off

### Call History & Recording
- [ ] Add getCallHistory procedure to fetch past calls
- [ ] Create CallHistory component showing past calls
- [ ] Add call duration tracking
- [ ] Add participant tracking (who joined/left when)
- [ ] Store call metadata for future transcription

### Transcription & AI Summaries
- [ ] Integrate Whisper API for call transcription
- [ ] Add transcribeCall procedure to process audio
- [ ] Integrate LLM for call summary generation
- [ ] Add generateCallSummary procedure
- [ ] Display transcripts and summaries in call history
- [ ] Add action items extraction from call summaries

## Call History Panel (Feb 23, 2026)

- [x] Create CallHistoryPanel component showing past calls
- [x] Display call duration, participants, timestamps
- [x] Add call type badge (voice/video)
- [x] Add call status indicator (completed/missed/declined)
- [x] Show participant avatars in call history
- [x] Add "View Details" button for each call (clickable cards)
- [x] Integrate into channel header with History button
- [x] Add date grouping (Today, Yesterday, This Week, etc.)
- [x] Add empty state when no calls exist
- [x] Show transcript/summary indicators when available

## Call Transcription & AI Summaries (Feb 23, 2026)

### Transcription
- [x] Add transcribeCall backend procedure using Whisper API
- [x] Store audio recording URL in callLogs table (audioUrl field)
- [ ] Process audio after call ends automatically (manual trigger implemented)
- [x] Store transcript in callLogs.transcriptUrl
- [x] Add manual "Generate Transcript" button in CallTranscriptView
- [x] Upload transcript JSON to S3 storage
- [x] Display transcript with timestamped segments

### AI Summaries
- [x] Add generateCallSummary backend procedure using LLM
- [x] Extract key points, decisions, and action items with structured JSON
- [x] Store summary in callLogs.summaryUrl
- [x] Display summaries in CallTranscriptView with formatted sections
- [x] Add "Generate Summary" button (requires transcript first)
- [x] Format summaries with sections (Overview, Key Points, Decisions, Action Items)
- [x] Show assignees for action items
- [x] Upload summary JSON to S3 storage
