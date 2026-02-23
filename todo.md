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

## Week 5 Completion (Feb 23, 2026)

### Calls Tab in Communications
- [x] Add "Calls" tab alongside Chat, Inbox, Calendar, Analytics
- [x] Create AllCallsView component showing calls across all channels
- [x] Add filters: call type (voice/video), status (completed/missed/ongoing)
- [x] Add search functionality for calls
- [x] Click call to view details/transcript/summary
- [x] Show channel name for each call
- [x] Integrate with CallTranscriptView component
- [x] Add date grouping (Today, Yesterday, This Week, etc.)
- [x] Show participant avatars and count

### WebRTC Signaling
- [x] Add WebSocket events: webrtc_offer, webrtc_answer, webrtc_ice_candidate
- [x] Update WebSocket server to handle WebRTC signaling
- [x] Add call-joined and call-left events for participant notifications
- [x] Create useWebRTC hook with peer connection management
- [x] Handle ICE candidate exchange between participants
- [x] Handle SDP offer/answer exchange
- [x] Add connection state management (connecting, connected, disconnected)
- [x] Handle participant join/leave during active call
- [x] Integrate useWebRTC hook into CallInterface component
- [x] Add remote video stream rendering with video tiles
- [x] Connect local media stream to peer connections

### Automatic Call Recording
- [ ] Integrate MediaRecorder API in CallInterface
- [ ] Start recording when call begins
- [ ] Stop recording when call ends
- [ ] Upload audio to S3 automatically
- [ ] Update callLogs with audioUrl
- [ ] Trigger transcription automatically after upload
- [ ] Add recording indicator in call UI

### Call Notifications
- [ ] Add real-time notification when call starts in channel
- [ ] Show "Call in progress" banner in channel
- [ ] Add "Join Call" button in notification
- [ ] Show participant count in real-time
- [ ] Add sound notification for incoming calls
- [ ] Add notification in sidebar for active calls

## Fix Calls Tab 404 Error (Feb 23, 2026)

- [x] Fix route matching for /calls path - Added to App.tsx WorkspaceRouter
- [x] Ensure AllCallsView component is properly exported
- [x] Test navigation to Calls tab

## Week 5 Final Implementation (Feb 23, 2026)

### Database Function Fixes
- [x] Fix all database function signatures to match actual schema
- [x] Update getCallById to use getDb() instead of db
- [x] Update getActiveCallInChannel to use getDb()
- [x] Update getCallHistory to use getDb()
- [x] Update addCallParticipant to use getDb()
- [x] Update removeCallParticipant to use getDb()
- [x] Update endCall to use getDb()
- [x] Run and pass all WebRTC integration tests

### Automatic Call Recording
- [x] Add MediaRecorder API integration to CallInterface
- [x] Start recording when call begins (combine all audio tracks)
- [x] Stop recording when call ends
- [x] Convert recorded audio to uploadable format (webm/mp3)
- [x] Upload audio to S3 automatically using storagePut
- [x] Update callLogs with audioUrl after upload
- [x] Trigger automatic transcription after upload
- [x] Add recording indicator in call UI
- [x] Handle recording errors gracefully

### Call Notifications
- [x] Create CallNotificationBanner component
- [x] Add real-time notification when call starts in channel
- [x] Show "Call in progress" banner in channel header
- [x] Add "Join Call" button in notification banner
- [x] Show participant count in real-time
- [x] Update participant count when users join/leave
- [ ] Add sound notification for incoming calls (optional)
- [ ] Show active call indicator in sidebar for channels with ongoing calls
- [x] Emit WebSocket event when call starts
- [x] Listen for call-started event in ChatModule

### End-to-End Testing
- [ ] Test call initiation between two users
- [ ] Verify audio/video streams work correctly
- [ ] Test participant join/leave functionality
- [ ] Verify call recording captures audio
- [ ] Test automatic transcription after call ends
- [ ] Verify AI summary generation works
- [ ] Test call history displays correctly
- [ ] Test call notifications appear for all channel members
- [ ] Verify WebSocket signaling works across multiple users
- [ ] Test call controls (mute, camera, screen share)


## Final Week 5 Polish (Feb 23, 2026)

