# Wedding Invitation Website

A modern, responsive wedding invitation website with countdown timer, RSVP collector, venue location map, wedding agenda, and contact details.

## Features

✨ **Countdown Timer** - Live countdown to the wedding day
📝 **RSVP Collector** - Guest response form with local storage
🗺️ **Venue Map** - Embedded Google Map showing wedding location
📅 **Wedding Agenda** - Timeline of wedding events
📞 **Contact Details** - Bride and groom contact information
📱 **Fully Responsive** - Works on all devices

## Files

- `index.html` - Main HTML structure
- `styles.css` - Complete styling and responsive design
- `script.js` - JavaScript functionality (countdown, RSVP handling)

## Quick Start

1. Open `index.html` in your web browser
2. The page will display all features immediately
3. No server or build process required

## Customization

### Update Wedding Details

In `index.html`:
- Line 15: Change couple names in `<h1 class="bride-groom-names">`
- Line 17: Update wedding date
- Line 39: Modify countdown date in `<p class="wedding-date">`

### Update Countdown Date

In `script.js`:
- Line 3: Change the date in `startCountdown()` function to your wedding date
```javascript
const weddingDate = new Date('June 15, 2024 18:00:00').getTime();
```

### Update Venue Information

In `index.html`:
- Line 93: Change venue name and address
- Line 100: Replace Google Map embed URL with your venue location

### Update Wedding Agenda

In `index.html`:
- Lines 118-156: Modify timeline items with your event schedule

### Update Contact Information

In `index.html`:
- Lines 211-230: Update bride and groom contact details

## Features Explained

### Countdown Timer
- Automatically calculates time remaining until wedding
- Updates every second
- Shows Days, Hours, Minutes, and Seconds

### RSVP Form
- Collects guest name, email, phone, number of guests
- Records attendance status (Yes/No)
- Stores dietary restrictions and special messages
- Uses browser's localStorage for data persistence
- Displays submitted RSVPs in real-time

### Google Map
- Embedded interactive map showing venue location
- Can be customized with different locations

### Timeline Agenda
- Visual timeline of wedding events
- Icons for different event types
- Alternating left-right layout on desktop
- Mobile responsive

### Contact Section
- Bride and groom information
- Phone numbers, email addresses
- Social media links

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Notes

- RSVP data is stored locally in the browser using localStorage
- To deploy to production, add backend to handle RSVP submissions via email or database
- Update the Google Map embed URL to show your actual venue location
- Replace placeholder contact information with actual details

## Customization Tips

1. **Colors**: Edit color codes in `styles.css` (currently using browns and golds)
2. **Fonts**: Google Fonts are already included; modify font-family in CSS
3. **Images**: Consider adding background images to sections
4. **Email Integration**: Add server-side code to email RSVPs

## License

Free to use and modify for any wedding celebration.
