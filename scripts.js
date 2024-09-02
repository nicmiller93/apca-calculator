// script.js

document.addEventListener('DOMContentLoaded', () => {
    const fgColorInput = document.getElementById('foreground-color');
    const bgColorInput = document.getElementById('background-color');
    const fgHexInput = document.getElementById('foreground-hex');
    const bgHexInput = document.getElementById('background-hex');
    const calculateBtn = document.getElementById('calculate-btn');
    const contrastValue = document.getElementById('contrast-value');

    // Sync color input with text input
    fgColorInput.addEventListener('input', () => {
        fgHexInput.value = fgColorInput.value;
    });

    bgColorInput.addEventListener('input', () => {
        bgHexInput.value = bgColorInput.value;
    });

    fgHexInput.addEventListener('input', () => {
        fgColorInput.value = fgHexInput.value;
    });

    bgHexInput.addEventListener('input', () => {
        bgColorInput.value = bgHexInput.value;
    });

    calculateBtn.addEventListener('click', () => {
        const fgColor = fgHexInput.value;
        const bgColor = bgHexInput.value;

        // Call the APCA calculation function
        const contrast = calculateAPCAContrast(fgColor, bgColor);
        contrastValue.textContent = contrast.toFixed(2);
    });

    function calculateAPCAContrast(foreground, background) {
        // Convert hex color to RGB
        const fgRGB = hexToRGB(foreground);
        const bgRGB = hexToRGB(background);

        // Apply APCA calculation formula
        const luminanceFg = luminance(fgRGB);
        const luminanceBg = luminance(bgRGB);

        // Calculate contrast (Simplified APCA formula)
        const contrastValue = Math.abs(luminanceFg - luminanceBg) * 100;
        return contrastValue;
    }

    function hexToRGB(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return { r, g, b };
    }

    function luminance({ r, g, b }) {
        // Convert RGB to linear light (0.0 - 1.0)
        r = (r / 255.0);
        g = (g / 255.0);
        b = (b / 255.0);

        // Calculate luminance
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
});