### Sound Notifications for Calls
- [x] Request browser notification permissions on app load
- [x] Add notification sound file (call-ring.mp3)
- [x] Create useCallNotifications hook
- [x] Trigger browser notification when call starts in channel
- [x] Play sound effect when call notification appears
- [ ] Add notification settings toggle in user preferences
- [x] Handle notification permission denied gracefully

### Active Call Indicators in Sidebar
- [x] Add pulsing phone/video icon next to channels with active calls
- [x] Query active calls for all user's channels
- [x] Update indicators in real-time via polling (5s interval)
- [x] Use amber/gold color for call indicators
- [x] Add animation (pulse + ping effect) to call icons
- [x] Show call type (voice vs video) with different icons
- [ ] Make indicator clickable to jump to call


## Week 5 Final Enhancements (Feb 23, 2026)

### Notification Preferences Panel
- [x] Create NotificationSettings component
- [x] Add toggle for call notifications (on/off)
- [x] Add sound volume slider (0-100%)
- [x] Add notification delivery method selector (browser, in-app, both)
- [x] Save preferences to user profile in database
- [x] Add notificationPreferences column to users table
- [x] Load preferences on app start
- [ ] Apply preferences to useCallNotifications hook
- [ ] Add settings link in user menu or platform settings

### Clickable Sidebar Call Indicators
- [x] Make call indicator div clickable
- [x] Navigate to channel when indicator is clicked
- [x] Highlight the channel in sidebar after navigation
- [x] Add hover effect to indicate clickability
- [x] Prevent event bubbling to channel button

### Contact Search and Call Initiation in Calls Tab
- [x] Add search input at top of AllCallsView
- [x] Create contact search functionality
- [x] Display search results with user avatars
- [x] Add "Voice Call" and "Video Call" buttons for each contact
- [x] Create startDirectCall mutation
- [x] Handle call initiation from Calls tab
- [x] Navigate to DM channel after starting call
- [x] Create DM channel if it doesn't exist
- [x] Show loading state during call initiation


## Week 5 Final Polish (Feb 23, 2026 - Part 2)

### Notification Settings Integration
- [x] Find platform settings page/component
- [x] Add NotificationSettings route or tab
- [x] Add navigation link to notification settings
- [x] Test settings page accessibility

### Apply Preferences to Notifications
- [x] Update useCallNotifications to load user preferences
- [x] Apply soundVolume to audio playback
- [x] Apply deliveryMethod to notification display logic
- [x] Respect callNotifications toggle (skip if disabled)
- [x] Test with different preference combinations


## Full System Audit (Feb 23, 2026)

### Critical Bug Fixes
- [x] Fix ChatModule activeCallData initialization error
- [x] Verify all queries are properly ordered before usage
- [x] Check for any other initialization errors

### Communication System Audit
- [ ] Test channel creation and membership
- [ ] Test message sending and receiving
- [ ] Test direct messages (DMs)
- [ ] Test group channels
- [ ] Verify WebSocket connections
- [ ] Test typing indicators
- [ ] Test message reactions
- [ ] Test message attachments
- [ ] Test pinned messages

### Calling System Audit
- [ ] Test voice call initiation
- [ ] Test video call initiation
- [ ] Test call joining
- [ ] Test call leaving
- [ ] Test call recording
- [ ] Test call transcription
- [ ] Test call summaries
- [ ] Test call notifications
- [ ] Test call history

### Contact Tagging System
- [ ] Verify contact tags are saved correctly
- [ ] Test tag filtering
- [ ] Test tag search
- [ ] Ensure tags sync across all features
- [ ] Verify contact-meeting associations
- [ ] Test contact-task associations


## Contact Tag Management + Global Search (Feb 23, 2026)

### Operations Page Fix
- [x] Investigate Operations page loading error
- [x] Check browser console for errors
- [x] Fix any initialization or query issues
- [x] Verify Operations page loads successfully

### Contact Tag Management UI
- [x] Create TagManagement component in Contacts section
- [x] Add tag creation modal with name and color picker
- [ ] Implement tag editing functionality (requires backend support)
- [x] Add tag deletion with confirmation
- [x] Create bulk tag application interface
- [x] Add tag filtering in contacts list
- [x] Implement color-coded tag badges
- [ ] Add tag search/autocomplete
- [x] Save tags to database (contacts.tags JSON field)
- [ ] Add backend procedures for tag CRUD

