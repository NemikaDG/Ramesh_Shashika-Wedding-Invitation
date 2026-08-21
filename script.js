// ==========================================
// CONFIG & STATE
// ==========================================
// Firebase Configuration
const firebaseConfig = {
  projectId: "wedding-rsvp-data-2026",
  appId: "1:670163167459:web:a37db38802c62d92c07dd6",
  storageBucket: "wedding-rsvp-data-2026.firebasestorage.app",
  apiKey: "AIzaSyBbDYpdwCiQDwekiAokqSa_3KgmU81rdTI",
  authDomain: "wedding-rsvp-data-2026.firebaseapp.com",
  messagingSenderId: "670163167459",
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// BACKGROUND MUSIC CONTROL
// ==========================================
function initBackgroundMusic() {
    const audio = document.getElementById('backgroundMusic');
    const btn = document.getElementById('musicToggleBtn');
    const splash = document.getElementById('splashScreen');
    const enterBtn = document.getElementById('enterBtn');

    if (!audio || !btn) return;

    // Optimal volume for background music
    audio.volume = 0.3;

    // Lock scrolling until splash screen is dismissed
    document.body.classList.add('locked');

    // Check for Personalized Link
    checkPersonalization();

    // Update UI based on audio state
    function updateButtonUI() {
        if (audio.paused) {
            btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            btn.classList.add('muted');
            btn.classList.remove('playing');
            btn.title = 'Play Music';
        } else {
            btn.innerHTML = '<i class="fas fa-volume-up"></i>';
            btn.classList.remove('muted');
            btn.classList.add('playing');
            btn.title = 'Pause Music';
        }
    }

    // Toggle play/pause
    btn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().then(updateButtonUI).catch(e => console.log('Playback blocked:', e));
        } else {
            audio.pause();
            updateButtonUI();
        }
    });

    // Splash Screen Engagement Handler
    if (enterBtn && splash) {
        enterBtn.addEventListener('click', (e) => {
            const liquidContainer = document.getElementById('liquidContainer');

            // 1. Play music immediately
            audio.play().then(() => {
                console.log('✅ Music started via jelly transition');
                updateButtonUI();
            }).catch(p => console.log('Playback blocked:', p));

            // 2. Generate Jelly Liquid Blobs
            const clickX = e.clientX;
            const clickY = e.clientY;

            for (let i = 0; i < 12; i++) {
                const blob = document.createElement('div');
                blob.className = 'liquid-blob';
                blob.style.left = clickX + 'px';
                blob.style.top = clickY + 'px';

                // Varied sizes and speeds for organic liquid feel
                const scale = 25 + Math.random() * 20;
                const delay = Math.random() * 300;

                liquidContainer.appendChild(blob);

                // Start blob expansion
                setTimeout(() => {
                    blob.style.transform = `translate(-50%, -50%) scale(${scale})`;
                }, delay);
            }

            // 3. Trigger visual reveal sequence
            splash.classList.add('burst');

            setTimeout(() => {
                splash.classList.add('revealed');
                document.body.classList.remove('locked');
                document.body.classList.add('revealed'); // Staggered hero reveal
            }, 400);

            // 4. Final Cleanup
            setTimeout(() => {
                splash.remove();
            }, 2500);
        });
    }

    // Fallback: Listen for actual audio events to keep UI in sync
    audio.addEventListener('play', updateButtonUI);
    audio.addEventListener('pause', updateButtonUI);
}



