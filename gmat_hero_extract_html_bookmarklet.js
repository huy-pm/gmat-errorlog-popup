(function () {
    // Prompt user for selector, default to 'html' to get everything
    var selector = prompt("Enter the CSS selector of the element to extract (e.g., 'body', '#content', '.main'):", "html");

    if (!selector) return; // User cancelled

    try {
        var element = document.querySelector(selector);
        if (!element) {
            alert("Element not found: " + selector);
            return;
        }

        // Get the outerHTML
        var htmlContent = element.outerHTML;

        // Create a blob object representing the data as an HTML file
        var blob = new Blob([htmlContent], { type: "text/html" });

        // Create a temporary anchor element to trigger download
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "extracted_" + (selector === "html" ? "full_page" : selector.replace(/[^a-z0-9]/gi, '_')) + ".html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (e) {
        alert("Error extracting HTML: " + e.message);
    }
})();
