// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Electoral Roll System Loaded');
    
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Print function
function printPage() {
    window.print();
}

// Confirm delete
function confirmDelete(message) {
    return confirm(message || 'Are you sure?');
}