// ==========================================
// 1. ROSE PETAL CANVAS — INTERACTIVE
// ==========================================
(function () {
    var canvas = document.getElementById('petalsCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* ── State ───────────────────────────── */
    var W = 0, H = 0;
    var ptrX = 0, ptrY = 0, ptrOn = false;   // ptrOn = pointer is active
    var wind = 0, windGoal = 0, windTick = 0;
    var petals = [];

    /* ── Tuning ──────────────────────────── */
    var REPEL_R = 130;   // repulsion radius px  (increases on desktop)
    var IMPULSE = 1.1;   // max velocity kick per frame at pointer centre
    var GRAVITY = 0.013; // px / frame²
    var DRAG_X = 0.965; // horizontal damping per frame
    var DRAG_Y = 0.992; // vertical damping (keep falling feel)
    var MAX_SPD = 8;     // px/frame speed cap
    var COUNT = 35;    // initial falling petals
    var MAX_PILE = 60;    // max petals in the footer pile
    var MAX_TOTAL = 130;    // absolute safety cap

    /* ── Colour palette ──────────────────── */
    var PAL = [
        [180, 10, 28], [212, 22, 46], [195, 28, 52],
        [225, 42, 60], [163, 8, 24], [205, 18, 44],
    ];

    /* ── Resize ──────────────────────────── */
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        REPEL_R = W > 768 ? 140 : 100;
        COUNT = W > 768 ? 32 : 18;
    }

    /* ── Create one petal ────────────────── */
    function make(scatter) {
        var c = PAL[Math.floor(Math.random() * PAL.length)];
        var pw = 8 + Math.random() * 10;
        var ph = 16 + Math.random() * 14;
        return {
            x: Math.random() * W,
            y: scatter ? Math.random() * H : -(ph + Math.random() * 180),
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.4 + Math.random() * 0.7,
            rot: Math.random() * 6.2832,
            rv: (Math.random() - 0.5) * 0.05,
            pw: pw, ph: ph,
            r: c[0], g: c[1], b: c[2],
            a: 0.55 + Math.random() * 0.40,
            wob: Math.random() * 6.2832,
            wobs: 0.016 + Math.random() * 0.022,
            landed: false,
            fading: false,
            floorY: H - (5 + Math.random() * 12)
        };
    }

    // Pile management
    var pile = [];

    /* ── Draw one petal ──────────────────── */
    function draw(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        var w = p.pw, h = p.ph;
        var r = p.r, g = p.g, b = p.b, a = p.a;

        // Landed petals fade out when scrolling up from footer
        if (p.landed && !p.fading) {
            a *= getFooterVisibility();
            if (a <= 0) {
                ctx.restore();
                return;
            }
        }

        /* gradient context */
        var gr = ctx.createRadialGradient(
            -w * 0.22, -h * 0.55, h * 0.04,
            0, -h * 0.40, h * 0.58);
        gr.addColorStop(0, 'rgba(' + Math.min(r + 70, 255) + ',' + Math.min(g + 40, 255) + ',' + Math.min(b + 50, 255) + ',' + a + ')');
        gr.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')');
        gr.addColorStop(1, 'rgba(' + Math.max(r - 55, 0) + ',0,0,' + (a * 0.5) + ')');

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(w * 0.9, -h * 0.15, w * 0.7, -h * 0.72, 0, -h);
        ctx.bezierCurveTo(-w * 0.7, -h * 0.72, -w * 0.9, -h * 0.15, 0, 0);
        ctx.closePath();
        ctx.fillStyle = gr;
        ctx.fill();

        ctx.restore();
    }

    /* ── Helper: Check if user is at the bottom ── */
    function getFooterVisibility() {
        var scrollPos = window.innerHeight + window.scrollY;
        var totalHeight = document.documentElement.scrollHeight;
        var threshold = totalHeight - 350; // Start showing petals 350px before end
        if (scrollPos < threshold) return 0;
        return Math.min(1, (scrollPos - threshold) / 150); // Fade in over 150px
    }

    function isAtFooter() {
        return (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 200);
    }

    /* ── Physics ─────────────────────────── */
    function update() {
        if (++windTick > 190) {
            windGoal = (Math.random() - 0.5) * 0.7;
            windTick = 0;
        }
        wind += (windGoal - wind) * 0.008;

        var rr = REPEL_R * REPEL_R;

        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];

            // Fading logic for pile space management
            if (p.fading) {
                p.a -= 0.008;
                if (p.a <= 0) {
                    petals[i] = make(false);
                    continue;
                }
            }

            if (p.landed) {
                // Landed petals react slightly to mouse
                if (ptrOn) {
                    var dx = p.x - ptrX;
                    var dy = p.y - ptrY;
                    var d2 = dx * dx + dy * dy;
                    if (d2 < rr * 0.4) {
                        p.x += (dx / Math.sqrt(d2)) * 0.6;
                        p.rot += 0.01;
                    }
                }
                p.x += wind * 0.05;
                if (p.x < -50) p.x = W + 50;
                if (p.x > W + 50) p.x = -50;
                continue;
            }

            /* horizontal physics */
            p.wob += p.wobs;
            var sway = Math.sin(p.wob) * 0.20;
            p.vx += (wind + sway) * 0.04;

            /* pointer repulsion */
            if (ptrOn) {
                var dx = p.x - ptrX;
                var dy = p.y - ptrY;
                var d2 = dx * dx + dy * dy;
                if (d2 < rr && d2 > 0.1) {
                    var dist = Math.sqrt(d2);
                    var t = 1 - dist / REPEL_R;
                    p.vx += (dx / dist) * t * t * IMPULSE;
                    p.vy += (dy / dist) * t * t * IMPULSE;
                }
            }

            /* vertical physics */
            p.vy += GRAVITY;
            var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (spd > MAX_SPD) {
                p.vx = (p.vx / spd) * MAX_SPD;
                p.vy = (p.vy / spd) * MAX_SPD;
            }

            p.vx *= DRAG_X;
            p.vy *= DRAG_Y;
            if (p.vy < 0.1) p.vy = 0.1;

            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rv;

            /* Contextual Landing Detection */
            if (p.y >= p.floorY) {
                if (isAtFooter()) {
                    // Land on footer
                    p.y = p.floorY;
                    p.landed = true;
                    p.vx = 0; p.vy = 0; p.rv = 0;
                    pile.push(p);

                    // FIFO: Fade oldest if pile is too full
                    if (pile.length > MAX_PILE) {
                        var oldest = pile.shift();
                        oldest.fading = true;
                    }

                    // Replace falling petal instantly
                    if (petals.length < MAX_TOTAL) {
                        petals.push(make(false));
                    }
                } else {
                    // Recycle if not at footer (just passing through)
                    petals[i] = make(false);
                    petals[i].x = Math.random() * W;
                }
            }
        }
    }



    /* ── Render loop ─────────────────────── */
    function loop() {
        ctx.clearRect(0, 0, W, H);
        update();
        for (var i = 0; i < petals.length; i++) draw(petals[i]);
        requestAnimationFrame(loop);
    }

    /* ── Initialise ──────────────────────── */
    resize();
    window.addEventListener('resize', function () { resize(); }, { passive: true });
    for (var i = 0; i < COUNT; i++) petals.push(make(true));
    loop();

    /* ───────────────────────────────────────
       POINTER EVENTS
       Listen on document (not canvas which is
       pointer-events:none) so every interaction
       on the page drives the petals.
    ─────────────────────────────────────── */

    /* Mouse */
    document.addEventListener('mousemove', function (e) {
        ptrX = e.clientX;
        ptrY = e.clientY;
        ptrOn = true;
    }, { passive: true });

    /* Mouse leaves the browser window entirely */
    document.addEventListener('mouseleave', function () {
        ptrOn = false;
    }, { passive: true });

    /* Touch — use capture phase to guarantee we get the event
       even if a child element calls stopPropagation */
    function onTouch(e) {
        if (e.changedTouches && e.changedTouches.length > 0) {
            ptrX = e.changedTouches[0].clientX;
            ptrY = e.changedTouches[0].clientY;
            ptrOn = true;
        } else if (e.touches && e.touches.length > 0) {
            ptrX = e.touches[0].clientX;
            ptrY = e.touches[0].clientY;
            ptrOn = true;
        }
    }

    document.addEventListener('touchstart', onTouch, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouch, { passive: true, capture: true });
    document.addEventListener('touchend', function () {
        /* leave active briefly so petals drift, then deactivate */
        setTimeout(function () { ptrOn = false; }, 500);
    }, { passive: true });
    document.addEventListener('touchcancel', function () { ptrOn = false; }, { passive: true });

})();