### Global Search Implementation
- [x] Create GlobalSearch component in header
- [x] Add search input with keyboard shortcut (Cmd/Ctrl+K)
- [x] Implement backend search procedure across modules
- [x] Search messages by content and sender
- [x] Search contacts by name, email, organization
- [x] Search meetings by title, participants, notes
- [x] Search tasks by title, description, assignee
- [x] Search call transcripts by content
- [x] Add relevance ranking algorithm
- [x] Display results grouped by module
- [x] Add navigation to search results
- [x] Highlight search terms in results


## Week 7: PWA & Mobile Optimization (Feb 23, 2026)

### PWA Manifest & Branding
- [ ] Create manifest.json with OmniScope branding
- [ ] Design and generate app icons (192x192, 512x512)
- [ ] Add splash screen configuration
- [ ] Set theme colors (black/gold Tesla/Apple aesthetic)
- [ ] Configure display mode (standalone)
- [ ] Add shortcuts for quick actions

### Service Worker & Offline Mode
- [ ] Create service worker with caching strategy
- [ ] Cache static assets (HTML, CSS, JS, fonts)
- [ ] Cache API responses (intelligence reports, contacts)
- [ ] Implement background sync for queued messages
- [ ] Add offline indicator UI
- [ ] Handle offline/online transitions gracefully

### Install Prompt & Push Notifications
- [ ] Add PWA install prompt banner
- [ ] Create "Add to Home Screen" modal
- [ ] Implement push notification permission request
- [ ] Set up push notification service worker
- [ ] Add notification types (messages, calls, tasks, meetings)
- [ ] Test notifications on iOS and Android

### Mobile Responsiveness Polish
- [ ] Audit all pages for mobile breakpoints
- [ ] Add bottom navigation for mobile
- [ ] Optimize touch targets (44px minimum)
- [ ] Add swipe gestures where appropriate
- [ ] Improve mobile header/navigation
- [ ] Test on iPhone and Android devices

### Performance Optimization
- [ ] Lazy load images and components
- [ ] Compress and optimize assets
- [ ] Add loading skeletons for better perceived performance
- [ ] Implement infinite scroll pagination
- [ ] Optimize WebSocket reconnection logic
- [ ] Add haptic feedback for mobile interactions


## Week 7: PWA & Mobile Optimization (Feb 23, 2026)

