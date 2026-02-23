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
