document.addEventListener('DOMContentLoaded', () => {
    // Initialize Pickr color pickers with defaults
    const textPickr = Pickr.create({
        el: '#text-color-picker',
        default: '#000000',
        theme: 'nano',
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: false,
                rgba: false,
                input: true,
                clear: false,
                save: false
            }
        }
    });

    const bgPickr = Pickr.create({
        el: '#background-color-picker',
        theme: 'nano',
        default: '#ffffff',
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                input: true,
                clear: true,
                save: false
            }
        }
    });

    // Ensure both Pickr instances are ready before calculating contrast
    textPickr.on('init', instance => {
        const hexColor = instance.getColor().toHEXA().toString();
        document.getElementById('textColor').value = hexColor;
    });

    bgPickr.on('init', instance => {
        const hexColor = instance.getColor().toHEXA().toString();
        document.getElementById('bgColor').value = hexColor;
    });

    // Calculate contrast after initializing both color pickers
    textPickr.on('change', (color, instance) => {
        const hexColor = color.toHEXA().toString();
        document.getElementById('textColor').value = hexColor;
        textPickr.applyColor(); // Update the button background
        calculateContrast();
    });

    bgPickr.on('change', (color, instance) => {
        const hexColor = color.toHEXA().toString();
        document.getElementById('bgColor').value = hexColor;
        bgPickr.applyColor(); // Update the button background
        calculateContrast();
    });

    // Wait until both color pickers are initialized
    textPickr.on('init', () => {
        if (bgPickr._lastColor) {
            // Both are initialized, calculate initial contrast
            calculateContrast();
        }
    });

    bgPickr.on('init', () => {
        if (textPickr._lastColor) {
            // Both are initialized, calculate initial contrast
            calculateContrast();
        }
    });
});

function calculateContrast() {
    const textColor = document.getElementById('textColor').value;
    const bgColor = document.getElementById('bgColor').value;

    // Debug: log input colors
    console.log('Text Color:', textColor);
    console.log('Background Color:', bgColor);

    const textRGB = hexToRgb(textColor);
    const bgRGB = hexToRgb(bgColor);

    // Debug: log RGB values
    console.log('Text RGB:', textRGB);
    console.log('Background RGB:', bgRGB);

    const textY = sRGBtoY(textRGB);
    const bgY = sRGBtoY(bgRGB);

    // Debug: log luminance values
    console.log('Text Y:', textY);
    console.log('Background Y:', bgY);

    const apcaContrastValue = APCAcontrast(textY, bgY);
    const wcagContrastValue = calculateWcagContrast(textRGB, bgRGB);

    // Debug: log contrast values
    console.log('APCA Contrast Value:', apcaContrastValue);
    console.log('WCAG Contrast Value:', wcagContrastValue);

    // Format WCAG contrast as a ratio
    const wcagContrastRatio = wcagContrastValue.toFixed(2) + ':1';

    // Determine the APCA contrast compliance and set the description
    const apcaCompliance = apcaContrastValue >= 30 ? `` : `<span class="badge-fail"></span>`;
    const apcaDescription = apcaContrastValue >= 30 ? '' : 'Minimum contrast level 30 required for text';

    // Update the result section
    document.getElementById('result').innerHTML = `
        <div id="apca-contrast" class="result-card">
            <label>APCA Contrast Level</label>
            <div id="apcaContrastValue" class="result-value">${apcaContrastValue.toFixed(2)} ${apcaCompliance}</div>
            <div class="description">${apcaDescription}</div>
        </div>
        <div id="wcag-contrast" class="result-card">
            <label>WCAG Contrast Ratio</label>
            <div id="wcagContrastValue" class="result-value">${wcagContrastRatio} ${getWcagCompliance(wcagContrastValue)}</div>
            <div class="description">${setDescription(apcaContrastValue)}</div>
        </div>
    `;

    highlightFontTable(apcaContrastValue);
    setDescription();
}