// ==========================================
// 2. HERO PARTICLES
// ==========================================
(function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'hero-particle';
        const size = 2 + Math.random() * 6;
        p.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-duration: ${4 + Math.random() * 6}s;
            animation-delay: ${Math.random() * 4}s;
        `;
        container.appendChild(p);
    }
})();

// ==========================================
// 3. NAVIGATION SCROLL BEHAVIOR
// ==========================================
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
}, { passive: true });

// ==========================================
// 4. COUNTDOWN TIMER
// ==========================================
const WEDDING_DATE = new Date('2026-09-13T17:30:00').getTime();
const circumference = 2 * Math.PI * 54; // 339.3

function updateRing(progressEl, value, max) {
    if (!progressEl) return;
    const offset = circumference - (value / max) * circumference;
    progressEl.style.strokeDashoffset = Math.max(0, offset);
}

function animateTick(el) {
    el.classList.remove('tick');
    void el.offsetWidth; // reflow
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), 300);
}

let prevTime = { days: -1, hours: -1, minutes: -1, seconds: -1 };

function startCountdown() {
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const dayProgressEl = document.getElementById('dayProgress');
    const hourProgressEl = document.getElementById('hourProgress');
    const minProgressEl = document.getElementById('minProgress');
    const secProgressEl = document.getElementById('secProgress');

    function tick() {
        const now = Date.now();
        const distance = WEDDING_DATE - now;

        if (distance <= 0) {
            [daysEl, hoursEl, minutesEl, secondsEl].forEach(el => {
                if (el) el.textContent = '00';
            });
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const fmt = n => String(n).padStart(2, '0');

        if (daysEl && days !== prevTime.days) {
            daysEl.textContent = fmt(days);
            animateTick(daysEl);
            updateRing(dayProgressEl, days % 365, 365);
        }
        if (hoursEl && hours !== prevTime.hours) {
            hoursEl.textContent = fmt(hours);
            animateTick(hoursEl);
            updateRing(hourProgressEl, hours, 24);
        }
        if (minutesEl && minutes !== prevTime.minutes) {
            minutesEl.textContent = fmt(minutes);
            animateTick(minutesEl);
            updateRing(minProgressEl, minutes, 60);
        }
        if (secondsEl && seconds !== prevTime.seconds) {
            secondsEl.textContent = fmt(seconds);
            animateTick(secondsEl);
            updateRing(secProgressEl, seconds, 60);
        }

        prevTime = { days, hours, minutes, seconds };
    }

    tick();
    setInterval(tick, 1000);
}

// ==========================================
// 5. SCROLL ANIMATIONS (Timeline)
// ==========================================
function initScrollAnimations() {
    const items = document.querySelectorAll('.timeline-item[data-animate]');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 120);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    items.forEach(item => observer.observe(item));
}

// ==========================================
// 6. RSVP MODAL
// ==========================================
const rsvpModal = document.getElementById('rsvpModal');
const rsvpBackdrop = document.getElementById('rsvpBackdrop');
const rsvpBtn = document.getElementById('rsvpBtn');
const navRsvpBtn = document.getElementById('navRsvpBtn');
const ctaRsvpBtn = document.getElementById('ctaRsvpBtn');
const closeModalBtn = document.getElementById('closeModal');
const nameStep = document.getElementById('nameStep');
const rsvpForm = document.getElementById('rsvpForm');
const successMessage = document.getElementById('successMessage');
const manualNameInput = document.getElementById('manualName');
const guestNameInput = document.getElementById('guestName');
const proceedBtn = document.getElementById('proceedBtn');

// Personalized Guest Info
let guestInfo = {
    name: '',
    phone: ''
};

function checkPersonalization() {
    const urlParams = new URLSearchParams(window.location.search);
    const gName = urlParams.get('g_name');
    const gPhone = urlParams.get('g_phone');

    if (gName) {
        guestInfo.name = decodeURIComponent(gName);
        guestInfo.phone = gPhone || '';

        // Update Splash Screen Greeting
        const splashGreeting = document.getElementById('splashGreeting');
        if (splashGreeting) {
            splashGreeting.innerHTML = `Shashika & Rumesh joyfully invite<br><span class="guest-highlight">${guestInfo.name}</span><br>to witness their union`;
        }

    }
}

function openModal() {
    rsvpModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    resetModal();

    if (guestInfo.name) {
        // Skip name step if already known
        showRsvpForm(guestInfo.name);
        const phoneInput = document.getElementById('guestPhone');
        if (phoneInput) phoneInput.value = guestInfo.phone;
    } else {
        setTimeout(() => manualNameInput && manualNameInput.focus(), 200);
    }
}

function closeModal() {
    rsvpModal.classList.remove('open');
    document.body.style.overflow = '';
}

function resetModal() {
    nameStep.style.display = 'block';
    rsvpForm.style.display = 'none';
    successMessage.style.display = 'none';
    if (rsvpForm) rsvpForm.reset();
    if (manualNameInput) manualNameInput.value = '';
}

function showRsvpForm(name) {
    if (guestNameInput) guestNameInput.value = name;
    nameStep.style.display = 'none';
    rsvpForm.style.display = 'block';
}

// Open modal triggers
[rsvpBtn, navRsvpBtn, ctaRsvpBtn].forEach(btn => {
    if (btn) btn.addEventListener('click', openModal);
});

// Close modal
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (rsvpBackdrop) rsvpBackdrop.addEventListener('click', closeModal);

// Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rsvpModal.classList.contains('open')) closeModal();
});

// Proceed button
if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
        const name = manualNameInput ? manualNameInput.value.trim() : '';
        if (!name) {
            manualNameInput.style.borderColor = '#e57373';
            manualNameInput.placeholder = 'Please enter your name!';
            manualNameInput.focus();
            setTimeout(() => {
                manualNameInput.style.borderColor = '';
                manualNameInput.placeholder = 'Enter your full name';
            }, 2000);
            return;
        }
        showRsvpForm(name);
    });
}

// Enter key on name input
if (manualNameInput) {
    manualNameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') proceedBtn && proceedBtn.click();
    });
}

// ==========================================
// 7. RSVP FORM SUBMISSION
// ==========================================
if (rsvpForm) {
    rsvpForm.addEventListener('submit', e => {
        e.preventDefault();

        const name = guestNameInput ? guestNameInput.value : '';
        const attendance = document.querySelector('input[name="attendance"]:checked');
        const phone = document.getElementById('guestPhone') ? document.getElementById('guestPhone').value : '';
        const note = document.getElementById('specialNote') ? document.getElementById('specialNote').value : '';

        if (!attendance) {
            alert('Please confirm your attendance.');
            return;
        }
        if (!name) {
            alert('Please provide your name.');
            return;
        }

        const rsvpData = {
            name,
            phone,
            status: attendance.value === 'yes' ? 'Attending' : 'Not Attending',
            note,
            timestamp: new Date().toLocaleString()
        };

        // Save to Firestore
        const targetPhone = (phone || "").replace(/\D/g, '');
        db.collection("weddingRSVPs").get().then(snapshot => {
            let docId = null;
            snapshot.forEach(doc => {
                const docPhone = (doc.data().phone || "").replace(/\D/g, '');
                if (docPhone && docPhone === targetPhone) docId = doc.id;
            });
            
            if (docId) {
                // Keep the existing guest data, only update what the RSVP form provides
                db.collection("weddingRSVPs").doc(docId).update({
                    status: rsvpData.status,
                    note: rsvpData.note,
                    timestamp: rsvpData.timestamp
                }).then(() => console.log('✅ RSVP Updated in Firebase'))
                  .catch(err => console.error('Firebase Sync Error:', err));
            } else {
                db.collection("weddingRSVPs").add(rsvpData)
                  .then(() => console.log('✅ RSVP Sent to Firebase'))
                  .catch(err => console.error('Firebase Sync Error:', err));
            }
        });

        // Also save to localStorage
        const existing = JSON.parse(localStorage.getItem('weddingRSVPs') || '[]');
        existing.push(rsvpData);
        localStorage.setItem('weddingRSVPs', JSON.stringify(existing));

        // Show success
        rsvpForm.style.display = 'none';
        if (successMessage) successMessage.style.display = 'block';

        setTimeout(() => closeModal(), 3500);
    });
}

// ==========================================
// 8. SMOOTH ANCHOR SCROLLING
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const navHeight = nav ? nav.offsetHeight : 80;
            const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ==========================================
// 9. MUSIC TOGGLE
// ==========================================


// ==========================================
// 10. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkPersonalization();
    startCountdown();
    initScrollAnimations();
    initBackgroundMusic();
    initInvitationDownload();
    console.log('🎉 Rumesh & Shashika Wedding Invitation Loaded');
});

// ==========================================
// 11. INVITATION DOWNLOAD
// ==========================================
function initInvitationDownload() {
    const downloadBtn = document.getElementById('downloadInvitationBtn');
    if (!downloadBtn) return;

    downloadBtn.addEventListener('click', function (e) {
        e.preventDefault();

        const originalText = this.innerHTML;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = 'invitation.jpeg';
        a.download = 'Rumesh_Shashika_Invitation.jpeg';
        document.body.appendChild(a);

        setTimeout(() => {
            a.click();
            a.remove();
            this.innerHTML = '<i class="fas fa-check"></i> Downloaded';
            setTimeout(() => this.innerHTML = originalText, 2500);
        }, 300);
    });
}
