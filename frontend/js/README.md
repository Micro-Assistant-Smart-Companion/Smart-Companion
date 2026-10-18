# Smart Companion page script, split into 19 files

Same code as the single `app.js` (4191 lines), cut at its own section headings. Nothing was rewritten.
Re-joining the pieces gives back the original file byte for byte.

## How to switch
1. Put the `js/` folder next to your `index.html` (and `style.css`).
2. In `index.html`, delete the line `<script src="app.js"></script>` and put the block from `script-tags.html` in its place.
3. Remove or rename the old `app.js`. Never load both: every name would be declared twice and the page breaks.
4. Hard refresh the browser (Ctrl+Shift+R).

The files must stay in this order. They load one after another and share one global scope, like one long file.

## Which file for which problem
| file | what lives here | look here when... |
|---|---|---|
| 01-setup-and-background | server address, page elements, animated background | the page cannot reach the server |
| 02-theme-and-sessions | light/dark theme, saved chat sessions | theme or chat history is wrong |
| 03-panels-and-utilities | side panel, small helpers | a small helper misbehaves |
| 04-steps-and-chat-view | step cards, chat bubbles | the answer looks wrong on screen |
| 05-chat-backend | sends the message to /decompose-task | no reply, wrong language sent |
| 06-voice-input-output | mic auto-stop, live captions, read aloud | mic or voice problems |
| 07-camera | webcam, phone IP camera | camera status, connection |
| 08-photo-snapshot | photo and document upload | photo or PDF upload |
| 09-live-camera-help | live camera help, scene description | guided search by camera |
| 10-progress-and-badges | streaks, badges | badges not unlocking |
| 11-health-log-old | OLD health log helpers | (legacy, see note below) |
| 12-emergency-contacts | contact storage, SOS message text | the SOS message wording |
| 13-sos-screen | SOS screen, location, hospital directions | SOS screen problems |
| 14-doctor-directory | nearby doctors | doctor search |
| 15-shortcuts | keyboard shortcuts | Escape key behaviour |
| 16-explore-more | links and images under answers | Explore More card |
| 17-language-and-voice | English / Hindi / Bengali picker, voice choice | language dropdown, read-aloud voice |
| 18-health-log | health log tabs, prescription upload, doctor PDF | health log or PDF |
| 19-emergency-card-backup | emergency card, backup and restore | card, backup, restore |

## Good to know
- Tip for debugging: the browser console now shows the file name and the line inside that file.
- File 11 is the old Health Log. Its panel is no longer opened (file 18 replaces the button), but the app still uses a few of its helper functions. Do not delete it before checking, or the SOS contact code may break.
- Files 06 and 17 both define `speak()`, and 11 and 18 both define `recentHealthLogSummary()`. The later file wins. That is how it worked before too. Clean-up for later.
- Tested: the same browser tests as before (voice mic, emergency card, SOS, backup/restore) pass with the split version and show no page errors.