function APCAcontrast(txtY, bgY, places = -1) {
    const icp = [0.0, 1.1];

    // If the colors are identical, return 0.0 immediately
    if (txtY === bgY) {
        console.log('Colors are identical, returning 0.0');
        return 0.0;
    }

    // Clamp Y values to 1 if they are slightly above 1 due to floating-point precision
    txtY = Math.min(1, txtY);
    bgY = Math.min(1, bgY);

    if (isNaN(txtY) || isNaN(bgY) || Math.min(txtY, bgY) < icp[0] || Math.max(txtY, bgY) > icp[1]) {
        return 0.0; // Return zero on error
    }

    const normBG = 0.56, normTXT = 0.57, revTXT = 0.62, revBG = 0.65;
    const blkThrs = 0.022, blkClmp = 1.414, scaleBoW = 1.14, scaleWoB = 1.14;
    const loBoWoffset = 0.027, loWoBoffset = 0.027, loClip = 0.1, deltaYmin = 0.0005;

    let SAPC = 0.0, outputContrast = 0.0, polCat = 'BoW';

    // Apply clamping to both txtY and bgY
    txtY = (txtY > blkThrs) ? txtY : txtY + Math.pow(blkThrs - txtY, blkClmp);
    bgY = (bgY > blkThrs) ? bgY : bgY + Math.pow(blkThrs - bgY, blkClmp);

    // Debug: log clamped Y values
    console.log('Clamped txtY:', txtY, 'bgY:', bgY);

    // Check if contrast is minimal
    if (Math.abs(bgY - txtY) < deltaYmin) {
        console.log('Minimal contrast detected, returning 0.0');
        return 0.0;
    }

    // Determine polarity
    if (bgY > txtY) {
        SAPC = (Math.pow(bgY, normBG) - Math.pow(txtY, normTXT)) * scaleBoW;
        outputContrast = (SAPC < loClip) ? 0.0 : SAPC - loBoWoffset;
    } else {
        polCat = 'WoB';
        SAPC = (Math.pow(bgY, revBG) - Math.pow(txtY, revTXT)) * scaleWoB;
        outputContrast = (SAPC > -loClip) ? 0.0 : SAPC + loWoBoffset;
    }

    // Debug: log SAPC and output contrast
    console.log('SAPC:', SAPC, 'Output Contrast:', outputContrast);

    // Return based on the number of decimal places requested
    if (places < 0) {
        return outputContrast * 100.0;
    } else if (places === 0) {
        return Math.round(outputContrast * 100.0) + '<sub>' + polCat + '</sub>';
    } else if (Number.isInteger(places)) {
        return (outputContrast * 100.0).toFixed(places);
    } else {
        return 0.0;
    }
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

function sRGBtoY(rgb = [0, 0, 0]) {
    const mainTRC = 2.4;
    const sRco = 0.2126729, sGco = 0.7151522, sBco = 0.0721750;

    function simpleExp(chan) {
        return Math.pow(chan / 255.0, mainTRC);
    }

    const yValue = sRco * simpleExp(rgb[0]) + sGco * simpleExp(rgb[1]) + sBco * simpleExp(rgb[2]);

    // Clamp Y value to 1 if it's very close to 1
    return Math.min(1, yValue);
}

function calculateWcagContrast(rgb1, rgb2) {
    const L1 = luminance(rgb1);
    const L2 = luminance(rgb2);
    return (L1 > L2) ? (L1 + 0.05) / (L2 + 0.05) : (L2 + 0.05) / (L1 + 0.05);
}

function luminance(rgb) {
    const [r, g, b] = rgb.map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getWcagCompliance(contrast) {
    if (contrast >= 7) return '<span class="badge-pass"></span>';
    if (contrast >= 4.5) return '<span class="badge-pass"></span>';
    if (contrast >= 3) return '<span class="badge-pass"></span>';
    return '<span class="badge-fail"></span>';
}

function setDescription(contrast) {
    if (contrast >= 7) return 'WCAG AAA for Normal Text';
    if (contrast >= 4.5) return 'WCAG AA for Normal Text';
    if (contrast >= 3) return 'WCAG AA for Large Text';
    return 'Fails WCAG requirements';
}

function highlightFontTable(contrast) {
    const table = document.querySelector("#font-contrast-table tbody");
    table.innerHTML = ""; // Clear previous rows

    const fontSizes = [12, 14, 15, 16, 18, 21, 24, 28, 32, 36, 42, 48, 60, 72, 96];
    const fontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];

    fontSizes.forEach((size) => {
        const row = document.createElement("tr");
        const sizeCell = document.createElement("td");
        sizeCell.textContent = size + "px";
        row.appendChild(sizeCell);
        sizeCell.classList.add("size-cell");

        fontWeights.forEach((weight) => {
            const cell = document.createElement("td");
            const minContrast = getMinContrastForSizeAndWeight(size, weight);

            // Determine the content, tooltip text, and initial class name based on the minContrast value
            let tooltipText;
            let content;
            let className;

            // Convert minContrast to numeric value if it's not a special case
            let minContrastValue = parseInt(minContrast);

            if (contrast < 30 || (!isNaN(minContrastValue) && contrast < minContrastValue)) {
                // If contrast is below 30 or less than the required minimum contrast, apply .noBody class
                content = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#ce2c31" viewBox="0 0 256 256"><path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm84,108a83.6,83.6,0,0,1-16.75,50.28L77.72,60.75A84,84,0,0,1,212,128ZM44,128A83.6,83.6,0,0,1,60.75,77.72L178.28,195.25A84,84,0,0,1,44,128Z"></path></svg>';
                tooltipText = `Minimum required contrast level not met for font size ${size}px with font weight ${weight}`;
                className = 'noBody';
            } else {
                // Handle other cases based on minContrast
                switch (minContrast) {
                    case '⊘':
                        content = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#ce2c31" viewBox="0 0 256 256"><path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm84,108a83.6,83.6,0,0,1-16.75,50.28L77.72,60.75A84,84,0,0,1,212,128ZM44,128A83.6,83.6,0,0,1,60.75,77.72L178.28,195.25A84,84,0,0,1,44,128Z"></path></svg>';
                        tooltipText = `Prohibited except for decorative purposes.`;
                        className = 'underWeight';
                        break;
                    case '®©':
                        content = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#ab6400" viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path></svg>';
                        tooltipText = `Acceptable only for placeholder, disabled, or copyright text.`;
                        className = 'copyOnly';
                        break;
                    case '30':
                        content = `${minContrast}`;
                        tooltipText = `Acceptable only for non-text elements.`;
                        className = 'specialCase';
                        break;
                    default:
                        if (minContrast.includes('+15')) {
                            const baseValue = parseInt(minContrast);
                            const additionalValue = baseValue + 15;

                            // Determine if one value passes and the other fails
                            const basePasses = contrast >= baseValue;
                            const additionalPasses = contrast >= additionalValue;

                            if (basePasses !== additionalPasses) {
                                // If one value passes and one fails, apply the orange background
                                content = `<div class="td-inner">
                                    <div class="inset" style="color: ${basePasses ? '#218358' : '#CE2C31'};"><span class="badge-heading">H</span> ${baseValue}</div>
                                    <span class="divider"></span>
                                    <div class="inset" style="color: ${additionalPasses ? '#218358' : '#CE2C31'};"><span class="badge-heading">B</span> ${additionalValue}</div>
                                </div>`;
                                tooltipText = `Acceptable for headings when contrast level is ${baseValue}. Not acceptable for body text.`;
                                className = 'bodyTextPlus';
                                cell.style.backgroundColor = '#FEFBE9'; // Set background to orange
                            } else {
                                // Otherwise, handle as normal
                                content = `<div class="td-inner"">
                                    <div class="inset" style="color: ${basePasses ? '#218358' : '#CE2C31'};"><span class="badge-heading">H</span> ${baseValue}</div>
                                    <span class="divider"></span>
                                    <div class="inset" style="color: ${additionalPasses ? '#218358' : '#CE2C31'};"><span class="badge-heading">B</span> ${additionalValue}</div>
                                </div>`;
                                tooltipText = `Acceptable for headings when contrast level is ${baseValue}. Acceptable for body text when contrast level is ${additionalValue}.`;
                                className = 'highlight';
                            }
                        } else {
                            content = `<div class="td-inner"><div class="inset"><span class="badge-heading">H</span> ${minContrast}</div></div>`;
                            tooltipText = `Acceptable for headings only when contrast level is ${minContrastValue}.`;
                            className = 'highlight';
                        }
                        break;
                }
            }

            // Apply the content, tooltip, and class name
            cell.innerHTML = content;
            cell.classList.add(className);
            cell.setAttribute('data-tooltip', tooltipText);

            // Attach mouse events to dynamically show/hide tooltips
            cell.addEventListener('mouseenter', showTooltip);
            cell.addEventListener('mouseleave', hideTooltip);

            row.appendChild(cell);
        });

        table.appendChild(row);
    });
}

function showTooltip(event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = event.target.getAttribute('data-tooltip');
    document.body.appendChild(tooltip);

    const cellRect = event.target.getBoundingClientRect();
    const tableRect = document.querySelector("#font-contrast-table").getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Calculate positions relative to the document, not the viewport
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    // Default positions: Tooltip above the cell
    let top = cellRect.top + scrollY - tooltipRect.height - 10; // Place the tooltip 10px above the cell
    let left = cellRect.left + scrollX + (cellRect.width - tooltipRect.width) / 2; // Center horizontally above the cell

    // Set default arrow position
    tooltip.setAttribute('data-position', 'top');

    // If there isn't enough space above, display the tooltip below the cell
    if (top < tableRect.top + scrollY) {
        top = cellRect.bottom + scrollY + 10; // Place the tooltip 10px below the cell
        tooltip.setAttribute('data-position', 'bottom');
    }

    // Adjust horizontal position if the tooltip exceeds the table bounds
    if (left < tableRect.left + scrollX) {
        left = tableRect.left + scrollX + 4; // Align to the left table edge with some padding
        tooltip.setAttribute('data-position', 'right');
    } else if (left + tooltipRect.width > tableRect.right + scrollX) {
        left = tableRect.right + scrollX - tooltipRect.width - 4; // Align to the right table edge with some padding
        tooltip.setAttribute('data-position', 'left');
    }

    // If there isn't enough space above or below, try positioning left or right
    if ((top < tableRect.top + scrollY && top + tooltipRect.height > tableRect.bottom + scrollY) ||
        (top + tooltipRect.height > tableRect.bottom + scrollY && left + tooltipRect.width > tableRect.right + scrollX)) {
        // Try positioning to the left of the cell
        if (cellRect.left - tooltipRect.width - 4 > tableRect.left + scrollX) {
            left = cellRect.left + scrollX - tooltipRect.width - 4; // Place to the left of the cell
            top = cellRect.top + scrollY + (cellRect.height - tooltipRect.height) / 2; // Center vertically
            tooltip.setAttribute('data-position', 'left');
        }
        // Otherwise, position to the right of the cell
        else if (cellRect.right + tooltipRect.width + 4 < tableRect.right + scrollX) {
            left = cellRect.right + scrollX + 4; // Place to the right of the cell
            top = cellRect.top + scrollY + (cellRect.height - tooltipRect.height) / 2; // Center vertically
            tooltip.setAttribute('data-position', 'right');
        }
    }

    // Apply the calculated positions to the tooltip
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = 1; // Make the tooltip visible
}

// Function to hide tooltip
function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function getMinContrastForSizeAndWeight(size, weight) {
    // Define APCA minimum contrast requirements based on the provided table
    const contrastTable = {
        12: { 100: '⊘', 200: '⊘', 300: '⊘', 400: '®©', 500: '®©', 600: '®©', 700: '®©', 800: '⊘', 900: '⊘' },
        14: { 100: '⊘', 200: '⊘', 300: '®©', 400: '100', 500: '100', 600: '90', 700: '75', 800: '⊘', 900: '⊘' },
        15: { 100: '⊘', 200: '⊘', 300: '®©', 400: '100', 500: '90', 600: '75', 700: '70', 800: '⊘', 900: '⊘' },
        16: { 100: '⊘', 200: '⊘', 300: '®©', 400: '90', 500: '75', 600: '70+15', 700: '60+15', 800: '60', 900: '⊘' },
        18: { 100: '⊘', 200: '®©', 300: '100', 400: '75', 500: '70+15', 600: '60+15', 700: '55+15', 800: '55', 900: '55' },
        21: { 100: '⊘', 200: '®©', 300: '90', 400: '70', 500: '60+15', 600: '55+15', 700: '50+15', 800: '50', 900: '50' },
        24: { 100: '⊘', 200: '®©', 300: '75', 400: '60+15', 500: '55+15', 600: '50+15', 700: '45+15', 800: '45', 900: '45' },
        28: { 100: '⊘', 200: '100', 300: '70+15', 400: '55+15', 500: '50+15', 600: '45+15', 700: '43+15', 800: '43', 900: '43' },
        32: { 100: '⊘', 200: '90', 300: '65+15', 400: '50+15', 500: '45+15', 600: '43+15', 700: '40+15', 800: '40', 900: '40' },
        36: { 100: '⊘', 200: '75', 300: '60+15', 400: '45+15', 500: '43+15', 600: '40+15', 700: '38+15', 800: '38', 900: '38' },
        42: { 100: '100', 200: '70', 300: '55', 400: '43', 500: '40', 600: '38', 700: '35', 800: '35', 900: '35' },
        48: { 100: '90', 200: '60', 300: '50', 400: '40', 500: '38', 600: '35', 700: '33', 800: '33', 900: '33' },
        60: { 100: '75', 200: '55', 300: '45', 400: '38', 500: '35', 600: '33', 700: '30', 800: '30', 900: '30' },
        72: { 100: '60', 200: '50', 300: '40', 400: '35', 500: '33', 600: '30', 700: '30', 800: '30', 900: '30' },
        96: { 100: '50', 200: '45', 300: '35', 400: '33', 500: '30', 600: '30', 700: '30', 800: '30', 900: '30' },
    };

    // Handle prohibited cases, copy-only, and values
    const result = contrastTable[size]?.[weight];

    if (!result) return 'Invalid'; // If no match is found

    return result;
}