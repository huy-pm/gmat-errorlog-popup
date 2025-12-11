/**
 * GMAT Hero Fullscreen Toggle
 * Adds a fullscreen button next to "GMAT - Zero To Hero" title in the header
 */

(function () {
    'use strict';

    // Check if button already exists
    if (document.getElementById('gmat-fullscreen-btn')) {
        console.log('Fullscreen button already added');
        return;
    }

    // Find the title element
    const titleSpan = document.querySelector('header .title');
    if (!titleSpan) {
        alert('Could not find GMAT Hero header. Make sure you are on the correct page.');
        return;
    }

    // Create fullscreen button
    const btn = document.createElement('button');
    btn.id = 'gmat-fullscreen-btn';
    btn.innerHTML = '⛶'; // Fullscreen icon
    btn.title = 'Toggle Fullscreen';
    btn.style.cssText = `
        background: transparent;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        margin-left: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s ease;
        vertical-align: middle;
    `;

    // Hover effect
    btn.addEventListener('mouseenter', function () {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    btn.addEventListener('mouseleave', function () {
        this.style.background = 'transparent';
    });

    // Toggle fullscreen on click
    btn.addEventListener('click', function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(function () {
                btn.title = 'Exit Fullscreen';
            }).catch(function (err) {
                console.error('Error entering fullscreen:', err);
            });
        } else {
            document.exitFullscreen().then(function () {
                btn.title = 'Enter Fullscreen';
            }).catch(function (err) {
                console.error('Error exiting fullscreen:', err);
            });
        }
    });

    // Listen for fullscreen change to update button tooltip
    document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement) {
            btn.title = 'Exit Fullscreen (ESC)';
        } else {
            btn.title = 'Enter Fullscreen';
        }
    });

    // Insert button after the title
    titleSpan.parentNode.insertBefore(btn, titleSpan.nextSibling);

    console.log('✓ Fullscreen button added to GMAT Hero header');
})();