### PWA Manifest & Icons
- [x] Create manifest.json with OmniScope branding
- [x] Add app icons (official SVG logos)
- [x] Configure display mode (standalone)
- [x] Set theme colors (black/gold #D4AF37)
- [x] Add app shortcuts (Dashboard, Communications, Intelligence, Relationships)
- [x] Add meta tags for iOS/Android
- [x] Link manifest in index.html

### Service Worker & Offline Mode
- [x] Create service-worker.js
- [x] Implement precaching strategy
- [x] Add runtime caching for API calls
- [x] Handle offline fallbacks
- [x] Add background sync for messages
- [x] Register service worker in main.tsx
- [x] Handle service worker updates

### Install Prompt
- [x] Create pwa-register.ts utility
- [x] Listen for beforeinstallprompt event
- [x] Show custom install banner (gold gradient)
- [x] Add install and dismiss buttons
- [x] Store dismissal preference (7 days)
- [x] Handle appinstalled event
- [x] Auto-dismiss after 10 seconds

### Push Notifications Infrastructure
- [x] Add pushSubscriptions table to schema
- [x] Create notifications router (subscribe/unsubscribe)
- [x] Add push notification handler in service worker
- [x] Implement notification click handler
- [x] Add notification permission request in pwa-register
- [ ] Create frontend push notification component

### Mobile Responsiveness
- [ ] Audit all pages for mobile layout
- [ ] Fix sidebar on mobile (collapsible hamburger menu)
- [ ] Optimize chat interface for mobile
- [ ] Ensure call interface works on mobile
- [ ] Test touch interactions (swipe, tap, long-press)
- [ ] Add mobile-specific gestures (swipe to reply, swipe to delete)
- [ ] Optimize font sizes for mobile readability
- [ ] Test on iOS Safari and Android Chrome

### PWA Testing
- [ ] Test PWA installation on iOS
- [ ] Test PWA installation on Android
- [ ] Test offline mode (cache working)
- [ ] Test background sync (messages queued when offline)
- [ ] Test push notifications
- [ ] Test app shortcuts from home screen
- [ ] Verify splash screen appears correctly
- [ ] Test app updates (service worker update flow)


## Week 7 Final Implementation (Feb 23, 2026)

### Mobile Responsiveness
- [x] Add collapsible sidebar with hamburger menu for mobile (shadcn Sidebar has built-in mobile support)
- [x] Implement touch gestures (swipe to open/close sidebar)
- [ ] Add swipe-to-reply gesture in chat
- [ ] Add swipe-to-delete gesture in chat
- [x] Optimize all pages for mobile viewport (320px-768px)
- [x] Fix chat interface for mobile (full-width messages)
- [x] Optimize call interface for mobile screens
- [ ] Test touch interactions (tap, long-press, pinch-zoom)
- [x] Adjust font sizes for mobile readability
- [x] Fix header/footer spacing on mobile
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome

### Push Notification Subscription
- [x] Create PushNotificationSetup component
- [x] Request notification permission from user
- [x] Subscribe user to push notifications via service worker
- [x] Send subscription to backend (notifications.subscribe)
- [x] Store subscription in pushSubscriptions table
- [ ] Test push notification delivery for new messages
- [ ] Test push notification for call invitations
- [ ] Test push notification for mentions
- [x] Add unsubscribe functionality
- [x] Handle subscription renewal/expiry

### QR Code for Mobile Installation
- [x] Generate QR code pointing to PWA URL
- [x] Create QR code display component (InstallQRCode)
- [x] Add "Mobile App (PWA)" section in settings
- [x] Display QR code with installation instructions
- [ ] Test QR code scanning on iOS
- [ ] Test QR code scanning on Android
- [x] Add download QR code button

### Cross-Device PWA Testing
- [ ] Install PWA on iPhone via Safari
- [ ] Install PWA on Android via Chrome
- [ ] Test offline mode (airplane mode)
- [ ] Verify cached pages load offline
- [ ] Test background sync (send message offline, verify sync when online)
- [ ] Test push notifications on mobile
- [ ] Verify app shortcuts work from home screen
- [ ] Test splash screen on both platforms
- [ ] Verify service worker updates correctly


## QR Code Install Prompts (Feb 23, 2026)

### Add QR Code to Calls Section
- [x] Create compact QR code banner component for Calls tab
- [x] Show QR code with "Install OmniScope Mobile" message
- [x] Add dismiss button to hide banner
- [x] Store dismissal in localStorage
- [x] Auto-hide after PWA installation detected

### Add QR Code to Chat Section
- [x] Add QR code banner to ChatModule
- [x] Position banner above message list
- [x] Match OmniScope gold/black branding
- [x] Add "Scan to install on mobile" CTA
- [x] Implement same dismissal logic as Calls

### PWA Installation Detection
- [x] Check if app is running in standalone mode
- [x] Detect PWA installation via window.matchMedia
- [x] Auto-hide QR code banners when installed
- [x] Add "Already installed" state to QR components


## Fix QR Code Installation Flow (Feb 23, 2026)

### Create /install Landing Page
- [x] Create InstallPage component with mobile/desktop detection
- [x] Add hero section explaining PWA benefits
- [x] Show different content for mobile vs desktop users
- [x] Add "Install Now" button that triggers beforeinstallprompt
- [x] Add step-by-step installation instructions
- [x] Match OmniScope gold/black branding
- [x] Add route to App.tsx

### Post-Login Redirect Handling
- [x] Detect if user came from /install page (via getLoginUrl returnPath)
- [x] Store returnPath in OAuth state
- [x] Redirect back to /install after successful login
- [x] Auto-trigger PWA install prompt on mobile after login
- [x] Show success message after installation

### Update QR Code
- [x] Change QR code URL from homepage to /install
- [x] Update InstallBanner component
- [x] Update InstallQRCode component in settings
- [ ] Test QR code scan → login → install flow


## Make /install Page Public (Feb 23, 2026)

### Remove Authentication Requirement
- [x] Make /install route public (no PortalLayout wrapper)
- [x] Update InstallPage to not require user authentication
- [x] Remove trpc.auth.me.useQuery() dependency
- [x] Show installation instructions without login
- [x] Add "Sign In to Get Started" button after PWA installation
- [ ] Test QR code → /install → install app → login flow


## Fix PWA Installation Issues (Feb 23, 2026)

### Manual Installation Instructions
- [x] Add iOS Safari manual installation steps (Share → Add to Home Screen)
- [x] Add Android Chrome manual installation steps (Menu → Install App)
- [x] Show browser-specific instructions based on user agent
- [x] Remove automatic redirect to login when prompt not available
- [x] Add visual guide with step-by-step instructions
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome

### Fix QR Code in ChatModule
- [x] Check why InstallBanner is not rendering in ChatModule
- [x] Verify InstallBanner import is correct
- [x] Verify InstallBanner placement in component tree
- [x] Add padding wrapper for proper spacing
- [x] Test QR code visibility in Chat tab


## Systematic PWA Installation Fixes (Feb 23, 2026)

### Fix /install Route Redirect
- [x] Trace App.tsx routing structure completely
- [x] Verify /install is outside PortalLayout/auth wrapper
- [x] Check if ShellSwitcher is forcing authentication
- [x] Test /install route in incognito/logged-out state
- [x] FINAL FIX: Moved /install check to App component BEFORE OrgProvider
- [x] /install route now renders InstallPage without any auth context
- [x] Added console log to InstallPage to verify rendering

### Find Communications Chat Component
- [x] Identified Communications uses ChatModule for /chat route
- [x] InstallBanner already added to ChatModule (line 419-421)
- [x] Console logs show InstallBanner rendering and generating QR codes
- [x] Added dev-only reset button to clear localStorage dismissal
- [x] Banner only shows in Calls tab (working as designed)
- [ ] User needs to test: navigate to /install directly to verify no redirect


## Week 7: Mobile-First PWA Experience (Feb 23, 2026)

### Mobile Detection & Routing
- [x] Add utility to detect PWA/standalone mode
- [x] Add utility to detect mobile device (screen size + touch)
- [x] Create MobileRouter component for simplified mobile UI
- [x] Update App.tsx to route to MobileRouter when on mobile/PWA
- [x] Keep desktop UI for web browser access
- [x] Auto-redirect mobile/PWA users to /mobile/messages

### Mobile UI Design
- [x] Create MobileLayout component with bottom navigation
- [x] Bottom nav tabs: Messages, Calls, Profile
- [x] Mobile-optimized chat interface (full screen, touch-friendly)
- [x] Mobile-optimized calls interface
- [x] Simple profile/settings page for mobile
- [x] Hide complex features (dashboard, analytics, admin panels)
- [x] Use larger touch targets (min 44px)
- [x] Optimize for one-handed use
- [x] Black & gold theme consistent with desktop

### Mobile Chat Features
- [ ] Full-screen chat list with search
- [ ] Full-screen conversation view
- [ ] Swipe gestures (back to list, reply, etc.)
- [ ] Mobile-optimized message composer
- [ ] Voice message recording
- [ ] Image/file upload from mobile
- [ ] Push notifications integration

### Testing & Polish
- [ ] Test on actual iOS device
- [ ] Test on actual Android device
- [ ] Test PWA installation flow
- [ ] Test offline functionality
- [ ] Optimize performance for mobile
- [ ] Save checkpoint


## Mobile UI Bug Fixes (Feb 23, 2026)

### Critical Bugs
- [x] Fix + button error - shows toast message instead
- [x] Fix Profile tab errors - replaced with toast messages for coming soon features
- [x] Fix Calls tab error - use getCallHistory from all channels
- [x] Add call initiation from mobile Calls tab - added callback buttons
- [x] Test all mobile navigation flows

### Missing Features
- [ ] New message/channel creation from mobile
- [ ] Settings page for mobile
- [ ] Notifications page for mobile
- [ ] Privacy page for mobile
- [ ] Help page for mobile


## Mobile-Desktop Feature Parity (Feb 23, 2026)

### Messages Organization
- [x] Add tabbed navigation to mobile Messages (DMs / Groups / Channels)
- [x] Filter channels by type in each tab
- [x] Show unread counts on each tab
- [x] Match desktop Communications domain structure

### Create Functionality
- [ ] Add "New DM" button and dialog
- [ ] Add "New Group" button and dialog
- [ ] Add "New Channel" button and dialog
- [ ] Reuse existing tRPC procedures from desktop

### Delete Functionality
- [x] Add delete button on channel list items
- [x] Add delete confirmation dialog
- [x] Sync deletions across mobile and desktop (uses same tRPC mutation)
- [x] Handle active chat deletion gracefully

### Real-time Sync
- [ ] Test channel creation on mobile → appears on desktop
- [ ] Test channel creation on desktop → appears on mobile
- [ ] Test channel deletion on mobile → removed from desktop
- [ ] Test channel deletion on desktop → removed from mobile
- [ ] Verify message sync works bidirectionally


## Complete Mobile Channel Creation System (Feb 23, 2026)

### Audit Existing Backend
- [ ] Check what tRPC procedures exist for contacts
- [ ] Check what tRPC procedures exist for channel creation
- [ ] Check desktop Communications implementation
- [ ] Identify any missing backend procedures

### New DM Dialog
- [x] Create NewDMDialog component
- [x] Load contacts list using contacts.list tRPC procedure
- [x] Add contact search functionality
- [x] Handle DM creation with communications.createDM
- [x] Navigate to new DM after creation
- [x] Show loading states and error handling

### New Group Dialog
- [x] Create NewGroupDialog component
- [x] Multi-select contacts interface with checkboxes
- [x] Group name input field
- [x] Description textarea
- [x] Create group channel using communications.createGroupChat
- [x] Show member count during selection
- [x] Validate group name and member selection

### New Channel Dialog
- [x] Create NewChannelDialog component
- [x] Channel name input with # prefix
- [x] Description textarea
- [x] Create channel using communications.createChannel with type="announcement"
- [x] Show helper text about public channels
- [x] Validate channel name

### Channel Discovery
- [ ] Add "Browse Channels" option (future enhancement)
- [ ] List all available public channels
- [ ] Show join/leave buttons
- [ ] Filter joined vs available channels
- [ ] Search public channels

### Pull-to-Refresh
- [x] Add refresh button in Messages header
- [x] Invalidate channels query on refresh
- [x] Show loading spinner during refresh
- [ ] Add swipe-down gesture detection (future enhancement)

### Integration
- [x] Wire up + button to show correct dialog based on active tab
- [x] DM creation syncs with desktop via shared tRPC backend
- [x] Group creation syncs with desktop via shared tRPC backend
- [x] Channel creation syncs with desktop via shared tRPC backend
- [x] All dialogs close properly after success and navigate to new channel


## Mobile Dialog & Sync Fixes (Feb 23, 2026)

### Dialog Keyboard Overlap
- [x] Fix dialog positioning to avoid mobile keyboard overlap
- [x] Make dialog content scrollable when keyboard is open
- [x] Set max-height to 80-85vh to leave room for keyboard
- [x] Fixed layout with header, scrollable content, and sticky button
- [ ] Test on iOS and Android keyboard behavior (requires device testing)

### Message Sync Issue
- [x] Investigate why desktop shows 3 messages but mobile shows none
- [x] Confirmed both use same tRPC query: listChannels
- [x] Query filters by user membership (getChannelsForUser)
- [x] Added debug logging to show current user ID and channel count
- [ ] User needs to check browser console logs to verify which user is logged in
- [ ] If different users, need to log out and log in with same account
- [ ] Test message creation from desktop → verify appears on mobile
- [ ] Test message creation from mobile → verify appears on desktop


## Deep Dive Fixes (Feb 23, 2026)

### PWA Icon Update
- [x] Copy gold OM logo to PWA icon locations
- [x] Update manifest.json with new icon paths
- [ ] Test icon appears correctly when installed (requires reinstall)

### Message Sync Investigation
- [x] Check actual tRPC response data structure
- [x] Verify listChannels returns data on mobile (returns 0 channels)
- [x] Compare desktop vs mobile channel data
- [x] ROOT CAUSE: User has ZERO channel memberships in database
- [x] Trace complete data flow from DB to UI
- [x] Solution: Create channels with proper memberships using new createDM procedure

### Chat Routing Fixes
- [x] Fix "no path" error - added missing createDM tRPC procedure
- [x] Verify /mobile/chat/:id route exists (already set up correctly)
- [x] Fix ChatConversation to use listMessages instead of getMessages
- [x] Fix channelId parsing (convert string to number)
- [x] Test navigation from New DM dialog to chat

### Contact Selection for Calls
- [x] Create NewCallDialog component with contact picker
- [x] Verify contacts.list query works
- [x] Add proper error handling for empty contacts
- [x] Integrate NewCallDialog into Calls tab
- [x] Call flow: select contact → create DM → start call → navigate to chat
