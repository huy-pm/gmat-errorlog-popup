/**
 * GMAT Hero Content Extractor
 * Extracts all content from the first <h5> tag to the end of the page
 * and saves it as a downloadable file.
 * 
 * Usage:
 * 1. Open the target page in your browser
 * 2. Open Developer Console (F12)
 * 3. Paste this script and press Enter
 * 4. Choose your preferred format when prompted
 */
(function() {
    // --- Configuration ---
    const contentContainerSelector = 'div.lesson-content';
    const startTagSelector = 'h5';
    // --- End Configuration ---

    console.log(`Searching for container: "${contentContainerSelector}"`);
    const contentContainer = document.querySelector(contentContainerSelector);

    if (!contentContainer) {
        console.error(`Error: Container "${contentContainerSelector}" not found.`);
        alert(`Content container not found. Please check the page structure.`);
        return;
    }

    console.log(`Searching for first <${startTagSelector}> tag...`);
    const firstH5 = contentContainer.querySelector(startTagSelector);

    if (!firstH5) {
        console.warn(`No <${startTagSelector}> element found.`);
        alert(`No <${startTagSelector}> tag found in the content.`);
        return;
    }

    console.log(`Found starting element: "${firstH5.textContent?.trim().substring(0, 50)}..."`);

    // Ask user for format preference
    const format = prompt(
        'Choose export format:\n1 = Plain Text\n2 = HTML\n3 = Markdown\n\nEnter 1, 2, or 3:',
        '1'
    );

    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === '2') {
        // Extract HTML
        console.log('Extracting HTML content...');
        let htmlContent = '';
        let currentElement = firstH5;
        
        while (currentElement) {
            htmlContent += currentElement.outerHTML + '\n';
            currentElement = currentElement.nextElementSibling;
        }
        
        content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GMAT Hero Content</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }
        h5, h6 { color: #333; margin-top: 30px; }
        blockquote {
            border-left: 4px solid #007bff;
            padding-left: 20px;
            margin: 20px 0;
            background: #f8f9fa;
            padding: 15px 20px;
        }
        .text-blue { color: #007bff; }
        .text-green { color: #28a745; }
        .text-red { color: #dc3545; }
        .text-slateblue { color: slateblue; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
        filename = 'gmat-content.html';
        mimeType = 'text/html';
    } else if (format === '3') {
        // Extract as Markdown
        console.log('Extracting Markdown content...');
        let currentElement = firstH5;
        let mdContent = '';
        
        while (currentElement) {
            const tagName = currentElement.tagName.toLowerCase();
            const text = currentElement.innerText?.trim() || '';
            
            if (tagName === 'h5') {
                mdContent += `\n# ${text}\n\n`;
            } else if (tagName === 'h6') {
                mdContent += `\n## ${text}\n\n`;
            } else if (tagName === 'p') {
                mdContent += `${text}\n\n`;
            } else if (tagName === 'blockquote') {
                const lines = text.split('\n').map(line => `> ${line}`).join('\n');
                mdContent += `${lines}\n\n`;
            } else if (tagName === 'ul' || tagName === 'ol') {
                const items = currentElement.querySelectorAll('li');
                items.forEach((item, idx) => {
                    const prefix = tagName === 'ul' ? '-' : `${idx + 1}.`;
                    mdContent += `${prefix} ${item.innerText?.trim()}\n`;
                });
                mdContent += '\n';
            } else if (text) {
                mdContent += `${text}\n\n`;
            }
            
            currentElement = currentElement.nextElementSibling;
        }
        
        content = mdContent;
        filename = 'gmat-content.md';
        mimeType = 'text/markdown';
    } else {
        // Extract plain text (default)
        console.log('Extracting plain text content...');
        let textContent = '';
        let currentElement = firstH5;
        
        while (currentElement) {
            const text = currentElement.innerText?.trim() || '';
            if (text) {
                textContent += text + '\n\n';
            }
            currentElement = currentElement.nextElementSibling;
        }
        
        content = textContent.trim();
        filename = 'gmat-content.txt';
        mimeType = 'text/plain';
    }

    if (!content) {
        console.warn('No content extracted.');
        alert('No content could be extracted.');
        return;
    }

    // Create and download file
    console.log(`Creating file: ${filename}`);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('\n====================');
    console.log('✓ Content extracted successfully!');
    console.log(`✓ File saved as: ${filename}`);
    console.log(`✓ Content length: ${content.length} characters`);
    console.log('====================');
    
    alert(`Successfully extracted and downloaded as:\n${filename}`);

})();